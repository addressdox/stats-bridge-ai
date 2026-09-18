BEGIN;

-- Private process guidance is only available to server-side drafting. Public
-- retrieval continues to require audience=public and never calls this RPC.
CREATE OR REPLACE FUNCTION public.search_case_guidance(_q text, _limit integer DEFAULT 4)
RETURNS TABLE(title text, content text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT s.title, p.content FROM public.passages p
 JOIN public.source_versions v ON v.id=p.source_version_id
 JOIN public.sources s ON s.id=v.source_id
 WHERE v.status='approved' AND s.audience='staff'
   AND p.search_text @@ websearch_to_tsquery('english',_q)
 ORDER BY ts_rank(p.search_text,websearch_to_tsquery('english',_q)) DESC
 LIMIT greatest(1,least(_limit,8));
$$;
REVOKE ALL ON FUNCTION public.search_case_guidance(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.search_case_guidance(text,integer) TO service_role;

-- One transactional writer: evidence cannot be lost between saving wording and
-- assigning its version. The case lock serialises edits, approvals and release.
CREATE OR REPLACE FUNCTION public.persist_case_draft(
 _case_id uuid, _body text, _format public.draft_format, _gaps text[],
 _evidence jsonb, _guideline_id uuid, _actor uuid, _generated boolean,
 _provider text DEFAULT NULL, _model text DEFAULT NULL,
 _reading_level public.reading_level DEFAULT 'short', _parts jsonb DEFAULT '[]', _adapted_from uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; previous record; gid uuid; nextv integer; did uuid; e jsonb; vid uuid; pid uuid; oid uuid; fp text;
BEGIN
 SELECT * INTO c FROM public.cases WHERE id=_case_id FOR UPDATE;
 IF c IS NULL THEN RAISE EXCEPTION 'No such case'; END IF;
 SELECT * INTO previous FROM public.drafts WHERE case_id=_case_id ORDER BY version_number DESC LIMIT 1;
 IF _generated AND previous.id IS NOT NULL THEN RETURN previous.id; END IF;
 IF c.status IN ('released','rejected') THEN RAISE EXCEPTION 'This case is closed'; END IF;
 IF length(trim(COALESCE(_body,'')))=0 THEN RAISE EXCEPTION 'The draft cannot be empty'; END IF;
 SELECT id INTO gid FROM public.guidelines WHERE status='active';
 IF gid IS NULL OR (_generated AND gid IS DISTINCT FROM _guideline_id) THEN RAISE EXCEPTION 'Active communication guidelines changed; generate the draft again'; END IF;
 IF _evidence IS NOT NULL AND jsonb_typeof(_evidence)<>'array' THEN RAISE EXCEPTION 'Evidence must be an array'; END IF;
 IF _evidence IS NULL AND previous.id IS NOT NULL THEN
   SELECT COALESCE(jsonb_agg(jsonb_build_object('sourceVersionId',source_version_id,'passageId',passage_id,'observationId',observation_id,'statement',statement)),'[]') INTO _evidence
   FROM public.evidence_links WHERE owner_kind='draft' AND owner_id=previous.id;
 END IF;
 _evidence:=COALESCE(_evidence,'[]');
 IF jsonb_array_length(_evidence)>48 THEN RAISE EXCEPTION 'Too many evidence references'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(_evidence) LOOP
   vid:=(e->>'sourceVersionId')::uuid; pid:=(e->>'passageId')::uuid; oid:=(e->>'observationId')::uuid;
   IF (pid IS NULL)=(oid IS NULL) THEN RAISE EXCEPTION 'Evidence must identify one passage or figure'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.source_versions v JOIN public.sources s ON s.id=v.source_id WHERE v.id=vid AND v.status='approved' AND s.audience='public') THEN RAISE EXCEPTION 'Draft facts require approved public sources'; END IF;
   IF pid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.passages WHERE id=pid AND source_version_id=vid) THEN RAISE EXCEPTION 'The extract does not belong to this source'; END IF;
   IF oid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.observations WHERE id=oid AND source_version_id=vid AND verified_at IS NOT NULL AND verified_by IS NOT NULL) THEN RAISE EXCEPTION 'The figure has not been verified against this source'; END IF;
 END LOOP;
 nextv:=COALESCE(previous.version_number,0)+1;
 fp:=encode(sha256(convert_to(_body,'UTF8')),'hex');
 INSERT INTO public.drafts(case_id,version_number,format,reading_level,body,parts,gaps,guideline_id,adapted_from_memory_item_id,author_kind,author_id,fingerprint,ai_provider,ai_model,prompt_version)
 VALUES(_case_id,nextv,_format,_reading_level,_body,_parts,COALESCE(_gaps,'{}'),gid,_adapted_from,CASE WHEN _generated THEN 'ai'::public.author_kind ELSE 'official'::public.author_kind END,_actor,fp,_provider,_model,CASE WHEN _generated THEN 'case-draft-2026-09-18' ELSE NULL END) RETURNING id INTO did;
 INSERT INTO public.evidence_links(owner_kind,owner_id,source_version_id,passage_id,observation_id,statement)
 SELECT 'draft',did,(value->>'sourceVersionId')::uuid,(value->>'passageId')::uuid,(value->>'observationId')::uuid,left(value->>'statement',2000) FROM jsonb_array_elements(_evidence);
 UPDATE public.approvals SET status='void',voided_at=now(),void_reason='edited' WHERE case_id=_case_id AND status='active';
 UPDATE public.cases SET status=CASE WHEN _generated THEN 'draft_prepared'::public.case_status ELSE 'in_review'::public.case_status END,approved_at=NULL,first_draft_at=COALESCE(first_draft_at,now()) WHERE id=_case_id;
 PERFORM public.write_audit(_actor,CASE WHEN _generated THEN 'draft_prepared' ELSE 'draft_saved' END,'draft',did,_case_id,c.status::text,CASE WHEN _generated THEN 'draft_prepared' ELSE 'in_review' END,jsonb_build_object('version',nextv,'fingerprint',fp,'evidence_count',jsonb_array_length(_evidence)),CASE WHEN _generated THEN 'system'::public.audit_origin ELSE 'screen'::public.audit_origin END);
 RETURN did;
