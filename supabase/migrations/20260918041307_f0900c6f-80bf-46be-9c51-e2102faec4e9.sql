-- audit helper
CREATE OR REPLACE FUNCTION public.write_audit(
  _actor uuid, _action text, _entity_kind text, _entity_id uuid,
  _case_id uuid, _from text, _to text, _detail jsonb, _origin public.audit_origin
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_events (actor_id, actor_role, action, entity_kind, entity_id, case_id, from_state, to_state, detail, origin)
  VALUES (_actor, (SELECT role::text FROM public.profiles WHERE id = _actor), _action, _entity_kind, _entity_id, _case_id, _from, _to, COALESCE(_detail,'{}'::jsonb), _origin);
END; $$;
REVOKE ALL ON FUNCTION public.write_audit(uuid,text,text,uuid,uuid,text,text,jsonb,public.audit_origin) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit(uuid,text,text,uuid,uuid,text,text,jsonb,public.audit_origin) TO service_role;

CREATE OR REPLACE FUNCTION public.require_role(_role public.staff_role) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.has_staff_role(uid, _role) THEN
    RAISE EXCEPTION 'Not allowed: this action needs the % role', _role;
  END IF;
  RETURN uid;
END; $$;
REVOKE ALL ON FUNCTION public.require_role(public.staff_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_role(public.staff_role) TO authenticated, service_role;

-- ===== set_role =====
CREATE OR REPLACE FUNCTION public.set_role(_target uuid, _role public.staff_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_role('administrator'); old text;
BEGIN
  IF _target = uid THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  SELECT role::text INTO old FROM public.profiles WHERE id = _target;
  IF old IS NULL THEN RAISE EXCEPTION 'No such staff account'; END IF;
  PERFORM set_config('statbridge.role_change','on',true);
  UPDATE public.profiles SET role = _role WHERE id = _target;
  PERFORM set_config('statbridge.role_change','off',true);
  PERFORM public.write_audit(uid,'role_changed','profile',_target,NULL,old,_role::text,'{}'::jsonb,'screen');
END; $$;

-- ===== source lifecycle =====
CREATE OR REPLACE FUNCTION public.approve_source(_version_id uuid, _basis public.approval_basis DEFAULT 'demonstration')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_role('administrator'); v record; superseded uuid;
BEGIN
  SELECT * INTO v FROM public.source_versions WHERE id = _version_id FOR UPDATE;
  IF v IS NULL THEN RAISE EXCEPTION 'No such source version'; END IF;
  IF v.status <> 'pending' THEN RAISE EXCEPTION 'Only a pending version can be approved'; END IF;
  IF v.ingest_state <> 'done' THEN RAISE EXCEPTION 'The text of this version has not been loaded yet'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.passages WHERE source_version_id = _version_id) THEN
    RAISE EXCEPTION 'This version has no passages to search';
  END IF;
  IF EXISTS (SELECT 1 FROM public.observations WHERE source_version_id = _version_id AND verified_at IS NULL) THEN
    RAISE EXCEPTION 'Every recorded figure must be checked by a person before approval';
  END IF;

  UPDATE public.source_versions
     SET status='approved', approved_by=uid, approved_at=now(), approval_basis=_basis
   WHERE id = _version_id;
  UPDATE public.sources SET current_version_id = _version_id WHERE id = v.source_id;

  superseded := v.supersedes_version_id;
  IF superseded IS NOT NULL THEN
    UPDATE public.source_versions SET status='superseded' WHERE id = superseded AND status='approved';
    PERFORM public.flag_source_change(superseded, 'source_superseded', uid);
  END IF;

  PERFORM public.write_audit(uid,'source_approved','source_version',_version_id,NULL,'pending','approved',
    jsonb_build_object('basis',_basis,'supersedes',superseded),'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.reject_source(_version_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_role('administrator'); st public.source_status;
BEGIN
  SELECT status INTO st FROM public.source_versions WHERE id=_version_id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'No such source version'; END IF;
  IF st <> 'pending' THEN RAISE EXCEPTION 'Only a pending version can be rejected'; END IF;
  UPDATE public.source_versions SET status='rejected', ingest_note=_reason WHERE id=_version_id;
  PERFORM public.write_audit(uid,'source_rejected','source_version',_version_id,NULL,'pending','rejected',
    jsonb_build_object('reason',_reason),'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.withdraw_source(_version_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_role('administrator'); v record;
BEGIN
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'A reason is required to withdraw a source'; END IF;
  SELECT * INTO v FROM public.source_versions WHERE id=_version_id FOR UPDATE;
  IF v IS NULL THEN RAISE EXCEPTION 'No such source version'; END IF;
  IF v.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved version can be withdrawn'; END IF;
  UPDATE public.source_versions SET status='withdrawn', withdrawn_by=uid, withdrawn_at=now(), withdrawal_reason=_reason
   WHERE id=_version_id;
  UPDATE public.sources SET current_version_id = NULL WHERE current_version_id = _version_id;
  PERFORM public.flag_source_change(_version_id, 'source_withdrawn', uid);
  PERFORM public.write_audit(uid,'source_withdrawn','source_version',_version_id,NULL,'approved','withdrawn',
    jsonb_build_object('reason',_reason),'screen');
END; $$;

-- flags everything that relied on a changed source version
CREATE OR REPLACE FUNCTION public.flag_source_change(_version_id uuid, _reason public.void_reason, _actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE note text := CASE WHEN _reason='source_withdrawn' THEN 'A supporting source was withdrawn'
                          ELSE 'A supporting source was corrected' END;
        r record;
BEGIN
  UPDATE public.answers a
     SET review_flag='source_changed', review_flag_reason=note
   WHERE a.id IN (SELECT owner_id FROM public.evidence_links WHERE owner_kind='answer' AND source_version_id=_version_id);

  UPDATE public.memory_items m
     SET reuse_status='needs_review', review_flag_reason=note
   WHERE m.id IN (SELECT owner_id FROM public.evidence_links WHERE owner_kind='memory_item' AND source_version_id=_version_id)
     AND m.reuse_status <> 'withdrawn';

  FOR r IN
    SELECT ap.id AS approval_id, ap.case_id
      FROM public.approvals ap
     WHERE ap.status='active'
       AND (_version_id = ANY (ap.source_version_ids)
            OR EXISTS (SELECT 1 FROM public.evidence_links e
                        WHERE e.owner_kind='draft' AND e.owner_id = ap.draft_id AND e.source_version_id=_version_id))
       AND NOT EXISTS (SELECT 1 FROM public.releases rel WHERE rel.approval_id = ap.id)
  LOOP
    UPDATE public.approvals SET status='void', voided_at=now(), void_reason=_reason WHERE id=r.approval_id;
    UPDATE public.cases SET status='in_review', approved_at=NULL WHERE id=r.case_id AND status='approved';
    PERFORM public.write_audit(_actor,'approval_voided','approval',r.approval_id,r.case_id,'active','void',
      jsonb_build_object('reason',_reason,'source_version_id',_version_id),'system');
  END LOOP;
END; $$;

-- ===== guidelines =====
CREATE OR REPLACE FUNCTION public.activate_guidelines(_guideline_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_role('administrator'); st public.guideline_status; prev uuid;
BEGIN
  SELECT status INTO st FROM public.guidelines WHERE id=_guideline_id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'No such guideline version'; END IF;
  IF st <> 'draft' THEN RAISE EXCEPTION 'Only a draft version can be activated'; END IF;
  SELECT id INTO prev FROM public.guidelines WHERE status='active';
  IF prev IS NOT NULL THEN
    UPDATE public.guidelines SET status='retired', retired_at=now() WHERE id=prev;
  END IF;
  UPDATE public.guidelines SET status='active', activated_by=uid, activated_at=now() WHERE id=_guideline_id;
  PERFORM public.write_audit(uid,'guidelines_activated','guideline',_guideline_id,NULL,'draft','active',
    jsonb_build_object('retired',prev),'screen');
END; $$;

-- ===== cases =====
CREATE OR REPLACE FUNCTION public.next_case_reference() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'SB-' || to_char(now(),'YYYY') || '-' ||
         lpad((COALESCE((SELECT count(*) FROM public.cases WHERE received_at >= date_trunc('year', now())),0) + 1)::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.open_case(
  _kind public.case_kind, _question text, _reasons public.review_reason[], _token_hash text,
  _channel public.channel DEFAULT 'web', _origin_answer uuid DEFAULT NULL,
  _name text DEFAULT NULL, _outlet text DEFAULT NULL, _contact text DEFAULT NULL,
  _consent boolean DEFAULT false, _deadline timestamptz DEFAULT NULL, _notice text DEFAULT NULL,
  _is_demo boolean DEFAULT false
) RETURNS TABLE (id uuid, reference text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid; ref text; attempt int := 0;
BEGIN
  IF _question IS NULL OR length(trim(_question)) < 3 THEN RAISE EXCEPTION 'A question is required'; END IF;
  IF array_length(_reasons,1) IS NULL THEN RAISE EXCEPTION 'At least one review reason is required'; END IF;
  IF _kind = 'media' THEN
    IF _name IS NULL OR _outlet IS NULL OR _contact IS NULL THEN
      RAISE EXCEPTION 'A media request needs a name, an outlet and contact details';
    END IF;
    IF NOT ('media' = ANY (_reasons)) THEN _reasons := _reasons || 'media'::public.review_reason; END IF;
    IF NOT _consent THEN RAISE EXCEPTION 'Consent is required to store contact details'; END IF;
  END IF;

  LOOP
    attempt := attempt + 1;
    ref := public.next_case_reference();
    BEGIN
      INSERT INTO public.cases (reference, kind, review_reasons, question_text, origin_answer_id, channel,
        requester_name, requester_outlet, requester_contact, contact_consent, notice_version, deadline_at,
        status_token_hash, contact_erase_after, is_demo_seed)
      VALUES (ref, _kind, _reasons, _question, _origin_answer, _channel,
        _name, _outlet, _contact, _consent, _notice, _deadline,
        _token_hash, (now() + interval '90 days')::date, _is_demo)
      RETURNING cases.id INTO new_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt > 5 THEN RAISE; END IF;
      ref := ref || '-' || attempt::text;
    END;
  END LOOP;

  PERFORM public.write_audit(NULL,'case_opened','case',new_id,new_id,NULL,'received',
    jsonb_build_object('kind',_kind,'channel',_channel),'api');
  RETURN QUERY SELECT new_id, ref;
END; $$;
REVOKE ALL ON FUNCTION public.open_case(public.case_kind,text,public.review_reason[],text,public.channel,uuid,text,text,text,boolean,timestamptz,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_case(public.case_kind,text,public.review_reason[],text,public.channel,uuid,text,text,text,boolean,timestamptz,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.assign_case(_case_id uuid, _owner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); st public.case_status;
BEGIN
  IF uid IS NULL OR NOT (public.has_staff_role(uid,'official') OR public.has_staff_role(uid,'manager')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT status INTO st FROM public.cases WHERE id=_case_id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'No such case'; END IF;
  IF st IN ('released','rejected') THEN RAISE EXCEPTION 'This case is closed'; END IF;
  UPDATE public.cases SET assigned_to=_owner WHERE id=_case_id;
  PERFORM public.write_audit(uid,'case_assigned','case',_case_id,_case_id,NULL,NULL,jsonb_build_object('owner',_owner),'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.start_review(_case_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_role('official'); st public.case_status;
BEGIN
  SELECT status INTO st FROM public.cases WHERE id=_case_id FOR UPDATE;
  IF st IS DISTINCT FROM 'draft_prepared' THEN RAISE EXCEPTION 'A draft must be prepared before review starts'; END IF;
  UPDATE public.cases SET status='in_review', assigned_to=COALESCE(assigned_to, uid) WHERE id=_case_id;
  PERFORM public.write_audit(uid,'review_started','case',_case_id,_case_id,'draft_prepared','in_review','{}'::jsonb,'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.save_draft(
  _case_id uuid, _body text, _format public.draft_format DEFAULT 'general_reply',
  _reading_level public.reading_level DEFAULT 'short', _parts jsonb DEFAULT '[]'::jsonb,
  _gaps text[] DEFAULT '{}', _adapted_from uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_role('official'); st public.case_status; gid uuid; nextv int;
        new_id uuid; fp text; prev_draft uuid; active_appr uuid;
BEGIN
  IF _body IS NULL OR length(trim(_body)) = 0 THEN RAISE EXCEPTION 'The draft cannot be empty'; END IF;
  SELECT status INTO st FROM public.cases WHERE id=_case_id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'No such case'; END IF;
  IF st IN ('released','rejected') THEN RAISE EXCEPTION 'This case is closed'; END IF;
  SELECT id INTO gid FROM public.guidelines WHERE status='active';
  IF gid IS NULL THEN RAISE EXCEPTION 'No active communication guidelines'; END IF;

  SELECT COALESCE(max(version_number),0)+1, max(id) INTO nextv, prev_draft FROM public.drafts WHERE case_id=_case_id;
  fp := encode(digest(_body,'sha256'),'hex');

  INSERT INTO public.drafts (case_id, version_number, format, reading_level, body, parts, gaps,
    guideline_id, adapted_from_memory_item_id, author_kind, author_id, fingerprint)
  VALUES (_case_id, nextv, _format, _reading_level, _body, _parts, _gaps, gid, _adapted_from, 'official', uid, fp)
  RETURNING id INTO new_id;

  -- carry the evidence of the previous version forward
  IF prev_draft IS NOT NULL THEN
    INSERT INTO public.evidence_links (owner_kind, owner_id, source_version_id, passage_id, observation_id, statement)
    SELECT 'draft', new_id, source_version_id, passage_id, observation_id, statement
      FROM public.evidence_links
     WHERE owner_kind='draft' AND owner_id = (SELECT id FROM public.drafts WHERE case_id=_case_id AND version_number=nextv-1);
  END IF;

  SELECT id INTO active_appr FROM public.approvals WHERE case_id=_case_id AND status='active';
  IF active_appr IS NOT NULL THEN
    UPDATE public.approvals SET status='void', voided_at=now(), void_reason='edited' WHERE id=active_appr;
    PERFORM public.write_audit(uid,'approval_voided','approval',active_appr,_case_id,'active','void',
      jsonb_build_object('reason','edited'),'screen');
  END IF;

  UPDATE public.cases SET status='in_review', approved_at=NULL,
    first_draft_at=COALESCE(first_draft_at, now()) WHERE id=_case_id;
  PERFORM public.write_audit(uid,'draft_saved','draft',new_id,_case_id,st::text,'in_review',
    jsonb_build_object('version',nextv,'fingerprint',fp),'screen');
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.request_changes(_case_id uuid, _instruction text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_role('official'); st public.case_status;
BEGIN
  IF _instruction IS NULL OR length(trim(_instruction))=0 THEN RAISE EXCEPTION 'An instruction is required'; END IF;
  SELECT status INTO st FROM public.cases WHERE id=_case_id FOR UPDATE;
  IF st IS DISTINCT FROM 'in_review' THEN RAISE EXCEPTION 'The case must be in review'; END IF;
  UPDATE public.cases SET status='changes_requested' WHERE id=_case_id;
  PERFORM public.write_audit(uid,'changes_requested','case',_case_id,_case_id,'in_review','changes_requested',
    jsonb_build_object('instruction',_instruction),'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.reject_case(_case_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_role('official'); st public.case_status;
BEGIN
  IF _reason IS NULL OR length(trim(_reason))=0 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT status INTO st FROM public.cases WHERE id=_case_id FOR UPDATE;
  IF st IS DISTINCT FROM 'in_review' THEN RAISE EXCEPTION 'The case must be in review'; END IF;
  UPDATE public.cases SET status='rejected', closed_reason=_reason WHERE id=_case_id;
  PERFORM public.write_audit(uid,'case_rejected','case',_case_id,_case_id,'in_review','rejected',
    jsonb_build_object('reason',_reason),'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.approve_draft(_draft_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_role('official'); d record; latest int; appr uuid;
        svids uuid[]; bad int; basis public.approval_basis;
BEGIN
  SELECT * INTO d FROM public.drafts WHERE id=_draft_id;
  IF d IS NULL THEN RAISE EXCEPTION 'No such draft'; END IF;
  SELECT max(version_number) INTO latest FROM public.drafts WHERE case_id=d.case_id;
  IF d.version_number <> latest THEN RAISE EXCEPTION 'Only the latest draft version can be approved'; END IF;

  SELECT array_agg(DISTINCT source_version_id) INTO svids
    FROM public.evidence_links WHERE owner_kind='draft' AND owner_id=_draft_id;
  svids := COALESCE(svids, '{}');

  SELECT count(*) INTO bad FROM public.source_versions WHERE id = ANY(svids) AND status <> 'approved';
  IF bad > 0 THEN RAISE EXCEPTION 'A supporting source is no longer approved'; END IF;

  UPDATE public.approvals SET status='void', voided_at=now(), void_reason='manual'
   WHERE case_id=d.case_id AND status='active';

  SELECT CASE WHEN (SELECT is_demo FROM public.profiles WHERE id=uid) THEN 'demonstration' ELSE 'official' END INTO basis;

  INSERT INTO public.approvals (case_id, draft_id, fingerprint, source_version_ids, guideline_id, approved_by, approval_basis)
  VALUES (d.case_id, _draft_id, d.fingerprint, svids, d.guideline_id, uid, basis)
  RETURNING id INTO appr;

  UPDATE public.cases SET status='approved', approved_at=now() WHERE id=d.case_id;
  PERFORM public.write_audit(uid,'draft_approved','approval',appr,d.case_id,'in_review','approved',
    jsonb_build_object('draft',_draft_id,'fingerprint',d.fingerprint,'basis',basis),'screen');
  RETURN appr;
END; $$;

CREATE OR REPLACE FUNCTION public.release_draft(_case_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_role('official'); ap record; d record; latest_fp text;
        bad int; rel uuid; mem uuid; refs jsonb; c record;
BEGIN
  SELECT * INTO c FROM public.cases WHERE id=_case_id FOR UPDATE;
  IF c IS NULL THEN RAISE EXCEPTION 'No such case'; END IF;
  IF c.status = 'released' THEN RAISE EXCEPTION 'This reply has already been released'; END IF;

  SELECT * INTO ap FROM public.approvals WHERE case_id=_case_id AND status='active';
  IF ap IS NULL THEN RAISE EXCEPTION 'There is no active approval for this case'; END IF;
  IF EXISTS (SELECT 1 FROM public.releases WHERE approval_id = ap.id) THEN
    RAISE EXCEPTION 'This approval has already been released';
  END IF;

  SELECT * INTO d FROM public.drafts WHERE id = ap.draft_id;
  SELECT fingerprint INTO latest_fp FROM public.drafts WHERE case_id=_case_id ORDER BY version_number DESC LIMIT 1;
  IF ap.fingerprint <> latest_fp THEN RAISE EXCEPTION 'The draft changed after approval. It must be approved again.'; END IF;

  SELECT count(*) INTO bad FROM public.source_versions WHERE id = ANY(ap.source_version_ids) AND status <> 'approved';
  IF bad > 0 THEN RAISE EXCEPTION 'A supporting source was corrected or withdrawn. Release is blocked.'; END IF;

  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
            'title', s.title, 'publisher', s.publisher, 'published_on', v.published_on,
            'reference_period', v.reference_period, 'url', COALESCE(v.original_url, s.canonical_url),
            'version_label', v.version_label)), '[]'::jsonb)
    INTO refs
    FROM public.source_versions v JOIN public.sources s ON s.id = v.source_id
   WHERE v.id = ANY(ap.source_version_ids);

  INSERT INTO public.memory_items (item_type, title, body, topic, audience, communicated_on, origin,
    approval_basis, reuse_status, created_by, is_demo_seed)
  VALUES (CASE WHEN c.kind='media' THEN 'media_response' ELSE 'other_messaging' END,
    left(c.question_text, 180), d.body, NULL, 'public', current_date, 'released_case',
    ap.approval_basis, 'reusable', uid, c.is_demo_seed)
  RETURNING id INTO mem;

  INSERT INTO public.releases (case_id, approval_id, draft_id, released_body, released_references,
    channel, delivery_state, released_by, memory_item_id)
  VALUES (_case_id, ap.id, d.id, d.body, refs, 'status_page', 'shown', uid, mem)
  RETURNING id INTO rel;

  UPDATE public.memory_items SET release_id = rel WHERE id = mem;

  INSERT INTO public.evidence_links (owner_kind, owner_id, source_version_id, passage_id, observation_id, statement)
  SELECT 'memory_item', mem, source_version_id, passage_id, observation_id, statement
    FROM public.evidence_links WHERE owner_kind='draft' AND owner_id = d.id;

  UPDATE public.cases SET status='released', released_at=now() WHERE id=_case_id;
  PERFORM public.write_audit(uid,'reply_released','release',rel,_case_id,'approved','released',
    jsonb_build_object('approval',ap.id,'draft',d.id,'memory_item',mem),'screen');
  RETURN rel;
END; $$;

CREATE OR REPLACE FUNCTION public.correct_routing(_case_id uuid, _kind public.case_kind, _reasons public.review_reason[], _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_role('official'); old_kind public.case_kind;
BEGIN
  IF _note IS NULL OR length(trim(_note))=0 THEN RAISE EXCEPTION 'A note is required'; END IF;
  IF array_length(_reasons,1) IS NULL THEN RAISE EXCEPTION 'At least one reason is required'; END IF;
  SELECT kind INTO old_kind FROM public.cases WHERE id=_case_id FOR UPDATE;
  IF old_kind IS NULL THEN RAISE EXCEPTION 'No such case'; END IF;
  UPDATE public.cases SET kind=_kind, review_reasons=_reasons, routing_corrected_by=uid, routing_note=_note
   WHERE id=_case_id;
  PERFORM public.write_audit(uid,'routing_corrected','case',_case_id,_case_id,old_kind::text,_kind::text,
    jsonb_build_object('note',_note),'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.erase_contacts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; r record;
BEGIN
  FOR r IN SELECT id FROM public.cases
            WHERE contact_erase_after IS NOT NULL AND contact_erase_after < current_date
              AND (requester_contact IS NOT NULL OR requester_name IS NOT NULL)
  LOOP
    UPDATE public.cases SET requester_name=NULL, requester_outlet=NULL, requester_contact=NULL WHERE id=r.id;
    PERFORM public.write_audit(NULL,'contacts_erased','case',r.id,r.id,NULL,NULL,'{}'::jsonb,'system');
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.erase_contacts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erase_contacts() TO service_role;

-- staff-callable decision functions
REVOKE ALL ON FUNCTION public.set_role(uuid, public.staff_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_source(uuid, public.approval_basis) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_source(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_source(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.flag_source_change(uuid, public.void_reason, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_guidelines(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_case(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_review(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_draft(uuid, text, public.draft_format, public.reading_level, jsonb, text[], uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_changes(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_case(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_draft(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_draft(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.correct_routing(uuid, public.case_kind, public.review_reason[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_case_reference() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.set_role(uuid, public.staff_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_source(uuid, public.approval_basis) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_source(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_source(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.flag_source_change(uuid, public.void_reason, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_guidelines(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_case(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_review(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_draft(uuid, text, public.draft_format, public.reading_level, jsonb, text[], uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_changes(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_case(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_draft(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_draft(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.correct_routing(uuid, public.case_kind, public.review_reason[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_case_reference() TO service_role;