END; $$;
REVOKE ALL ON FUNCTION public.persist_case_draft(uuid,text,public.draft_format,text[],jsonb,uuid,uuid,boolean,text,text,public.reading_level,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persist_case_draft(uuid,text,public.draft_format,text[],jsonb,uuid,uuid,boolean,text,text,public.reading_level,jsonb,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.save_generated_case_draft(_case_id uuid,_body text,_gaps text[],_evidence jsonb,_guideline_id uuid,_provider text,_model text,_fingerprint text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.draft_format;
BEGIN
 SELECT CASE WHEN kind='media' OR routing_note='staff_press_release' THEN 'short_media_statement'::public.draft_format ELSE 'general_reply'::public.draft_format END INTO f FROM public.cases WHERE id=_case_id;
 RETURN public.persist_case_draft(_case_id,_body,f,_gaps,_evidence,_guideline_id,NULL,true,_provider,_model);
END; $$;
REVOKE ALL ON FUNCTION public.save_generated_case_draft(uuid,text,text[],jsonb,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_generated_case_draft(uuid,text,text[],jsonb,uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.save_review_draft(_case_id uuid,_body text,_format public.draft_format,_gaps text[],_evidence jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=public.require_permission('cases.review');
BEGIN
 RETURN public.persist_case_draft(_case_id,_body,_format,_gaps,_evidence,NULL,actor,false);
END; $$;
REVOKE ALL ON FUNCTION public.save_review_draft(uuid,text,public.draft_format,text[],jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_review_draft(uuid,text,public.draft_format,text[],jsonb) TO authenticated,service_role;

-- Preserve existing clients of save_draft, including their format/parts inputs.
CREATE OR REPLACE FUNCTION public.save_draft(_case_id uuid,_body text,_format public.draft_format DEFAULT 'general_reply',_reading_level public.reading_level DEFAULT 'short',_parts jsonb DEFAULT '[]',_gaps text[] DEFAULT '{}',_adapted_from uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=public.require_permission('cases.review');
BEGIN
 RETURN public.persist_case_draft(_case_id,_body,_format,_gaps,NULL,NULL,actor,false,NULL,NULL,_reading_level,_parts,_adapted_from);
END; $$;

-- Existing read policies used legacy roles while the workbench used permissions.
DROP POLICY IF EXISTS "officials and managers read cases" ON public.cases;
CREATE POLICY "officials and managers read cases" ON public.cases FOR SELECT TO authenticated USING(public.has_permission(auth.uid(),'cases.review'));
DROP POLICY IF EXISTS "officials and managers read drafts" ON public.drafts;
CREATE POLICY "officials and managers read drafts" ON public.drafts FOR SELECT TO authenticated USING(public.has_permission(auth.uid(),'cases.review'));
DROP POLICY IF EXISTS "officials and managers read approvals" ON public.approvals;
CREATE POLICY "officials and managers read approvals" ON public.approvals FOR SELECT TO authenticated USING(public.has_permission(auth.uid(),'cases.review'));

CREATE OR REPLACE FUNCTION public.start_review(_case_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_permission('cases.review'); st public.case_status;
BEGIN
  SELECT status INTO st FROM public.cases WHERE id=_case_id FOR UPDATE;
  IF st IS DISTINCT FROM 'draft_prepared' THEN RAISE EXCEPTION 'A draft must be prepared before review starts'; END IF;
  UPDATE public.cases SET status='in_review', assigned_to=COALESCE(assigned_to, uid) WHERE id=_case_id;
  PERFORM public.write_audit(uid,'review_started','case',_case_id,_case_id,'draft_prepared','in_review','{}'::jsonb,'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.request_changes(_case_id uuid, _instruction text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_permission('cases.review'); st public.case_status;
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
DECLARE uid uuid := public.require_permission('cases.review'); st public.case_status;
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
DECLARE uid uuid := public.require_permission('cases.review'); d record; latest int; appr uuid;
        svids uuid[]; bad int; st public.case_status; basis public.approval_basis;
BEGIN
  SELECT * INTO d FROM public.drafts WHERE id=_draft_id;
  IF d IS NULL THEN RAISE EXCEPTION 'No such draft'; END IF;
  SELECT status INTO st FROM public.cases WHERE id=d.case_id FOR UPDATE;
  IF st IS DISTINCT FROM 'in_review' THEN RAISE EXCEPTION 'Start review before approving this draft'; END IF;
  IF cardinality(d.gaps)>0 THEN RAISE EXCEPTION 'Resolve the recorded evidence gaps before approval'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.guidelines WHERE id=d.guideline_id AND status='active') THEN RAISE EXCEPTION 'Guidelines changed; save a new draft before approval'; END IF;
  SELECT max(version_number) INTO latest FROM public.drafts WHERE case_id=d.case_id;
  IF d.version_number <> latest THEN RAISE EXCEPTION 'Only the latest draft version can be approved'; END IF;

  SELECT array_agg(DISTINCT source_version_id) INTO svids
    FROM public.evidence_links WHERE owner_kind='draft' AND owner_id=_draft_id;
  svids := COALESCE(svids, '{}');

  SELECT count(*) INTO bad FROM public.source_versions v JOIN public.sources s ON s.id=v.source_id WHERE v.id = ANY(svids) AND (v.status <> 'approved' OR s.audience <> 'public');
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
DECLARE uid uuid := public.require_permission('cases.release'); ap record; d record; latest_fp text;
        bad int; rel uuid; mem uuid; refs jsonb; c record;
BEGIN
  SELECT * INTO c FROM public.cases WHERE id=_case_id FOR UPDATE;
  IF c IS NULL THEN RAISE EXCEPTION 'No such case'; END IF;
  IF c.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved case can be released'; END IF;

  SELECT * INTO ap FROM public.approvals WHERE case_id=_case_id AND status='active';
  IF ap IS NULL THEN RAISE EXCEPTION 'There is no active approval for this case'; END IF;
  IF EXISTS (SELECT 1 FROM public.releases WHERE approval_id = ap.id) THEN
    RAISE EXCEPTION 'This approval has already been released';
  END IF;

  SELECT * INTO d FROM public.drafts WHERE id = ap.draft_id;
  IF cardinality(d.gaps)>0 THEN RAISE EXCEPTION 'Resolve the recorded evidence gaps before release'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.guidelines WHERE id=ap.guideline_id AND status='active') THEN RAISE EXCEPTION 'Guidelines changed; the response must be reviewed again'; END IF;
  SELECT fingerprint INTO latest_fp FROM public.drafts WHERE case_id=_case_id ORDER BY version_number DESC LIMIT 1;
  IF ap.fingerprint IS DISTINCT FROM latest_fp OR ap.draft_id IS DISTINCT FROM (SELECT id FROM public.drafts WHERE case_id=_case_id ORDER BY version_number DESC LIMIT 1) THEN RAISE EXCEPTION 'The draft changed after approval. It must be approved again.'; END IF;

  SELECT count(*) INTO bad FROM public.source_versions v JOIN public.sources s ON s.id=v.source_id WHERE v.id = ANY(ap.source_version_ids) AND (v.status <> 'approved' OR s.audience <> 'public');
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
  VALUES (CASE WHEN c.routing_note='staff_press_release' THEN 'press_release' WHEN c.kind='media' THEN 'media_response' ELSE 'other_messaging' END::public.memory_type,
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

COMMIT;
