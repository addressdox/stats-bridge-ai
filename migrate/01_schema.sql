--
-- PostgreSQL database dump
--

\restrict hoYtBD4bTicdej2ctLZSL0L2nNDXOXeG4vTZ0opR1MMsLNdtSuWOzICvgcID17h

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

-- COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: alert_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_severity AS ENUM (
    'information',
    'warning',
    'critical'
);


--
-- Name: alert_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_state AS ENUM (
    'open',
    'acknowledged',
    'resolved'
);


--
-- Name: answer_outcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.answer_outcome AS ENUM (
    'answered',
    'clarification',
    'gap',
    'escalated',
    'error'
);


--
-- Name: approval_basis; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.approval_basis AS ENUM (
    'official',
    'demonstration'
);


--
-- Name: approval_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.approval_status AS ENUM (
    'active',
    'void'
);


--
-- Name: audience; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audience AS ENUM (
    'public',
    'staff'
);


--
-- Name: audit_origin; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_origin AS ENUM (
    'screen',
    'api',
    'system'
);


--
-- Name: author_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.author_kind AS ENUM (
    'ai',
    'official'
);


--
-- Name: case_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.case_kind AS ENUM (
    'media',
    'public_escalation'
);


--
-- Name: case_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.case_status AS ENUM (
    'received',
    'draft_prepared',
    'in_review',
    'changes_requested',
    'approved',
    'released',
    'rejected'
);


--
-- Name: channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.channel AS ENUM (
    'web',
    'widget',
    'api'
);


--
-- Name: conversation_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.conversation_channel AS ENUM (
    'chat',
    'voice',
    'widget',
    'api'
);


--
-- Name: conversation_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.conversation_state AS ENUM (
    'active',
    'ended',
    'handed_off',
    'abandoned'
);


--
-- Name: delivery_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_state AS ENUM (
    'shown',
    'queued',
    'sent',
    'failed'
);


--
-- Name: draft_format; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.draft_format AS ENUM (
    'general_reply',
    'faq_answer',
    'short_media_statement'
);


--
-- Name: embedding_owner; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.embedding_owner AS ENUM (
    'passage',
    'observation',
    'memory_item'
);


--
-- Name: evidence_owner; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.evidence_owner AS ENUM (
    'answer',
    'draft',
    'memory_item'
);


--
-- Name: guideline_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.guideline_status AS ENUM (
    'draft',
    'active',
    'retired'
);


--
-- Name: handoff_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.handoff_reason AS ENUM (
    'visitor_request',
    'media',
    'sensitive',
    'unsupported',
    'low_confidence',
    'complaint',
    'other'
);


--
-- Name: handoff_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.handoff_state AS ENUM (
    'waiting',
    'accepted',
    'declined',
    'transferred',
    'closed'
);


--
-- Name: ingest_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ingest_state AS ENUM (
    'waiting',
    'done',
    'failed'
);


--
-- Name: ingestion_job_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ingestion_job_kind AS ENUM (
    'file',
    'url',
    'crawler'
);


--
-- Name: ingestion_job_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ingestion_job_state AS ENUM (
    'uploaded',
    'discovered',
    'extracting',
    'extracted',
    'needs_metadata',
    'needs_verification',
    'ready_for_approval',
    'approved',
    'failed',
    'superseded'
);


--
-- Name: memory_origin; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.memory_origin AS ENUM (
    'imported',
    'released_case'
);


--
-- Name: memory_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.memory_type AS ENUM (
    'media_response',
    'press_release',
    'official_statement',
    'faq',
    'other_messaging'
);


--
-- Name: reading_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reading_level AS ENUM (
    'short',
    'detailed'
);


--
-- Name: release_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.release_channel AS ENUM (
    'status_page',
    'email'
);


--
-- Name: reuse_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reuse_status AS ENUM (
    'reusable',
    'needs_review',
    'historical_only',
    'withdrawn'
);


--
-- Name: review_flag; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_flag AS ENUM (
    'none',
    'source_changed'
);


--
-- Name: review_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_reason AS ENUM (
    'media',
    'sensitive',
    'complex',
    'interpretation',
    'formal_approval',
    'ambiguous',
    'low_confidence',
    'gap'
);


--
-- Name: sentiment_label; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sentiment_label AS ENUM (
    'positive',
    'neutral',
    'negative',
    'frustrated'
);


--
-- Name: source_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.source_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'superseded',
    'withdrawn'
);


--
-- Name: source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.source_type AS ENUM (
    'statistical_release',
    'media_release',
    'methodology',
    'organisational_page',
    'faq_page',
    'other'
);


--
-- Name: staff_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.staff_role AS ENUM (
    'official',
    'administrator',
    'manager'
);


--
-- Name: turn_author; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.turn_author AS ENUM (
    'visitor',
    'assistant',
    'official',
    'system'
);


--
-- Name: urgency_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.urgency_level AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


--
-- Name: value_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.value_state AS ENUM (
    'reported',
    'missing',
    'suppressed',
    'not_applicable'
);


--
-- Name: void_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.void_reason AS ENUM (
    'edited',
    'source_withdrawn',
    'source_superseded',
    'manual'
);


--
-- Name: activate_guidelines(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_guidelines(_guideline_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE uid uuid := public.require_access('guidelines.activate','administrator'); st public.guideline_status; prev uuid;
BEGIN
  SELECT status INTO st FROM public.guidelines WHERE id=_guideline_id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'No such guideline version'; END IF;
  IF st <> 'draft' THEN RAISE EXCEPTION 'Only a draft version can be activated'; END IF;
  SELECT id INTO prev FROM public.guidelines WHERE status='active';
  IF prev IS NOT NULL THEN UPDATE public.guidelines SET status='retired', retired_at=now() WHERE id=prev; END IF;
  UPDATE public.guidelines SET status='active', activated_by=uid, activated_at=now() WHERE id=_guideline_id;
  PERFORM public.write_audit(uid,'guidelines_activated','guideline',_guideline_id,NULL,'draft','active',
    jsonb_build_object('retired',prev),'screen');
END; $$;


--
-- Name: approve_draft(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_draft(_draft_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: approve_source(uuid, public.approval_basis); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_source(_version_id uuid, _basis public.approval_basis DEFAULT 'demonstration'::public.approval_basis) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE uid uuid := public.require_access('sources.approve','administrator'); v record; superseded uuid;
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
  UPDATE public.source_versions SET status='approved', approved_by=uid, approved_at=now(), approval_basis=_basis WHERE id = _version_id;
  UPDATE public.sources SET current_version_id = _version_id WHERE id = v.source_id;
  superseded := v.supersedes_version_id;
  IF superseded IS NOT NULL THEN
    UPDATE public.source_versions SET status='superseded' WHERE id = superseded AND status='approved';
    PERFORM public.flag_source_change(superseded, 'source_superseded', uid);
  END IF;
  PERFORM public.write_audit(uid,'source_approved','source_version',_version_id,NULL,'pending','approved',
    jsonb_build_object('basis',_basis,'supersedes',superseded),'screen');
END; $$;


--
-- Name: assign_case(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_case(_case_id uuid, _owner uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: block_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  RAISE EXCEPTION 'This record cannot be changed or removed';
END;
$$;


--
-- Name: bump_rate_counter(text, timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_rate_counter(_key_hash text, _window_start timestamp with time zone, _limit integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE c int;
BEGIN
  INSERT INTO rate_counters(key_hash, window_start, count)
  VALUES (_key_hash, _window_start, 1)
  ON CONFLICT (key_hash, window_start) DO UPDATE SET count = rate_counters.count + 1
  RETURNING count INTO c;
  DELETE FROM rate_counters WHERE window_start < now() - interval '2 hours';
  RETURN c <= _limit;
END;
$$;


--
-- Name: capture_insight_snapshot(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.capture_insight_snapshot(_window_hours integer DEFAULT 24) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE ws timestamptz := now() - make_interval(hours => greatest(1, _window_hours)); id uuid; m jsonb;
BEGIN
  SELECT jsonb_build_object(
    'questions', (SELECT count(*) FROM answers WHERE created_at >= ws AND NOT is_demo_seed),
    'answered', (SELECT count(*) FROM answers WHERE created_at >= ws AND outcome='answered' AND NOT is_demo_seed),
    'gaps', (SELECT count(*) FROM answers WHERE created_at >= ws AND outcome='gap' AND NOT is_demo_seed),
    'escalated', (SELECT count(*) FROM answers WHERE created_at >= ws AND outcome='escalated' AND NOT is_demo_seed),
    'clarifications', (SELECT count(*) FROM answers WHERE created_at >= ws AND outcome='clarification' AND NOT is_demo_seed),
    'conversations', (SELECT count(*) FROM conversations WHERE started_at >= ws AND NOT is_demo),
    'handoffs', (SELECT count(*) FROM handoffs WHERE requested_at >= ws AND NOT is_demo),
    'cases_opened', (SELECT count(*) FROM cases WHERE received_at >= ws AND NOT is_demo_seed),
    'cases_released', (SELECT count(*) FROM cases WHERE released_at >= ws AND NOT is_demo_seed),
    'median_latency_ms', (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)) FROM answers WHERE created_at >= ws AND latency_ms IS NOT NULL),
    'approved_versions', (SELECT count(*) FROM source_versions WHERE status='approved'),
    'pending_versions', (SELECT count(*) FROM source_versions WHERE status='pending'),
    'unverified_figures', (SELECT count(*) FROM observations WHERE verified_at IS NULL),
    'embeddings', (SELECT count(*) FROM kb_embeddings)
  ) INTO m;
  INSERT INTO public.insight_snapshots (window_start, window_end, metrics)
  VALUES (ws, now(), m) RETURNING public.insight_snapshots.id INTO id;
  RETURN id;
END; $$;


--
-- Name: correct_routing(uuid, public.case_kind, public.review_reason[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.correct_routing(_case_id uuid, _kind public.case_kind, _reasons public.review_reason[], _note text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: erase_contacts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erase_contacts() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: flag_source_change(uuid, public.void_reason, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.flag_source_change(_version_id uuid, _reason public.void_reason, _actor uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: guard_profile_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_profile_role() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND current_setting('statbridge.role_change', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Roles are changed only by an administrator through set_role';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: has_permission(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_permission(_uid uuid, _permission text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    JOIN public.roles r ON r.id = ur.role_id AND r.is_active
    JOIN public.role_permissions rp ON rp.role_id = r.id
    WHERE p.id = _uid
      AND p.is_active
      AND rp.permission_key = _permission
  );
$$;


--
-- Name: has_staff_role(uuid, public.staff_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_staff_role(_uid uuid, _role public.staff_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.is_active AND p.role = _role);
$$;


--
-- Name: is_staff(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_staff(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.is_active);
$$;


--
-- Name: is_super_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _uid AND r.key = 'super_administrator' AND r.is_active AND p.is_active
  );
$$;


--
-- Name: next_case_reference(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_case_reference() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 'SB-' || to_char(now(),'YYYY') || '-' ||
         lpad((COALESCE((SELECT count(*) FROM public.cases WHERE received_at >= date_trunc('year', now())),0) + 1)::text, 4, '0');
$$;


--
-- Name: open_case(public.case_kind, text, public.review_reason[], text, public.channel, uuid, text, text, text, boolean, timestamp with time zone, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_case(_kind public.case_kind, _question text, _reasons public.review_reason[], _token_hash text, _channel public.channel DEFAULT 'web'::public.channel, _origin_answer uuid DEFAULT NULL::uuid, _name text DEFAULT NULL::text, _outlet text DEFAULT NULL::text, _contact text DEFAULT NULL::text, _consent boolean DEFAULT false, _deadline timestamp with time zone DEFAULT NULL::timestamp with time zone, _notice text DEFAULT NULL::text, _is_demo boolean DEFAULT false) RETURNS TABLE(id uuid, reference text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: reject_case(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_case(_case_id uuid, _reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE uid uuid := public.require_role('official'); st public.case_status;
BEGIN
  IF _reason IS NULL OR length(trim(_reason))=0 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT status INTO st FROM public.cases WHERE id=_case_id FOR UPDATE;
  IF st IS DISTINCT FROM 'in_review' THEN RAISE EXCEPTION 'The case must be in review'; END IF;
  UPDATE public.cases SET status='rejected', closed_reason=_reason WHERE id=_case_id;
  PERFORM public.write_audit(uid,'case_rejected','case',_case_id,_case_id,'in_review','rejected',
    jsonb_build_object('reason',_reason),'screen');
END; $$;


--
-- Name: reject_source(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_source(_version_id uuid, _reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE uid uuid := public.require_access('sources.approve','administrator'); st public.source_status;
BEGIN
  SELECT status INTO st FROM public.source_versions WHERE id=_version_id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'No such source version'; END IF;
  IF st <> 'pending' THEN RAISE EXCEPTION 'Only a pending version can be rejected'; END IF;
  UPDATE public.source_versions SET status='rejected', ingest_note=_reason WHERE id=_version_id;
  PERFORM public.write_audit(uid,'source_rejected','source_version',_version_id,NULL,'pending','rejected',
    jsonb_build_object('reason',_reason),'screen');
END; $$;


--
-- Name: release_draft(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_draft(_case_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: request_changes(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_changes(_case_id uuid, _instruction text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE uid uuid := public.require_role('official'); st public.case_status;
BEGIN
  IF _instruction IS NULL OR length(trim(_instruction))=0 THEN RAISE EXCEPTION 'An instruction is required'; END IF;
  SELECT status INTO st FROM public.cases WHERE id=_case_id FOR UPDATE;
  IF st IS DISTINCT FROM 'in_review' THEN RAISE EXCEPTION 'The case must be in review'; END IF;
  UPDATE public.cases SET status='changes_requested' WHERE id=_case_id;
  PERFORM public.write_audit(uid,'changes_requested','case',_case_id,_case_id,'in_review','changes_requested',
    jsonb_build_object('instruction',_instruction),'screen');
END; $$;


--
-- Name: require_access(text, public.staff_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_access(_permission text, _role public.staff_role DEFAULT NULL::public.staff_role) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not allowed: sign in first'; END IF;
  IF public.has_permission(uid, _permission) THEN RETURN uid; END IF;
  IF _role IS NOT NULL AND public.has_staff_role(uid, _role) THEN RETURN uid; END IF;
  RAISE EXCEPTION 'Not allowed: this action needs %', _permission;
END; $$;


--
-- Name: require_permission(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_permission(_permission text) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.has_permission(uid, _permission) THEN
    RAISE EXCEPTION 'Not allowed: this action needs %', _permission;
  END IF;
  RETURN uid;
END;
$$;


--
-- Name: require_role(public.staff_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_role(_role public.staff_role) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.has_staff_role(uid, _role) THEN
    RAISE EXCEPTION 'Not allowed: this action needs the % role', _role;
  END IF;
  RETURN uid;
END; $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: desk_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.desk_settings (
    id boolean DEFAULT true NOT NULL,
    desk_name text DEFAULT 'StatBridge — Statistics South Africa information desk'::text NOT NULL,
    support_email text,
    officer_phone text,
    officer_phone_label text DEFAULT 'Stats SA communications desk'::text NOT NULL,
    phone_handover_enabled boolean DEFAULT false NOT NULL,
    office_hours text DEFAULT 'Monday to Friday, 08:00–16:30'::text NOT NULL,
    time_zone text DEFAULT 'Africa/Johannesburg'::text NOT NULL,
    notify_email text,
    handover_response_minutes integer DEFAULT 5 NOT NULL,
    visitor_retention_days integer DEFAULT 365 NOT NULL,
    voice_enabled boolean DEFAULT true NOT NULL,
    widget_enabled boolean DEFAULT true NOT NULL,
    public_api_enabled boolean DEFAULT true NOT NULL,
    crawler_enabled boolean DEFAULT true NOT NULL,
    media_auto_escalate boolean DEFAULT true NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT desk_settings_handover_response_minutes_check CHECK (((handover_response_minutes >= 1) AND (handover_response_minutes <= 240))),
    CONSTRAINT desk_settings_id_check CHECK (id),
    CONSTRAINT desk_settings_visitor_retention_days_check CHECK (((visitor_retention_days >= 30) AND (visitor_retention_days <= 3650)))
);


--
-- Name: save_desk_settings(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_desk_settings(_patch jsonb) RETURNS public.desk_settings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE actor uuid; before_row jsonb; after_row public.desk_settings;
BEGIN
  actor := public.require_access('settings.manage','administrator');
  SELECT to_jsonb(d) INTO before_row FROM public.desk_settings d WHERE d.id;
  UPDATE public.desk_settings SET
    desk_name = COALESCE(_patch->>'desk_name', desk_name),
    support_email = CASE WHEN _patch ? 'support_email' THEN NULLIF(_patch->>'support_email','') ELSE support_email END,
    officer_phone = CASE WHEN _patch ? 'officer_phone' THEN NULLIF(_patch->>'officer_phone','') ELSE officer_phone END,
    officer_phone_label = COALESCE(NULLIF(_patch->>'officer_phone_label',''), officer_phone_label),
    phone_handover_enabled = COALESCE((_patch->>'phone_handover_enabled')::boolean, phone_handover_enabled),
    office_hours = COALESCE(NULLIF(_patch->>'office_hours',''), office_hours),
    time_zone = COALESCE(NULLIF(_patch->>'time_zone',''), time_zone),
    notify_email = CASE WHEN _patch ? 'notify_email' THEN NULLIF(_patch->>'notify_email','') ELSE notify_email END,
    handover_response_minutes = COALESCE((_patch->>'handover_response_minutes')::integer, handover_response_minutes),
    visitor_retention_days = COALESCE((_patch->>'visitor_retention_days')::integer, visitor_retention_days),
    voice_enabled = COALESCE((_patch->>'voice_enabled')::boolean, voice_enabled),
    widget_enabled = COALESCE((_patch->>'widget_enabled')::boolean, widget_enabled),
    public_api_enabled = COALESCE((_patch->>'public_api_enabled')::boolean, public_api_enabled),
    crawler_enabled = COALESCE((_patch->>'crawler_enabled')::boolean, crawler_enabled),
    media_auto_escalate = COALESCE((_patch->>'media_auto_escalate')::boolean, media_auto_escalate),
    updated_by = actor, updated_at = now()
  WHERE id RETURNING * INTO after_row;
  PERFORM public.write_audit(actor,'desk_settings_saved','desk_settings',NULL,NULL,
    left(before_row::text,2000), left(to_jsonb(after_row)::text,2000),
    jsonb_build_object('fields',(SELECT jsonb_agg(k) FROM jsonb_object_keys(_patch) AS k)),'screen'::public.audit_origin);
  RETURN after_row;
END; $$;


--
-- Name: save_draft(uuid, text, public.draft_format, public.reading_level, jsonb, text[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_draft(_case_id uuid, _body text, _format public.draft_format DEFAULT 'general_reply'::public.draft_format, _reading_level public.reading_level DEFAULT 'short'::public.reading_level, _parts jsonb DEFAULT '[]'::jsonb, _gaps text[] DEFAULT '{}'::text[], _adapted_from uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: search_knowledge_semantic(extensions.vector, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_knowledge_semantic(_embedding extensions.vector, _limit integer DEFAULT 12) RETURNS TABLE(owner_kind public.embedding_owner, owner_id uuid, source_version_id uuid, content text, similarity double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT e.owner_kind,
         e.owner_id,
         e.source_version_id,
         e.content,
         1 - (e.embedding <=> _embedding) AS similarity
  FROM public.kb_embeddings e
  JOIN public.source_versions sv ON sv.id = e.source_version_id
  WHERE sv.status = 'approved'
  ORDER BY e.embedding <=> _embedding
  LIMIT GREATEST(1, LEAST(_limit, 50));
$$;


--
-- Name: search_memory(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_memory(_q text, _limit integer DEFAULT 5) RETURNS TABLE(memory_id uuid, item_type public.memory_type, title text, body text, topic text, communicated_on date, reference_period text, reuse_status public.reuse_status, approval_basis public.approval_basis, rank real)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT m.id, m.item_type, m.title, m.body, m.topic, m.communicated_on, m.reference_period,
         m.reuse_status, m.approval_basis,
         ts_rank(m.search_text, websearch_to_tsquery('english', _q)) AS rank
    FROM memory_items m
   WHERE m.reuse_status IN ('reusable','needs_review')
     AND m.search_text @@ websearch_to_tsquery('english', _q)
   ORDER BY rank DESC, m.communicated_on DESC
   LIMIT greatest(1, least(_limit, 20));
$$;


--
-- Name: search_observations(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_observations(_q text, _limit integer DEFAULT 12) RETURNS TABLE(observation_id uuid, measure text, measure_key text, display_value text, value numeric, value_state public.value_state, unit text, geography text, population text, reference_period text, period_start date, period_end date, adjustment text, reported_change text, comparability_note text, page_number integer, table_label text, source_version_id uuid, version_label text, published_on date, original_url text, title text, publisher text, rank real)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', _q) AS strict_q,
           (SELECT to_tsquery('english', string_agg(lexeme, ' | '))
              FROM (SELECT unnest(tsvector_to_array(to_tsvector('english', _q))) AS lexeme) words) AS any_q
  ),
  docs AS (
    SELECT o.id, o.measure, o.measure_key, o.display_value, o.value, o.value_state, o.unit,
           o.geography, o.population, o.reference_period, o.period_start, o.period_end,
           o.adjustment, o.reported_change, o.comparability_note, o.page_number, o.table_label,
           v.id AS source_version_id, v.version_label, v.published_on, v.original_url,
           s.title, s.publisher,
           to_tsvector('english',
             o.measure || ' ' || o.geography || ' ' || coalesce(o.population,'') || ' ' ||
             o.reference_period || ' ' || coalesce(o.adjustment,'') || ' ' || s.title) AS doc
      FROM observations o
      JOIN source_versions v ON v.id = o.source_version_id
      JOIN sources s ON s.id = v.source_id
     WHERE v.status = 'approved'
       AND s.audience = 'public'
       AND o.verified_at IS NOT NULL
  )
  SELECT d.id, d.measure, d.measure_key, d.display_value, d.value, d.value_state, d.unit,
         d.geography, d.population, d.reference_period, d.period_start, d.period_end,
         d.adjustment, d.reported_change, d.comparability_note, d.page_number, d.table_label,
         d.source_version_id, d.version_label, d.published_on, d.original_url,
         d.title, d.publisher,
         ts_rank(d.doc, q.strict_q) AS rank
    FROM docs d CROSS JOIN q
   WHERE (d.doc @@ q.strict_q OR (q.any_q IS NOT NULL AND d.doc @@ q.any_q))
   ORDER BY (d.doc @@ q.strict_q) DESC, ts_rank(d.doc, q.strict_q) DESC,
            d.period_end DESC NULLS LAST
   LIMIT greatest(1, least(_limit, 40));
$$;


--
-- Name: search_observations_by_id(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_observations_by_id(_ids uuid[]) RETURNS TABLE(observation_id uuid, measure text, measure_key text, display_value text, value numeric, value_state public.value_state, unit text, geography text, population text, reference_period text, period_start date, period_end date, adjustment text, reported_change text, comparability_note text, page_number integer, table_label text, source_version_id uuid, version_label text, published_on date, original_url text, title text, publisher text, rank real)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT o.id, o.measure, o.measure_key, o.display_value, o.value, o.value_state, o.unit,
         o.geography, o.population, o.reference_period, o.period_start, o.period_end,
         o.adjustment, o.reported_change, o.comparability_note, o.page_number, o.table_label,
         v.id, v.version_label, v.published_on, v.original_url,
         s.title, s.publisher, 0::real
    FROM observations o
    JOIN source_versions v ON v.id = o.source_version_id
    JOIN sources s ON s.id = v.source_id
   WHERE o.id = ANY(_ids)
     AND v.status = 'approved'
     AND s.audience = 'public'
     AND o.verified_at IS NOT NULL
   LIMIT 20;
$$;


--
-- Name: search_passages(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_passages(_q text, _limit integer DEFAULT 12) RETURNS TABLE(passage_id uuid, content text, page_number integer, section_label text, source_version_id uuid, version_label text, published_on date, reference_period text, original_url text, source_id uuid, title text, publisher text, source_type public.source_type, topic text, rank real)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', _q) AS strict_q,
           (SELECT to_tsquery('english', string_agg(lexeme, ' | '))
              FROM (SELECT unnest(tsvector_to_array(to_tsvector('english', _q))) AS lexeme) words) AS any_q
  ),
  docs AS (
    SELECT p.id, p.content, p.page_number, p.section_label,
           v.id AS source_version_id, v.version_label, v.published_on, v.reference_period, v.original_url,
           s.id AS source_id, s.title, s.publisher, s.source_type, s.topic,
           p.search_text AS doc
      FROM passages p
      JOIN source_versions v ON v.id = p.source_version_id
      JOIN sources s ON s.id = v.source_id
     WHERE v.status = 'approved'
       AND s.audience = 'public'
  )
  SELECT d.id, d.content, d.page_number, d.section_label,
         d.source_version_id, d.version_label, d.published_on, d.reference_period, d.original_url,
         d.source_id, d.title, d.publisher, d.source_type, d.topic,
         ts_rank(d.doc, q.strict_q) AS rank
    FROM docs d CROSS JOIN q
   WHERE (d.doc @@ q.strict_q OR (q.any_q IS NOT NULL AND d.doc @@ q.any_q))
   ORDER BY (d.doc @@ q.strict_q) DESC, ts_rank(d.doc, q.strict_q) DESC,
            d.published_on DESC NULLS LAST
   LIMIT greatest(1, least(_limit, 40));
$$;


--
-- Name: search_passages_by_id(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_passages_by_id(_ids uuid[]) RETURNS TABLE(passage_id uuid, content text, page_number integer, section_label text, source_version_id uuid, version_label text, published_on date, reference_period text, original_url text, source_id uuid, title text, publisher text, source_type public.source_type, topic text, rank real)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p.id, p.content, p.page_number, p.section_label,
         v.id, v.version_label, v.published_on, v.reference_period, v.original_url,
         s.id, s.title, s.publisher, s.source_type, s.topic, 0::real
    FROM passages p
    JOIN source_versions v ON v.id = p.source_version_id
    JOIN sources s ON s.id = v.source_id
   WHERE p.id = ANY(_ids)
     AND v.status = 'approved'
     AND s.audience = 'public'
   LIMIT 20;
$$;


--
-- Name: set_alert_state(uuid, public.alert_state, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_alert_state(_alert_id uuid, _state public.alert_state, _note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE actor uuid := public.require_access('insights.manage','administrator');
BEGIN
  UPDATE public.insight_alerts SET
    state = _state,
    acknowledged_by = CASE WHEN _state='acknowledged' THEN actor ELSE acknowledged_by END,
    acknowledged_at = CASE WHEN _state='acknowledged' THEN now() ELSE acknowledged_at END,
    resolved_by = CASE WHEN _state='resolved' THEN actor ELSE resolved_by END,
    resolved_at = CASE WHEN _state='resolved' THEN now() ELSE resolved_at END
  WHERE id = _alert_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No such alert'; END IF;
  PERFORM public.write_audit(actor,'alert_'||_state::text,'insight_alert',_alert_id,NULL,NULL,_state::text,
    jsonb_build_object('note',_note),'screen');
END; $$;


--
-- Name: set_role(uuid, public.staff_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_role(_target uuid, _role public.staff_role) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE uid uuid := public.require_access('roles.manage','administrator'); old text;
BEGIN
  IF _target = uid THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  SELECT role::text INTO old FROM public.profiles WHERE id = _target;
  IF old IS NULL THEN RAISE EXCEPTION 'No such staff account'; END IF;
  PERFORM set_config('statbridge.role_change','on',true);
  UPDATE public.profiles SET role = _role WHERE id = _target;
  PERFORM set_config('statbridge.role_change','off',true);
  PERFORM public.write_audit(uid,'role_changed','profile',_target,NULL,old,_role::text,'{}'::jsonb,'screen');
END; $$;


--
-- Name: set_staff_active(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_staff_active(_target uuid, _active boolean, _reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE actor uuid := public.require_permission('staff.manage'); super_role uuid;
BEGIN
  IF _target = actor THEN RAISE EXCEPTION 'You cannot change your own account status'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT id INTO super_role FROM public.roles WHERE key='super_administrator';
  IF NOT _active AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_target AND role_id=super_role) AND
     (SELECT count(DISTINCT ur.user_id) FROM public.user_roles ur JOIN public.profiles p ON p.id=ur.user_id WHERE ur.role_id=super_role AND p.is_active) <= 1 THEN
    RAISE EXCEPTION 'The final active Super Administrator cannot be suspended';
  END IF;
  UPDATE public.profiles SET is_active=_active WHERE id=_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'No such staff account'; END IF;
  PERFORM public.write_audit(actor,CASE WHEN _active THEN 'staff_reactivated' ELSE 'staff_suspended' END,'profile',_target,NULL,NULL,NULL,jsonb_build_object('reason',_reason),'screen');
END;
$$;


--
-- Name: set_user_roles(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_roles(_target uuid, _role_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE actor uuid := public.require_permission('roles.manage'); super_role uuid; target_is_super boolean; new_is_super boolean;
BEGIN
  IF _target = actor THEN RAISE EXCEPTION 'You cannot change your own roles'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=_target) THEN RAISE EXCEPTION 'No such staff account'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_role_ids) x WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.id=x AND r.is_active)) THEN
    RAISE EXCEPTION 'One or more roles are invalid or inactive';
  END IF;
  SELECT id INTO super_role FROM public.roles WHERE key='super_administrator';
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_target AND role_id=super_role) INTO target_is_super;
  SELECT super_role = ANY(COALESCE(_role_ids,'{}'::uuid[])) INTO new_is_super;
  IF target_is_super AND NOT new_is_super AND
     (SELECT count(DISTINCT ur.user_id) FROM public.user_roles ur JOIN public.profiles p ON p.id=ur.user_id WHERE ur.role_id=super_role AND p.is_active) <= 1 THEN
    RAISE EXCEPTION 'The final active Super Administrator cannot be removed';
  END IF;
  DELETE FROM public.user_roles WHERE user_id=_target;
  INSERT INTO public.user_roles(user_id, role_id, granted_by)
  SELECT _target, x, actor FROM unnest(COALESCE(_role_ids,'{}'::uuid[])) x;
  PERFORM public.write_audit(actor,'staff_roles_changed','profile',_target,NULL,NULL,NULL,jsonb_build_object('role_ids',_role_ids),'screen');
END;
$$;


--
-- Name: staff_dashboard_summary(timestamp with time zone, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.staff_dashboard_summary(_since timestamp with time zone, _include_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE WHEN public.has_permission(auth.uid(),'dashboard.view') THEN jsonb_build_object(
    'generated_at', now(),
    'live_conversations', (SELECT count(*) FROM conversations WHERE state='active' AND (_include_demo OR NOT is_demo)),
    'waiting_handoffs', (SELECT count(*) FROM handoffs WHERE state='waiting' AND (_include_demo OR NOT is_demo)),
    'conversations', (SELECT count(*) FROM conversations WHERE started_at >= _since AND (_include_demo OR NOT is_demo)),
    'resolved', (SELECT count(*) FROM conversation_analysis ca JOIN conversations c ON c.id=ca.conversation_id WHERE ca.created_at >= _since AND ca.resolved AND (_include_demo OR NOT c.is_demo)),
    'average_seconds', (SELECT round(avg(duration_seconds)) FROM conversations WHERE started_at >= _since AND duration_seconds >= 0 AND (_include_demo OR NOT is_demo)),
    'open_cases', (SELECT count(*) FROM cases WHERE status IN ('received','draft_prepared','in_review','changes_requested') AND (_include_demo OR NOT is_demo_seed)),
    'overdue_cases', (SELECT count(*) FROM cases WHERE deadline_at < now() AND status IN ('received','draft_prepared','in_review','changes_requested') AND (_include_demo OR NOT is_demo_seed)),
    'coverage_gaps', (SELECT count(*) FROM answers WHERE outcome='gap' AND created_at >= _since AND (_include_demo OR NOT is_demo_seed)),
    'visitors', (SELECT count(*) FROM visitors WHERE _include_demo OR NOT is_demo),
    'pending_sources', (SELECT count(*) FROM source_versions WHERE status='pending'),
    'failed_ingestions', (SELECT count(*) FROM knowledge_ingestion_jobs WHERE state='failed'),
    'stale_sources', (SELECT count(*) FROM sources s JOIN source_versions v ON v.id=s.current_version_id WHERE v.published_on < current_date - 365),
    'passages', (SELECT count(*) FROM passages),
    'verified_observations', (SELECT count(*) FROM observations WHERE verified_at IS NOT NULL),
    'embeddings', (SELECT count(*) FROM kb_embeddings)
  ) ELSE NULL END;
$$;


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    draft_id uuid NOT NULL,
    fingerprint text NOT NULL,
    source_version_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    guideline_id uuid NOT NULL,
    approved_by uuid NOT NULL,
    approved_at timestamp with time zone DEFAULT now() NOT NULL,
    approval_basis public.approval_basis DEFAULT 'demonstration'::public.approval_basis NOT NULL,
    status public.approval_status DEFAULT 'active'::public.approval_status NOT NULL,
    voided_at timestamp with time zone,
    void_reason public.void_reason
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference text NOT NULL,
    kind public.case_kind NOT NULL,
    status public.case_status DEFAULT 'received'::public.case_status NOT NULL,
    review_reasons public.review_reason[] NOT NULL,
    question_text text NOT NULL,
    origin_answer_id uuid,
    follow_up_of_case_id uuid,
    channel public.channel DEFAULT 'web'::public.channel NOT NULL,
    requester_name text,
    requester_outlet text,
    requester_contact text,
    contact_consent boolean DEFAULT false NOT NULL,
    notice_version text,
    deadline_at timestamp with time zone,
    status_token_hash text NOT NULL,
    assigned_to uuid,
    routing_corrected_by uuid,
    routing_note text,
    closed_reason text,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    first_draft_at timestamp with time zone,
    approved_at timestamp with time zone,
    released_at timestamp with time zone,
    contact_erase_after date,
    is_demo_seed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT case_has_reason CHECK ((array_length(review_reasons, 1) >= 1))
);


--
-- Name: drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    version_number integer NOT NULL,
    format public.draft_format DEFAULT 'general_reply'::public.draft_format NOT NULL,
    reading_level public.reading_level DEFAULT 'short'::public.reading_level NOT NULL,
    body text NOT NULL,
    parts jsonb DEFAULT '[]'::jsonb NOT NULL,
    gaps text[] DEFAULT '{}'::text[] NOT NULL,
    guideline_id uuid NOT NULL,
    adapted_from_memory_item_id uuid,
    author_kind public.author_kind NOT NULL,
    author_id uuid,
    instruction text,
    fingerprint text NOT NULL,
    ai_provider text,
    ai_model text,
    prompt_version text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    role public.staff_role NOT NULL,
    is_demo boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: releases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.releases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    approval_id uuid NOT NULL,
    draft_id uuid NOT NULL,
    released_body text NOT NULL,
    released_references jsonb DEFAULT '[]'::jsonb NOT NULL,
    channel public.release_channel DEFAULT 'status_page'::public.release_channel NOT NULL,
    delivery_state public.delivery_state DEFAULT 'shown'::public.delivery_state NOT NULL,
    released_by uuid NOT NULL,
    released_at timestamp with time zone DEFAULT now() NOT NULL,
    memory_item_id uuid
);


--
-- Name: decision_record; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.decision_record WITH (security_invoker='true') AS
 SELECT r.id AS release_id,
    c.reference,
    c.kind,
    c.question_text,
    d.version_number AS released_version,
    d.author_kind AS first_author_kind,
    da.full_name AS drafted_by,
    ap.approved_by,
    aa.full_name AS approved_by_name,
    ap.approved_at,
    ap.approval_basis,
    ap.fingerprint,
    rb.full_name AS released_by_name,
    r.released_at,
    ap.source_version_ids,
    ap.guideline_id,
    r.memory_item_id,
    c.is_demo_seed
   FROM ((((((public.releases r
     JOIN public.cases c ON ((c.id = r.case_id)))
     JOIN public.drafts d ON ((d.id = r.draft_id)))
     JOIN public.approvals ap ON ((ap.id = r.approval_id)))
     LEFT JOIN public.profiles da ON ((da.id = d.author_id)))
     LEFT JOIN public.profiles aa ON ((aa.id = ap.approved_by)))
     LEFT JOIN public.profiles rb ON ((rb.id = r.released_by)))
  ORDER BY r.released_at DESC;


--
-- Name: staff_decision_record(timestamp with time zone, timestamp with time zone, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.staff_decision_record(_from timestamp with time zone DEFAULT NULL::timestamp with time zone, _to timestamp with time zone DEFAULT NULL::timestamp with time zone, _limit integer DEFAULT 50, _offset integer DEFAULT 0) RETURNS SETOF public.decision_record
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT d.* FROM public.decision_record d
  WHERE public.has_permission(auth.uid(),'audit.view')
    AND (_from IS NULL OR d.released_at >= _from)
    AND (_to IS NULL OR d.released_at < _to)
  ORDER BY d.released_at DESC
  LIMIT greatest(1,least(_limit,100)) OFFSET greatest(0,_offset);
$$;


--
-- Name: staff_insight_gaps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.staff_insight_gaps() RETURNS TABLE(topic text, gap_count bigint, most_recent timestamp with time zone, includes_demo_seed boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT g.topic, g.gap_count, g.most_recent, g.includes_demo_seed
  FROM public.insight_gaps g
  WHERE public.has_permission(auth.uid(),'insights.view');
$$;


--
-- Name: insight_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insight_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    window_start timestamp with time zone NOT NULL,
    window_end timestamp with time zone NOT NULL,
    metrics jsonb NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT insight_snapshots_check CHECK ((window_end > window_start))
);


--
-- Name: staff_insight_history(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.staff_insight_history(_limit integer DEFAULT 60) RETURNS SETOF public.insight_snapshots
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT * FROM public.insight_snapshots
   WHERE public.has_permission(auth.uid(),'insights.view')
   ORDER BY window_end DESC LIMIT greatest(1, least(_limit, 365));
$$;


--
-- Name: answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    public_ref text NOT NULL,
    api_version text DEFAULT 'v1'::text NOT NULL,
    site_id uuid,
    channel public.channel DEFAULT 'web'::public.channel NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    question_text text NOT NULL,
    parent_answer_id uuid,
    topic text,
    outcome public.answer_outcome NOT NULL,
    reading_level public.reading_level DEFAULT 'short'::public.reading_level NOT NULL,
    official_blocks jsonb DEFAULT '[]'::jsonb NOT NULL,
    ai_explanation text,
    caveats text[] DEFAULT '{}'::text[] NOT NULL,
    follow_ups text[] DEFAULT '{}'::text[] NOT NULL,
    clarification jsonb,
    gap_description text,
    review_reasons public.review_reason[] DEFAULT '{}'::public.review_reason[] NOT NULL,
    case_id uuid,
    guideline_id uuid,
    validation_result jsonb DEFAULT '{}'::jsonb NOT NULL,
    ai_provider text,
    ai_model text,
    prompt_version text,
    latency_ms integer,
    review_flag public.review_flag DEFAULT 'none'::public.review_flag NOT NULL,
    review_flag_reason text,
    is_demo_seed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: insight_topics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.insight_topics WITH (security_invoker='true') AS
 SELECT COALESCE(topic, 'unclassified'::text) AS topic,
    outcome,
    count(*) AS question_count,
    bool_or(is_demo_seed) AS includes_demo_seed,
    min(created_at) AS window_start,
    max(created_at) AS window_end
   FROM public.answers a
  GROUP BY COALESCE(topic, 'unclassified'::text), outcome;


--
-- Name: staff_insight_topics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.staff_insight_topics() RETURNS SETOF public.insight_topics
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT * FROM public.insight_topics WHERE public.has_permission(auth.uid(),'insights.view'); $$;


--
-- Name: insight_turnaround; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.insight_turnaround WITH (security_invoker='true') AS
 SELECT id AS case_id,
    reference,
    kind,
    received_at,
    released_at,
    deadline_at,
    is_demo_seed,
    (EXTRACT(epoch FROM (released_at - received_at)) / 3600.0) AS hours_to_release,
    ((released_at IS NOT NULL) AND (deadline_at IS NOT NULL) AND (released_at <= deadline_at)) AS met_deadline
   FROM public.cases c
  WHERE (kind = 'media'::public.case_kind);


--
-- Name: staff_insight_turnaround(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.staff_insight_turnaround() RETURNS SETOF public.insight_turnaround
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT * FROM public.insight_turnaround WHERE public.has_permission(auth.uid(),'insights.view') AND (hours_to_release IS NULL OR hours_to_release >= 0); $$;


--
-- Name: evidence_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evidence_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_kind public.evidence_owner NOT NULL,
    owner_id uuid NOT NULL,
    source_version_id uuid NOT NULL,
    passage_id uuid,
    observation_id uuid,
    statement text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: source_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id uuid NOT NULL,
    version_label text NOT NULL,
    published_on date,
    reference_period text,
    file_path text,
    original_url text,
    file_fingerprint text,
    page_count integer,
    ingest_state public.ingest_state DEFAULT 'waiting'::public.ingest_state NOT NULL,
    ingest_note text,
    status public.source_status DEFAULT 'pending'::public.source_status NOT NULL,
    approval_basis public.approval_basis,
    approved_by uuid,
    approved_at timestamp with time zone,
    supersedes_version_id uuid,
    change_note text,
    withdrawn_by uuid,
    withdrawn_at timestamp with time zone,
    withdrawal_reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT source_version_has_location CHECK (((file_path IS NOT NULL) OR (original_url IS NOT NULL)))
);


--
-- Name: review_queue; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.review_queue WITH (security_invoker='true') AS
 SELECT c.id AS case_id,
    c.reference,
    c.kind,
    c.status,
    c.review_reasons,
    c.question_text,
    c.deadline_at,
    c.received_at,
    c.channel,
    c.is_demo_seed,
    c.assigned_to,
    p.full_name AS assigned_to_name,
    d.version_number AS latest_draft_version,
    d.id AS latest_draft_id,
    ( SELECT count(*) AS count
           FROM public.drafts dd
          WHERE (dd.case_id = c.id)) AS draft_count,
    (EXISTS ( SELECT 1
           FROM public.approvals a
          WHERE ((a.case_id = c.id) AND (a.status = 'active'::public.approval_status)))) AS has_active_approval,
    (EXISTS ( SELECT 1
           FROM (public.evidence_links e
             JOIN public.source_versions v ON ((v.id = e.source_version_id)))
          WHERE ((e.owner_kind = 'draft'::public.evidence_owner) AND (e.owner_id = d.id) AND (v.status = ANY (ARRAY['withdrawn'::public.source_status, 'superseded'::public.source_status]))))) AS source_changed
   FROM ((public.cases c
     LEFT JOIN public.profiles p ON ((p.id = c.assigned_to)))
     LEFT JOIN LATERAL ( SELECT dd.id,
            dd.case_id,
            dd.version_number,
            dd.format,
            dd.reading_level,
            dd.body,
            dd.parts,
            dd.gaps,
            dd.guideline_id,
            dd.adapted_from_memory_item_id,
            dd.author_kind,
            dd.author_id,
            dd.instruction,
            dd.fingerprint,
            dd.ai_provider,
            dd.ai_model,
            dd.prompt_version,
            dd.created_at
           FROM public.drafts dd
          WHERE (dd.case_id = c.id)
          ORDER BY dd.version_number DESC
         LIMIT 1) d ON (true))
  WHERE (c.status <> ALL (ARRAY['released'::public.case_status, 'rejected'::public.case_status]))
  ORDER BY (c.deadline_at IS NULL), c.deadline_at, c.received_at;


--
-- Name: staff_review_queue(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.staff_review_queue() RETURNS SETOF public.review_queue
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT * FROM public.review_queue WHERE public.has_permission(auth.uid(),'cases.review'); $$;


--
-- Name: staff_role_of(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.staff_role_of(_uid uuid) RETURNS public.staff_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = _uid AND p.is_active;
$$;


--
-- Name: start_review(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_review(_case_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE uid uuid := public.require_role('official'); st public.case_status;
BEGIN
  SELECT status INTO st FROM public.cases WHERE id=_case_id FOR UPDATE;
  IF st IS DISTINCT FROM 'draft_prepared' THEN RAISE EXCEPTION 'A draft must be prepared before review starts'; END IF;
  UPDATE public.cases SET status='in_review', assigned_to=COALESCE(assigned_to, uid) WHERE id=_case_id;
  PERFORM public.write_audit(uid,'review_started','case',_case_id,_case_id,'draft_prepared','in_review','{}'::jsonb,'screen');
END; $$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: verify_observations(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_observations(_ids uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE actor uuid := public.require_access('sources.verify','administrator'); n integer;
BEGIN
  UPDATE public.observations SET verified_by = actor, verified_at = now()
   WHERE id = ANY(_ids) AND verified_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.write_audit(actor,'figures_verified','observation',NULL,NULL,NULL,NULL,
    jsonb_build_object('count',n,'ids',_ids),'screen');
  RETURN n;
END; $$;


--
-- Name: withdraw_source(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.withdraw_source(_version_id uuid, _reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE uid uuid := public.require_access('sources.approve','administrator'); v record;
BEGIN
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'A reason is required to withdraw a source'; END IF;
  SELECT * INTO v FROM public.source_versions WHERE id=_version_id FOR UPDATE;
  IF v IS NULL THEN RAISE EXCEPTION 'No such source version'; END IF;
  IF v.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved version can be withdrawn'; END IF;
  UPDATE public.source_versions SET status='withdrawn', withdrawn_by=uid, withdrawn_at=now(), withdrawal_reason=_reason WHERE id=_version_id;
  UPDATE public.sources SET current_version_id = NULL WHERE current_version_id = _version_id;
  PERFORM public.flag_source_change(_version_id, 'source_withdrawn', uid);
  PERFORM public.write_audit(uid,'source_withdrawn','source_version',_version_id,NULL,'approved','withdrawn',
    jsonb_build_object('reason',_reason),'screen');
END; $$;


--
-- Name: write_audit(uuid, text, text, uuid, uuid, text, text, jsonb, public.audit_origin); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.write_audit(_actor uuid, _action text, _entity_kind text, _entity_id uuid, _case_id uuid, _from text, _to text, _detail jsonb, _origin public.audit_origin) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.audit_events (actor_id, actor_role, action, entity_kind, entity_id, case_id, from_state, to_state, detail, origin)
  VALUES (_actor, (SELECT role::text FROM public.profiles WHERE id = _actor), _action, _entity_kind, _entity_id, _case_id, _from, _to, COALESCE(_detail,'{}'::jsonb), _origin);
END; $$;


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_id uuid,
    actor_role text,
    action text NOT NULL,
    entity_kind text NOT NULL,
    entity_id uuid,
    case_id uuid,
    from_state text,
    to_state text,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    origin public.audit_origin DEFAULT 'screen'::public.audit_origin NOT NULL
);


--
-- Name: conversation_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_analysis (
    conversation_id uuid NOT NULL,
    summary text NOT NULL,
    topic text,
    sentiment public.sentiment_label DEFAULT 'neutral'::public.sentiment_label NOT NULL,
    urgency public.urgency_level DEFAULT 'normal'::public.urgency_level NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    unmet_need text,
    key_points text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversation_turns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_turns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    author public.turn_author NOT NULL,
    author_profile_id uuid,
    body text NOT NULL,
    answer_id uuid,
    outcome public.answer_outcome,
    tools_used text[] DEFAULT '{}'::text[] NOT NULL,
    spoken boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visitor_id uuid,
    channel public.conversation_channel DEFAULT 'chat'::public.conversation_channel NOT NULL,
    state public.conversation_state DEFAULT 'active'::public.conversation_state NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    device text,
    page_url text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    duration_seconds integer,
    turn_count integer DEFAULT 0 NOT NULL,
    is_demo boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: guidelines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guidelines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_number integer NOT NULL,
    title text NOT NULL,
    terminology jsonb DEFAULT '[]'::jsonb NOT NULL,
    style_rules text,
    number_rules text,
    branding_rules text,
    messaging_rules text,
    status public.guideline_status DEFAULT 'draft'::public.guideline_status NOT NULL,
    approval_basis public.approval_basis DEFAULT 'demonstration'::public.approval_basis NOT NULL,
    activated_by uuid,
    activated_at timestamp with time zone,
    retired_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    identity_rules text,
    evidence_rules text,
    prohibited_claims text[] DEFAULT '{}'::text[] NOT NULL,
    required_phrases text[] DEFAULT '{}'::text[] NOT NULL,
    forbidden_phrases text[] DEFAULT '{}'::text[] NOT NULL,
    media_policy text,
    sensitive_topic_policy text,
    escalation_policy text,
    voice_rules text,
    multilingual_rules text,
    channel_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    example_responses jsonb DEFAULT '[]'::jsonb NOT NULL,
    change_summary text
);


--
-- Name: handoff_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.handoff_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    handoff_id uuid NOT NULL,
    actor_profile_id uuid,
    action text NOT NULL,
    detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: handoffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.handoffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    visitor_id uuid,
    case_id uuid,
    state public.handoff_state DEFAULT 'waiting'::public.handoff_state NOT NULL,
    reason public.handoff_reason DEFAULT 'visitor_request'::public.handoff_reason NOT NULL,
    urgency public.urgency_level DEFAULT 'normal'::public.urgency_level NOT NULL,
    topic text,
    summary text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_by uuid,
    accepted_at timestamp with time zone,
    declined_by uuid,
    declined_at timestamp with time zone,
    decline_reason text,
    transferred_to uuid,
    transferred_at timestamp with time zone,
    closed_at timestamp with time zone,
    is_demo boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    channel text DEFAULT 'chat'::text NOT NULL,
    offered_phone text,
    caller_phone text,
    phone_connect_offered boolean DEFAULT false NOT NULL
);


--
-- Name: insight_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insight_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_key text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    severity public.alert_severity NOT NULL,
    state public.alert_state DEFAULT 'open'::public.alert_state NOT NULL,
    metric_name text,
    metric_value numeric,
    threshold_value numeric,
    related_entity_kind text,
    related_entity_id uuid,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: insight_gaps; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.insight_gaps WITH (security_invoker='true') AS
 SELECT COALESCE(topic, 'unclassified'::text) AS topic,
    count(*) AS gap_count,
    max(created_at) AS most_recent,
    (array_agg(question_text ORDER BY created_at DESC))[1] AS recent_example,
    bool_or(is_demo_seed) AS includes_demo_seed
   FROM public.answers a
  WHERE (outcome = 'gap'::public.answer_outcome)
  GROUP BY COALESCE(topic, 'unclassified'::text);


--
-- Name: kb_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kb_embeddings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_kind public.embedding_owner NOT NULL,
    owner_id uuid NOT NULL,
    source_version_id uuid,
    content text NOT NULL,
    embedding extensions.vector(1536) NOT NULL,
    model text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_ingestion_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_ingestion_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    state public.ingestion_job_state NOT NULL,
    message text NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_ingestion_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_ingestion_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_version_id uuid,
    kind public.ingestion_job_kind NOT NULL,
    state public.ingestion_job_state NOT NULL,
    file_name text,
    mime_type text,
    file_size bigint,
    source_url text,
    storage_path text,
    checksum text,
    progress integer DEFAULT 0 NOT NULL,
    error_message text,
    detected_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_ingestion_jobs_file_size_check CHECK (((file_size IS NULL) OR (file_size >= 0))),
    CONSTRAINT knowledge_ingestion_jobs_progress_check CHECK (((progress >= 0) AND (progress <= 100)))
);


--
-- Name: memory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_type public.memory_type NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    search_text tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((title || ' '::text) || body))) STORED,
    topic text,
    audience public.audience DEFAULT 'public'::public.audience NOT NULL,
    communicated_on date NOT NULL,
    reference_period text,
    origin public.memory_origin NOT NULL,
    release_id uuid,
    original_url text,
    approval_basis public.approval_basis DEFAULT 'demonstration'::public.approval_basis NOT NULL,
    reuse_status public.reuse_status DEFAULT 'reusable'::public.reuse_status NOT NULL,
    review_flag_reason text,
    is_demo_seed boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.observations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_version_id uuid NOT NULL,
    passage_id uuid,
    measure text NOT NULL,
    measure_key text NOT NULL,
    value numeric,
    value_state public.value_state NOT NULL,
    display_value text NOT NULL,
    unit text NOT NULL,
    population text,
    geography text NOT NULL,
    reference_period text NOT NULL,
    period_start date,
    period_end date,
    adjustment text,
    reported_change text,
    comparability_note text,
    page_number integer,
    table_label text,
    verified_by uuid,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT observation_value_matches_state CHECK ((((value_state = 'reported'::public.value_state) AND (value IS NOT NULL)) OR ((value_state <> 'reported'::public.value_state) AND (value IS NULL))))
);


--
-- Name: passages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_version_id uuid NOT NULL,
    "position" integer NOT NULL,
    page_number integer,
    section_label text,
    content text NOT NULL,
    search_text tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, content)) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    key text NOT NULL,
    group_name text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT permissions_key_check CHECK ((key ~ '^[a-z][a-z0-9_.]{2,95}$'::text))
);


--
-- Name: rate_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_counters (
    key_hash text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    count integer DEFAULT 0 NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_key text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT roles_key_check CHECK ((key ~ '^[a-z][a-z0-9_]{2,63}$'::text))
);


--
-- Name: sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    source_type public.source_type NOT NULL,
    publisher text DEFAULT 'Statistics South Africa'::text NOT NULL,
    audience public.audience DEFAULT 'public'::public.audience NOT NULL,
    topic text,
    canonical_url text,
    current_version_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_checked_at timestamp with time zone,
    last_changed_at timestamp with time zone
);


--
-- Name: COLUMN sources.last_checked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sources.last_checked_at IS 'When the crawler last looked at this publication listing.';


--
-- Name: COLUMN sources.last_changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sources.last_changed_at IS 'When a new or changed version of this publication was last seen.';


--
-- Name: staff_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    role public.staff_role DEFAULT 'official'::public.staff_role NOT NULL,
    invited_by uuid,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    role_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    accepted_by uuid,
    CONSTRAINT staff_invitations_status_valid CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: visitor_identifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitor_identifiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visitor_id uuid NOT NULL,
    kind text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT visitor_identifiers_kind_check CHECK ((kind = ANY (ARRAY['browser_token'::text, 'email'::text, 'phone'::text])))
);


--
-- Name: visitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text,
    email text,
    phone text,
    address text,
    organisation text,
    preferred_language text DEFAULT 'en'::text NOT NULL,
    consent_given boolean DEFAULT false NOT NULL,
    consent_at timestamp with time zone,
    notes text,
    is_demo boolean DEFAULT false NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    conversation_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: widget_sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.widget_sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_key text NOT NULL,
    name text NOT NULL,
    allowed_origins text[] DEFAULT '{}'::text[] NOT NULL,
    accent_colour text,
    "position" text,
    default_language text DEFAULT 'en'::text,
    opening_text text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: answers answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_pkey PRIMARY KEY (id);


--
-- Name: answers answers_public_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_public_ref_key UNIQUE (public_ref);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: cases cases_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_reference_key UNIQUE (reference);


--
-- Name: conversation_analysis conversation_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_analysis
    ADD CONSTRAINT conversation_analysis_pkey PRIMARY KEY (conversation_id);


--
-- Name: conversation_turns conversation_turns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_turns
    ADD CONSTRAINT conversation_turns_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: desk_settings desk_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desk_settings
    ADD CONSTRAINT desk_settings_pkey PRIMARY KEY (id);


--
-- Name: drafts drafts_case_version_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_case_version_unique UNIQUE (case_id, version_number);


--
-- Name: drafts drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_pkey PRIMARY KEY (id);


--
-- Name: evidence_links evidence_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence_links
    ADD CONSTRAINT evidence_links_pkey PRIMARY KEY (id);


--
-- Name: guidelines guidelines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guidelines
    ADD CONSTRAINT guidelines_pkey PRIMARY KEY (id);


--
-- Name: guidelines guidelines_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guidelines
    ADD CONSTRAINT guidelines_version_number_key UNIQUE (version_number);


--
-- Name: handoff_events handoff_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoff_events
    ADD CONSTRAINT handoff_events_pkey PRIMARY KEY (id);


--
-- Name: handoffs handoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoffs
    ADD CONSTRAINT handoffs_pkey PRIMARY KEY (id);


--
-- Name: insight_alerts insight_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insight_alerts
    ADD CONSTRAINT insight_alerts_pkey PRIMARY KEY (id);


--
-- Name: insight_snapshots insight_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insight_snapshots
    ADD CONSTRAINT insight_snapshots_pkey PRIMARY KEY (id);


--
-- Name: kb_embeddings kb_embeddings_owner_kind_owner_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_embeddings
    ADD CONSTRAINT kb_embeddings_owner_kind_owner_id_key UNIQUE (owner_kind, owner_id);


--
-- Name: kb_embeddings kb_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_embeddings
    ADD CONSTRAINT kb_embeddings_pkey PRIMARY KEY (id);


--
-- Name: knowledge_ingestion_events knowledge_ingestion_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_ingestion_events
    ADD CONSTRAINT knowledge_ingestion_events_pkey PRIMARY KEY (id);


--
-- Name: knowledge_ingestion_jobs knowledge_ingestion_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_ingestion_jobs
    ADD CONSTRAINT knowledge_ingestion_jobs_pkey PRIMARY KEY (id);


--
-- Name: memory_items memory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_items
    ADD CONSTRAINT memory_items_pkey PRIMARY KEY (id);


--
-- Name: observations observation_unique_fact; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations
    ADD CONSTRAINT observation_unique_fact UNIQUE (source_version_id, measure_key, geography, reference_period, population);


--
-- Name: observations observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations
    ADD CONSTRAINT observations_pkey PRIMARY KEY (id);


--
-- Name: passages passages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passages
    ADD CONSTRAINT passages_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (key);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rate_counters rate_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_counters
    ADD CONSTRAINT rate_counters_pkey PRIMARY KEY (key_hash, window_start);


--
-- Name: releases releases_one_per_approval_channel; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releases
    ADD CONSTRAINT releases_one_per_approval_channel UNIQUE (approval_id, channel);


--
-- Name: releases releases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releases
    ADD CONSTRAINT releases_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_key);


--
-- Name: roles roles_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_key_key UNIQUE (key);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: source_versions source_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_versions
    ADD CONSTRAINT source_versions_pkey PRIMARY KEY (id);


--
-- Name: sources sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_pkey PRIMARY KEY (id);


--
-- Name: staff_invitations staff_invitations_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT staff_invitations_email_key UNIQUE (email);


--
-- Name: staff_invitations staff_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT staff_invitations_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);


--
-- Name: visitor_identifiers visitor_identifiers_kind_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_identifiers
    ADD CONSTRAINT visitor_identifiers_kind_value_key UNIQUE (kind, value);


--
-- Name: visitor_identifiers visitor_identifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_identifiers
    ADD CONSTRAINT visitor_identifiers_pkey PRIMARY KEY (id);


--
-- Name: visitors visitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_pkey PRIMARY KEY (id);


--
-- Name: widget_sites widget_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_sites
    ADD CONSTRAINT widget_sites_pkey PRIMARY KEY (id);


--
-- Name: widget_sites widget_sites_site_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_sites
    ADD CONSTRAINT widget_sites_site_key_key UNIQUE (site_key);


--
-- Name: answers_public_ref_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX answers_public_ref_idx ON public.answers USING btree (public_ref);


--
-- Name: answers_topic_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX answers_topic_time_idx ON public.answers USING btree (topic, created_at);


--
-- Name: approvals_one_active_per_case; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX approvals_one_active_per_case ON public.approvals USING btree (case_id) WHERE (status = 'active'::public.approval_status);


--
-- Name: audit_case_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_case_time_idx ON public.audit_events USING btree (case_id, occurred_at);


--
-- Name: cases_reference_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_reference_idx ON public.cases USING btree (reference);


--
-- Name: cases_status_deadline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_status_deadline_idx ON public.cases USING btree (status, deadline_at);


--
-- Name: conversation_turns_conv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_turns_conv_idx ON public.conversation_turns USING btree (conversation_id, created_at);


--
-- Name: conversations_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_started_idx ON public.conversations USING btree (started_at DESC);


--
-- Name: conversations_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_state_idx ON public.conversations USING btree (state);


--
-- Name: conversations_visitor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_visitor_idx ON public.conversations USING btree (visitor_id);


--
-- Name: evidence_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evidence_owner_idx ON public.evidence_links USING btree (owner_kind, owner_id);


--
-- Name: evidence_source_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evidence_source_version_idx ON public.evidence_links USING btree (source_version_id);


--
-- Name: guidelines_one_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX guidelines_one_active_idx ON public.guidelines USING btree (status) WHERE (status = 'active'::public.guideline_status);


--
-- Name: handoff_events_handoff_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX handoff_events_handoff_idx ON public.handoff_events USING btree (handoff_id, created_at);


--
-- Name: handoffs_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX handoffs_conversation_idx ON public.handoffs USING btree (conversation_id);


--
-- Name: handoffs_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX handoffs_state_idx ON public.handoffs USING btree (state, requested_at DESC);


--
-- Name: insight_alerts_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insight_alerts_state_idx ON public.insight_alerts USING btree (state, severity, created_at DESC);


--
-- Name: insight_snapshots_window_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insight_snapshots_window_idx ON public.insight_snapshots USING btree (window_end DESC);


--
-- Name: kb_embeddings_vector_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kb_embeddings_vector_idx ON public.kb_embeddings USING hnsw (embedding extensions.vector_cosine_ops);


--
-- Name: kb_embeddings_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kb_embeddings_version_idx ON public.kb_embeddings USING btree (source_version_id);


--
-- Name: knowledge_ingestion_events_job_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_ingestion_events_job_idx ON public.knowledge_ingestion_events USING btree (job_id, created_at);


--
-- Name: knowledge_ingestion_jobs_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_ingestion_jobs_state_idx ON public.knowledge_ingestion_jobs USING btree (state, created_at DESC);


--
-- Name: memory_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_search_idx ON public.memory_items USING gin (search_text);


--
-- Name: observations_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observations_lookup_idx ON public.observations USING btree (measure_key, geography, reference_period);


--
-- Name: passages_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX passages_search_idx ON public.passages USING gin (search_text);


--
-- Name: passages_version_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX passages_version_position_idx ON public.passages USING btree (source_version_id, "position");


--
-- Name: staff_invitations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_invitations_status_idx ON public.staff_invitations USING btree (status, created_at DESC);


--
-- Name: user_roles_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_roles_user_idx ON public.user_roles USING btree (user_id);


--
-- Name: visitor_identifiers_visitor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visitor_identifiers_visitor_idx ON public.visitor_identifiers USING btree (visitor_id);


--
-- Name: visitors_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visitors_email_idx ON public.visitors USING btree (lower(email)) WHERE (email IS NOT NULL);


--
-- Name: visitors_last_seen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visitors_last_seen_idx ON public.visitors USING btree (last_seen_at DESC);


--
-- Name: visitors_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visitors_phone_idx ON public.visitors USING btree (phone) WHERE (phone IS NOT NULL);


--
-- Name: audit_events audit_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_immutable BEFORE DELETE OR UPDATE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.block_change();


--
-- Name: conversations conversations_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER conversations_touch BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: drafts drafts_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER drafts_immutable BEFORE DELETE OR UPDATE ON public.drafts FOR EACH ROW EXECUTE FUNCTION public.block_change();


--
-- Name: evidence_links evidence_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER evidence_immutable BEFORE DELETE OR UPDATE ON public.evidence_links FOR EACH ROW EXECUTE FUNCTION public.block_change();


--
-- Name: handoffs handoffs_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handoffs_touch BEFORE UPDATE ON public.handoffs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: insight_alerts insight_alerts_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER insight_alerts_touch BEFORE UPDATE ON public.insight_alerts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: knowledge_ingestion_jobs knowledge_ingestion_jobs_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER knowledge_ingestion_jobs_touch BEFORE UPDATE ON public.knowledge_ingestion_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: passages passages_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER passages_immutable BEFORE DELETE OR UPDATE ON public.passages FOR EACH ROW EXECUTE FUNCTION public.block_change();


--
-- Name: profiles profiles_role_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_role_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();


--
-- Name: releases releases_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER releases_immutable BEFORE DELETE OR UPDATE ON public.releases FOR EACH ROW EXECUTE FUNCTION public.block_change();


--
-- Name: roles roles_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER roles_touch BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: visitors visitors_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER visitors_touch BEFORE UPDATE ON public.visitors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: answers answers_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id);


--
-- Name: answers answers_guideline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_guideline_id_fkey FOREIGN KEY (guideline_id) REFERENCES public.guidelines(id);


--
-- Name: answers answers_parent_answer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_parent_answer_id_fkey FOREIGN KEY (parent_answer_id) REFERENCES public.answers(id);


--
-- Name: answers answers_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.widget_sites(id);


--
-- Name: approvals approvals_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id);


--
-- Name: approvals approvals_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: approvals approvals_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id);


--
-- Name: approvals approvals_guideline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_guideline_id_fkey FOREIGN KEY (guideline_id) REFERENCES public.guidelines(id);


--
-- Name: audit_events audit_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id);


--
-- Name: audit_events audit_events_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;


--
-- Name: cases cases_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);


--
-- Name: cases cases_follow_up_of_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_follow_up_of_case_id_fkey FOREIGN KEY (follow_up_of_case_id) REFERENCES public.cases(id);


--
-- Name: cases cases_origin_answer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_origin_answer_fk FOREIGN KEY (origin_answer_id) REFERENCES public.answers(id);


--
-- Name: cases cases_routing_corrected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_routing_corrected_by_fkey FOREIGN KEY (routing_corrected_by) REFERENCES public.profiles(id);


--
-- Name: conversation_analysis conversation_analysis_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_analysis
    ADD CONSTRAINT conversation_analysis_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_turns conversation_turns_answer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_turns
    ADD CONSTRAINT conversation_turns_answer_id_fkey FOREIGN KEY (answer_id) REFERENCES public.answers(id) ON DELETE SET NULL;


--
-- Name: conversation_turns conversation_turns_author_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_turns
    ADD CONSTRAINT conversation_turns_author_profile_id_fkey FOREIGN KEY (author_profile_id) REFERENCES public.profiles(id);


--
-- Name: conversation_turns conversation_turns_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_turns
    ADD CONSTRAINT conversation_turns_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_visitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES public.visitors(id) ON DELETE SET NULL;


--
-- Name: desk_settings desk_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desk_settings
    ADD CONSTRAINT desk_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: drafts drafts_adapted_from_memory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_adapted_from_memory_item_id_fkey FOREIGN KEY (adapted_from_memory_item_id) REFERENCES public.memory_items(id);


--
-- Name: drafts drafts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id);


--
-- Name: drafts drafts_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: drafts drafts_guideline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_guideline_id_fkey FOREIGN KEY (guideline_id) REFERENCES public.guidelines(id);


--
-- Name: evidence_links evidence_links_observation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence_links
    ADD CONSTRAINT evidence_links_observation_id_fkey FOREIGN KEY (observation_id) REFERENCES public.observations(id) ON DELETE SET NULL;


--
-- Name: evidence_links evidence_links_passage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence_links
    ADD CONSTRAINT evidence_links_passage_id_fkey FOREIGN KEY (passage_id) REFERENCES public.passages(id) ON DELETE SET NULL;


--
-- Name: evidence_links evidence_links_source_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence_links
    ADD CONSTRAINT evidence_links_source_version_id_fkey FOREIGN KEY (source_version_id) REFERENCES public.source_versions(id) ON DELETE CASCADE;


--
-- Name: guidelines guidelines_activated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guidelines
    ADD CONSTRAINT guidelines_activated_by_fkey FOREIGN KEY (activated_by) REFERENCES public.profiles(id);


--
-- Name: guidelines guidelines_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guidelines
    ADD CONSTRAINT guidelines_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: handoff_events handoff_events_actor_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoff_events
    ADD CONSTRAINT handoff_events_actor_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profiles(id);


--
-- Name: handoff_events handoff_events_handoff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoff_events
    ADD CONSTRAINT handoff_events_handoff_id_fkey FOREIGN KEY (handoff_id) REFERENCES public.handoffs(id) ON DELETE CASCADE;


--
-- Name: handoffs handoffs_accepted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoffs
    ADD CONSTRAINT handoffs_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.profiles(id);


--
-- Name: handoffs handoffs_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoffs
    ADD CONSTRAINT handoffs_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;


--
-- Name: handoffs handoffs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoffs
    ADD CONSTRAINT handoffs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: handoffs handoffs_declined_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoffs
    ADD CONSTRAINT handoffs_declined_by_fkey FOREIGN KEY (declined_by) REFERENCES public.profiles(id);


--
-- Name: handoffs handoffs_transferred_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoffs
    ADD CONSTRAINT handoffs_transferred_to_fkey FOREIGN KEY (transferred_to) REFERENCES public.profiles(id);


--
-- Name: handoffs handoffs_visitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoffs
    ADD CONSTRAINT handoffs_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES public.visitors(id) ON DELETE SET NULL;


--
-- Name: insight_alerts insight_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insight_alerts
    ADD CONSTRAINT insight_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.profiles(id);


--
-- Name: insight_alerts insight_alerts_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insight_alerts
    ADD CONSTRAINT insight_alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id);


--
-- Name: kb_embeddings kb_embeddings_source_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_embeddings
    ADD CONSTRAINT kb_embeddings_source_version_id_fkey FOREIGN KEY (source_version_id) REFERENCES public.source_versions(id) ON DELETE CASCADE;


--
-- Name: knowledge_ingestion_events knowledge_ingestion_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_ingestion_events
    ADD CONSTRAINT knowledge_ingestion_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id);


--
-- Name: knowledge_ingestion_events knowledge_ingestion_events_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_ingestion_events
    ADD CONSTRAINT knowledge_ingestion_events_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.knowledge_ingestion_jobs(id) ON DELETE CASCADE;


--
-- Name: knowledge_ingestion_jobs knowledge_ingestion_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_ingestion_jobs
    ADD CONSTRAINT knowledge_ingestion_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: knowledge_ingestion_jobs knowledge_ingestion_jobs_source_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_ingestion_jobs
    ADD CONSTRAINT knowledge_ingestion_jobs_source_version_id_fkey FOREIGN KEY (source_version_id) REFERENCES public.source_versions(id) ON DELETE CASCADE;


--
-- Name: memory_items memory_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_items
    ADD CONSTRAINT memory_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: memory_items memory_release_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_items
    ADD CONSTRAINT memory_release_fk FOREIGN KEY (release_id) REFERENCES public.releases(id);


--
-- Name: observations observations_passage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations
    ADD CONSTRAINT observations_passage_id_fkey FOREIGN KEY (passage_id) REFERENCES public.passages(id) ON DELETE SET NULL;


--
-- Name: observations observations_source_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations
    ADD CONSTRAINT observations_source_version_id_fkey FOREIGN KEY (source_version_id) REFERENCES public.source_versions(id) ON DELETE CASCADE;


--
-- Name: observations observations_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations
    ADD CONSTRAINT observations_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.profiles(id);


--
-- Name: passages passages_source_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passages
    ADD CONSTRAINT passages_source_version_id_fkey FOREIGN KEY (source_version_id) REFERENCES public.source_versions(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: releases releases_approval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releases
    ADD CONSTRAINT releases_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.approvals(id);


--
-- Name: releases releases_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releases
    ADD CONSTRAINT releases_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: releases releases_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releases
    ADD CONSTRAINT releases_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id);


--
-- Name: releases releases_memory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releases
    ADD CONSTRAINT releases_memory_item_id_fkey FOREIGN KEY (memory_item_id) REFERENCES public.memory_items(id);


--
-- Name: releases releases_released_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releases
    ADD CONSTRAINT releases_released_by_fkey FOREIGN KEY (released_by) REFERENCES public.profiles(id);


--
-- Name: role_permissions role_permissions_permission_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_key_fkey FOREIGN KEY (permission_key) REFERENCES public.permissions(key) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: roles roles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: source_versions source_versions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_versions
    ADD CONSTRAINT source_versions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id);


--
-- Name: source_versions source_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_versions
    ADD CONSTRAINT source_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: source_versions source_versions_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_versions
    ADD CONSTRAINT source_versions_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE CASCADE;


--
-- Name: source_versions source_versions_supersedes_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_versions
    ADD CONSTRAINT source_versions_supersedes_version_id_fkey FOREIGN KEY (supersedes_version_id) REFERENCES public.source_versions(id);


--
-- Name: source_versions source_versions_withdrawn_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_versions
    ADD CONSTRAINT source_versions_withdrawn_by_fkey FOREIGN KEY (withdrawn_by) REFERENCES public.profiles(id);


--
-- Name: sources sources_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: sources sources_current_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_current_version_fk FOREIGN KEY (current_version_id) REFERENCES public.source_versions(id);


--
-- Name: staff_invitations staff_invitations_accepted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT staff_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.profiles(id);


--
-- Name: staff_invitations staff_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT staff_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id);


--
-- Name: user_roles user_roles_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- Name: visitor_identifiers visitor_identifiers_visitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_identifiers
    ADD CONSTRAINT visitor_identifiers_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES public.visitors(id) ON DELETE CASCADE;


--
-- Name: guidelines admin add guidelines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin add guidelines" ON public.guidelines FOR INSERT TO authenticated WITH CHECK (public.has_staff_role(auth.uid(), 'administrator'::public.staff_role));


--
-- Name: source_versions admin add source versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin add source versions" ON public.source_versions FOR INSERT TO authenticated WITH CHECK (public.has_staff_role(auth.uid(), 'administrator'::public.staff_role));


--
-- Name: sources admin add sources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin add sources" ON public.sources FOR INSERT TO authenticated WITH CHECK (public.has_staff_role(auth.uid(), 'administrator'::public.staff_role));


--
-- Name: observations admin delete observations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin delete observations" ON public.observations FOR DELETE TO authenticated USING ((public.has_staff_role(auth.uid(), 'administrator'::public.staff_role) AND (EXISTS ( SELECT 1
   FROM public.source_versions v
  WHERE ((v.id = observations.source_version_id) AND (v.status = 'pending'::public.source_status))))));


--
-- Name: guidelines admin edit draft guidelines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin edit draft guidelines" ON public.guidelines FOR UPDATE TO authenticated USING ((public.has_staff_role(auth.uid(), 'administrator'::public.staff_role) AND (status = 'draft'::public.guideline_status)));


--
-- Name: observations admin edit observations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin edit observations" ON public.observations FOR UPDATE TO authenticated USING ((public.has_staff_role(auth.uid(), 'administrator'::public.staff_role) AND (EXISTS ( SELECT 1
   FROM public.source_versions v
  WHERE ((v.id = observations.source_version_id) AND (v.status = 'pending'::public.source_status))))));


--
-- Name: source_versions admin edit pending source versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin edit pending source versions" ON public.source_versions FOR UPDATE TO authenticated USING ((public.has_staff_role(auth.uid(), 'administrator'::public.staff_role) AND (status = 'pending'::public.source_status)));


--
-- Name: sources admin edit sources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin edit sources" ON public.sources FOR UPDATE TO authenticated USING (public.has_staff_role(auth.uid(), 'administrator'::public.staff_role));


--
-- Name: widget_sites admin edit widget sites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin edit widget sites" ON public.widget_sites FOR UPDATE TO authenticated USING (public.has_staff_role(auth.uid(), 'administrator'::public.staff_role));


--
-- Name: widget_sites admin manager read widget sites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manager read widget sites" ON public.widget_sites FOR SELECT TO authenticated USING ((public.has_staff_role(auth.uid(), 'administrator'::public.staff_role) OR public.has_staff_role(auth.uid(), 'manager'::public.staff_role)));


--
-- Name: observations admin write observations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin write observations" ON public.observations FOR INSERT TO authenticated WITH CHECK ((public.has_staff_role(auth.uid(), 'administrator'::public.staff_role) AND (EXISTS ( SELECT 1
   FROM public.source_versions v
  WHERE ((v.id = observations.source_version_id) AND (v.status = 'pending'::public.source_status))))));


--
-- Name: widget_sites admin write widget sites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin write widget sites" ON public.widget_sites FOR INSERT TO authenticated WITH CHECK (public.has_staff_role(auth.uid(), 'administrator'::public.staff_role));


--
-- Name: insight_alerts analysts read insight alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "analysts read insight alerts" ON public.insight_alerts FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'insights.view'::text));


--
-- Name: insight_snapshots analysts read insight snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "analysts read insight snapshots" ON public.insight_snapshots FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'insights.view'::text));


--
-- Name: insight_alerts analysts update insight alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "analysts update insight alerts" ON public.insight_alerts FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'insights.view'::text));


--
-- Name: answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

--
-- Name: approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_analysis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_analysis ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_turns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_turns ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: desk_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.desk_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: evidence_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.evidence_links ENABLE ROW LEVEL SECURITY;

--
-- Name: guidelines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guidelines ENABLE ROW LEVEL SECURITY;

--
-- Name: handoff_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.handoff_events ENABLE ROW LEVEL SECURITY;

--
-- Name: handoffs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.handoffs ENABLE ROW LEVEL SECURITY;

--
-- Name: insight_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insight_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: insight_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insight_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: kb_embeddings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kb_embeddings ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_ingestion_events knowledge staff add ingestion events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "knowledge staff add ingestion events" ON public.knowledge_ingestion_events FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'sources.upload'::text));


--
-- Name: knowledge_ingestion_jobs knowledge staff add ingestion jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "knowledge staff add ingestion jobs" ON public.knowledge_ingestion_jobs FOR INSERT TO authenticated WITH CHECK ((public.has_permission(auth.uid(), 'sources.upload'::text) AND (created_by = auth.uid())));


--
-- Name: knowledge_ingestion_events knowledge staff read ingestion events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "knowledge staff read ingestion events" ON public.knowledge_ingestion_events FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sources.view'::text));


--
-- Name: knowledge_ingestion_jobs knowledge staff read ingestion jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "knowledge staff read ingestion jobs" ON public.knowledge_ingestion_jobs FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sources.view'::text));


--
-- Name: knowledge_ingestion_jobs knowledge staff update ingestion jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "knowledge staff update ingestion jobs" ON public.knowledge_ingestion_jobs FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'sources.upload'::text));


--
-- Name: knowledge_ingestion_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_ingestion_events ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_ingestion_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_ingestion_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: memory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: observations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;

--
-- Name: approvals officials and managers read approvals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "officials and managers read approvals" ON public.approvals FOR SELECT TO authenticated USING ((public.has_staff_role(auth.uid(), 'official'::public.staff_role) OR public.has_staff_role(auth.uid(), 'manager'::public.staff_role)));


--
-- Name: cases officials and managers read cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "officials and managers read cases" ON public.cases FOR SELECT TO authenticated USING ((public.has_staff_role(auth.uid(), 'official'::public.staff_role) OR public.has_staff_role(auth.uid(), 'manager'::public.staff_role)));


--
-- Name: drafts officials and managers read drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "officials and managers read drafts" ON public.drafts FOR SELECT TO authenticated USING ((public.has_staff_role(auth.uid(), 'official'::public.staff_role) OR public.has_staff_role(auth.uid(), 'manager'::public.staff_role)));


--
-- Name: passages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.passages ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_counters rate counters are server only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rate counters are server only" ON public.rate_counters TO authenticated USING (false) WITH CHECK (false);


--
-- Name: rate_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: releases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_invitations role managers add staff invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "role managers add staff invitations" ON public.staff_invitations FOR INSERT TO authenticated WITH CHECK ((public.has_permission(auth.uid(), 'staff.manage'::text) AND (invited_by = auth.uid())));


--
-- Name: staff_invitations role managers read staff invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "role managers read staff invitations" ON public.staff_invitations FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'staff.view'::text));


--
-- Name: staff_invitations role managers update staff invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "role managers update staff invitations" ON public.staff_invitations FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'staff.manage'::text));


--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: source_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.source_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

--
-- Name: handoff_events staff add handoff events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff add handoff events" ON public.handoff_events FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));


--
-- Name: memory_items staff import memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff import memory" ON public.memory_items FOR INSERT TO authenticated WITH CHECK (((public.has_staff_role(auth.uid(), 'administrator'::public.staff_role) OR public.has_staff_role(auth.uid(), 'official'::public.staff_role)) AND (origin = 'imported'::public.memory_origin)));


--
-- Name: answers staff read answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read answers" ON public.answers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: audit_events staff read audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read audit" ON public.audit_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: conversation_analysis staff read conversation analysis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read conversation analysis" ON public.conversation_analysis FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: conversation_turns staff read conversation turns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read conversation turns" ON public.conversation_turns FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: conversations staff read conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read conversations" ON public.conversations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: desk_settings staff read desk settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read desk settings" ON public.desk_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: kb_embeddings staff read embeddings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read embeddings" ON public.kb_embeddings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: evidence_links staff read evidence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read evidence" ON public.evidence_links FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: guidelines staff read guidelines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read guidelines" ON public.guidelines FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: handoff_events staff read handoff events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read handoff events" ON public.handoff_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: handoffs staff read handoffs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read handoffs" ON public.handoffs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: staff_invitations staff read invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read invitations" ON public.staff_invitations FOR SELECT TO authenticated USING (public.has_staff_role(auth.uid(), 'administrator'::public.staff_role));


--
-- Name: memory_items staff read memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read memory" ON public.memory_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: observations staff read observations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read observations" ON public.observations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: user_roles staff read own or super admin read user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read own or super admin read user roles" ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_super_admin(auth.uid())));


--
-- Name: passages staff read passages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read passages" ON public.passages FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: permissions staff read permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read permissions" ON public.permissions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: profiles staff read profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: releases staff read releases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read releases" ON public.releases FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: role_permissions staff read role permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read role permissions" ON public.role_permissions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: roles staff read roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read roles" ON public.roles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: source_versions staff read source versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read source versions" ON public.source_versions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: sources staff read sources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read sources" ON public.sources FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: visitor_identifiers staff read visitor identifiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read visitor identifiers" ON public.visitor_identifiers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: visitors staff read visitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read visitors" ON public.visitors FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: handoffs staff update handoffs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff update handoffs" ON public.handoffs FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: staff_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions super admins add role permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "super admins add role permissions" ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));


--
-- Name: roles super admins add roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "super admins add roles" ON public.roles FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));


--
-- Name: user_roles super admins add user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "super admins add user roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));


--
-- Name: roles super admins edit roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "super admins edit roles" ON public.roles FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: role_permissions super admins remove role permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "super admins remove role permissions" ON public.role_permissions FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: user_roles super admins remove user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "super admins remove user roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: visitor_identifiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visitor_identifiers ENABLE ROW LEVEL SECURITY;

--
-- Name: visitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

--
-- Name: widget_sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.widget_sites ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION activate_guidelines(_guideline_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.activate_guidelines(_guideline_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.activate_guidelines(_guideline_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.activate_guidelines(_guideline_id uuid) TO service_role;


--
-- Name: FUNCTION approve_draft(_draft_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.approve_draft(_draft_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.approve_draft(_draft_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.approve_draft(_draft_id uuid) TO service_role;


--
-- Name: FUNCTION approve_source(_version_id uuid, _basis public.approval_basis); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.approve_source(_version_id uuid, _basis public.approval_basis) FROM PUBLIC;
GRANT ALL ON FUNCTION public.approve_source(_version_id uuid, _basis public.approval_basis) TO service_role;


--
-- Name: FUNCTION assign_case(_case_id uuid, _owner uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_case(_case_id uuid, _owner uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_case(_case_id uuid, _owner uuid) TO authenticated;
GRANT ALL ON FUNCTION public.assign_case(_case_id uuid, _owner uuid) TO service_role;


--
-- Name: FUNCTION block_change(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.block_change() TO anon;
GRANT ALL ON FUNCTION public.block_change() TO authenticated;
GRANT ALL ON FUNCTION public.block_change() TO service_role;


--
-- Name: FUNCTION bump_rate_counter(_key_hash text, _window_start timestamp with time zone, _limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.bump_rate_counter(_key_hash text, _window_start timestamp with time zone, _limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.bump_rate_counter(_key_hash text, _window_start timestamp with time zone, _limit integer) TO service_role;


--
-- Name: FUNCTION capture_insight_snapshot(_window_hours integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.capture_insight_snapshot(_window_hours integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.capture_insight_snapshot(_window_hours integer) TO service_role;


--
-- Name: FUNCTION correct_routing(_case_id uuid, _kind public.case_kind, _reasons public.review_reason[], _note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.correct_routing(_case_id uuid, _kind public.case_kind, _reasons public.review_reason[], _note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.correct_routing(_case_id uuid, _kind public.case_kind, _reasons public.review_reason[], _note text) TO authenticated;
GRANT ALL ON FUNCTION public.correct_routing(_case_id uuid, _kind public.case_kind, _reasons public.review_reason[], _note text) TO service_role;


--
-- Name: FUNCTION erase_contacts(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.erase_contacts() FROM PUBLIC;
GRANT ALL ON FUNCTION public.erase_contacts() TO service_role;


--
-- Name: FUNCTION flag_source_change(_version_id uuid, _reason public.void_reason, _actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.flag_source_change(_version_id uuid, _reason public.void_reason, _actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.flag_source_change(_version_id uuid, _reason public.void_reason, _actor uuid) TO service_role;


--
-- Name: FUNCTION guard_profile_role(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guard_profile_role() TO anon;
GRANT ALL ON FUNCTION public.guard_profile_role() TO authenticated;
GRANT ALL ON FUNCTION public.guard_profile_role() TO service_role;


--
-- Name: FUNCTION has_permission(_uid uuid, _permission text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_permission(_uid uuid, _permission text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_permission(_uid uuid, _permission text) TO authenticated;
GRANT ALL ON FUNCTION public.has_permission(_uid uuid, _permission text) TO service_role;


--
-- Name: FUNCTION has_staff_role(_uid uuid, _role public.staff_role); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_staff_role(_uid uuid, _role public.staff_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_staff_role(_uid uuid, _role public.staff_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_staff_role(_uid uuid, _role public.staff_role) TO service_role;


--
-- Name: FUNCTION is_staff(_uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_staff(_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_staff(_uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_staff(_uid uuid) TO service_role;


--
-- Name: FUNCTION is_super_admin(_uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_super_admin(_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_super_admin(_uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_super_admin(_uid uuid) TO service_role;


--
-- Name: FUNCTION next_case_reference(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.next_case_reference() FROM PUBLIC;
GRANT ALL ON FUNCTION public.next_case_reference() TO service_role;


--
-- Name: FUNCTION open_case(_kind public.case_kind, _question text, _reasons public.review_reason[], _token_hash text, _channel public.channel, _origin_answer uuid, _name text, _outlet text, _contact text, _consent boolean, _deadline timestamp with time zone, _notice text, _is_demo boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.open_case(_kind public.case_kind, _question text, _reasons public.review_reason[], _token_hash text, _channel public.channel, _origin_answer uuid, _name text, _outlet text, _contact text, _consent boolean, _deadline timestamp with time zone, _notice text, _is_demo boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.open_case(_kind public.case_kind, _question text, _reasons public.review_reason[], _token_hash text, _channel public.channel, _origin_answer uuid, _name text, _outlet text, _contact text, _consent boolean, _deadline timestamp with time zone, _notice text, _is_demo boolean) TO service_role;


--
-- Name: FUNCTION reject_case(_case_id uuid, _reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reject_case(_case_id uuid, _reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reject_case(_case_id uuid, _reason text) TO authenticated;
GRANT ALL ON FUNCTION public.reject_case(_case_id uuid, _reason text) TO service_role;


--
-- Name: FUNCTION reject_source(_version_id uuid, _reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reject_source(_version_id uuid, _reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reject_source(_version_id uuid, _reason text) TO service_role;


--
-- Name: FUNCTION release_draft(_case_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.release_draft(_case_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.release_draft(_case_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.release_draft(_case_id uuid) TO service_role;


--
-- Name: FUNCTION request_changes(_case_id uuid, _instruction text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.request_changes(_case_id uuid, _instruction text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.request_changes(_case_id uuid, _instruction text) TO authenticated;
GRANT ALL ON FUNCTION public.request_changes(_case_id uuid, _instruction text) TO service_role;


--
-- Name: FUNCTION require_access(_permission text, _role public.staff_role); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.require_access(_permission text, _role public.staff_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.require_access(_permission text, _role public.staff_role) TO service_role;


--
-- Name: FUNCTION require_permission(_permission text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.require_permission(_permission text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.require_permission(_permission text) TO service_role;


--
-- Name: FUNCTION require_role(_role public.staff_role); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.require_role(_role public.staff_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.require_role(_role public.staff_role) TO service_role;


--
-- Name: TABLE desk_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.desk_settings TO anon;
GRANT ALL ON TABLE public.desk_settings TO authenticated;
GRANT ALL ON TABLE public.desk_settings TO service_role;


--
-- Name: FUNCTION save_desk_settings(_patch jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_desk_settings(_patch jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_desk_settings(_patch jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.save_desk_settings(_patch jsonb) TO service_role;


--
-- Name: FUNCTION save_draft(_case_id uuid, _body text, _format public.draft_format, _reading_level public.reading_level, _parts jsonb, _gaps text[], _adapted_from uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_draft(_case_id uuid, _body text, _format public.draft_format, _reading_level public.reading_level, _parts jsonb, _gaps text[], _adapted_from uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_draft(_case_id uuid, _body text, _format public.draft_format, _reading_level public.reading_level, _parts jsonb, _gaps text[], _adapted_from uuid) TO authenticated;
GRANT ALL ON FUNCTION public.save_draft(_case_id uuid, _body text, _format public.draft_format, _reading_level public.reading_level, _parts jsonb, _gaps text[], _adapted_from uuid) TO service_role;


--
-- Name: FUNCTION search_knowledge_semantic(_embedding extensions.vector, _limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_knowledge_semantic(_embedding extensions.vector, _limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_knowledge_semantic(_embedding extensions.vector, _limit integer) TO service_role;


--
-- Name: FUNCTION search_memory(_q text, _limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_memory(_q text, _limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_memory(_q text, _limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_memory(_q text, _limit integer) TO service_role;


--
-- Name: FUNCTION search_observations(_q text, _limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_observations(_q text, _limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_observations(_q text, _limit integer) TO service_role;


--
-- Name: FUNCTION search_observations_by_id(_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_observations_by_id(_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_observations_by_id(_ids uuid[]) TO service_role;


--
-- Name: FUNCTION search_passages(_q text, _limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_passages(_q text, _limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_passages(_q text, _limit integer) TO service_role;


--
-- Name: FUNCTION search_passages_by_id(_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_passages_by_id(_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_passages_by_id(_ids uuid[]) TO service_role;


--
-- Name: FUNCTION set_alert_state(_alert_id uuid, _state public.alert_state, _note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_alert_state(_alert_id uuid, _state public.alert_state, _note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_alert_state(_alert_id uuid, _state public.alert_state, _note text) TO authenticated;
GRANT ALL ON FUNCTION public.set_alert_state(_alert_id uuid, _state public.alert_state, _note text) TO service_role;


--
-- Name: FUNCTION set_role(_target uuid, _role public.staff_role); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_role(_target uuid, _role public.staff_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_role(_target uuid, _role public.staff_role) TO service_role;


--
-- Name: FUNCTION set_staff_active(_target uuid, _active boolean, _reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_staff_active(_target uuid, _active boolean, _reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_staff_active(_target uuid, _active boolean, _reason text) TO authenticated;
GRANT ALL ON FUNCTION public.set_staff_active(_target uuid, _active boolean, _reason text) TO service_role;


--
-- Name: FUNCTION set_user_roles(_target uuid, _role_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_user_roles(_target uuid, _role_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_user_roles(_target uuid, _role_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.set_user_roles(_target uuid, _role_ids uuid[]) TO service_role;


--
-- Name: FUNCTION staff_dashboard_summary(_since timestamp with time zone, _include_demo boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.staff_dashboard_summary(_since timestamp with time zone, _include_demo boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.staff_dashboard_summary(_since timestamp with time zone, _include_demo boolean) TO authenticated;
GRANT ALL ON FUNCTION public.staff_dashboard_summary(_since timestamp with time zone, _include_demo boolean) TO service_role;


--
-- Name: TABLE approvals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.approvals TO anon;
GRANT ALL ON TABLE public.approvals TO authenticated;
GRANT ALL ON TABLE public.approvals TO service_role;


--
-- Name: TABLE cases; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cases TO anon;
GRANT ALL ON TABLE public.cases TO authenticated;
GRANT ALL ON TABLE public.cases TO service_role;


--
-- Name: TABLE drafts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.drafts TO anon;
GRANT ALL ON TABLE public.drafts TO authenticated;
GRANT ALL ON TABLE public.drafts TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE releases; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.releases TO anon;
GRANT ALL ON TABLE public.releases TO authenticated;
GRANT ALL ON TABLE public.releases TO service_role;


--
-- Name: TABLE decision_record; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.decision_record TO service_role;


--
-- Name: FUNCTION staff_decision_record(_from timestamp with time zone, _to timestamp with time zone, _limit integer, _offset integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.staff_decision_record(_from timestamp with time zone, _to timestamp with time zone, _limit integer, _offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.staff_decision_record(_from timestamp with time zone, _to timestamp with time zone, _limit integer, _offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.staff_decision_record(_from timestamp with time zone, _to timestamp with time zone, _limit integer, _offset integer) TO service_role;


--
-- Name: FUNCTION staff_insight_gaps(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.staff_insight_gaps() FROM PUBLIC;
GRANT ALL ON FUNCTION public.staff_insight_gaps() TO authenticated;
GRANT ALL ON FUNCTION public.staff_insight_gaps() TO service_role;


--
-- Name: TABLE insight_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.insight_snapshots TO anon;
GRANT ALL ON TABLE public.insight_snapshots TO authenticated;
GRANT ALL ON TABLE public.insight_snapshots TO service_role;


--
-- Name: FUNCTION staff_insight_history(_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.staff_insight_history(_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.staff_insight_history(_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.staff_insight_history(_limit integer) TO service_role;


--
-- Name: TABLE answers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.answers TO anon;
GRANT ALL ON TABLE public.answers TO authenticated;
GRANT ALL ON TABLE public.answers TO service_role;


--
-- Name: TABLE insight_topics; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.insight_topics TO service_role;


--
-- Name: FUNCTION staff_insight_topics(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.staff_insight_topics() FROM PUBLIC;
GRANT ALL ON FUNCTION public.staff_insight_topics() TO authenticated;
GRANT ALL ON FUNCTION public.staff_insight_topics() TO service_role;


--
-- Name: TABLE insight_turnaround; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.insight_turnaround TO service_role;


--
-- Name: FUNCTION staff_insight_turnaround(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.staff_insight_turnaround() FROM PUBLIC;
GRANT ALL ON FUNCTION public.staff_insight_turnaround() TO authenticated;
GRANT ALL ON FUNCTION public.staff_insight_turnaround() TO service_role;


--
-- Name: TABLE evidence_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.evidence_links TO anon;
GRANT ALL ON TABLE public.evidence_links TO authenticated;
GRANT ALL ON TABLE public.evidence_links TO service_role;


--
-- Name: TABLE source_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.source_versions TO anon;
GRANT ALL ON TABLE public.source_versions TO authenticated;
GRANT ALL ON TABLE public.source_versions TO service_role;


--
-- Name: TABLE review_queue; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.review_queue TO service_role;


--
-- Name: FUNCTION staff_review_queue(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.staff_review_queue() FROM PUBLIC;
GRANT ALL ON FUNCTION public.staff_review_queue() TO authenticated;
GRANT ALL ON FUNCTION public.staff_review_queue() TO service_role;


--
-- Name: FUNCTION staff_role_of(_uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.staff_role_of(_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.staff_role_of(_uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.staff_role_of(_uid uuid) TO service_role;


--
-- Name: FUNCTION start_review(_case_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.start_review(_case_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.start_review(_case_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.start_review(_case_id uuid) TO service_role;


--
-- Name: FUNCTION touch_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.touch_updated_at() TO anon;
GRANT ALL ON FUNCTION public.touch_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.touch_updated_at() TO service_role;


--
-- Name: FUNCTION verify_observations(_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.verify_observations(_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.verify_observations(_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.verify_observations(_ids uuid[]) TO service_role;


--
-- Name: FUNCTION withdraw_source(_version_id uuid, _reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.withdraw_source(_version_id uuid, _reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.withdraw_source(_version_id uuid, _reason text) TO service_role;


--
-- Name: FUNCTION write_audit(_actor uuid, _action text, _entity_kind text, _entity_id uuid, _case_id uuid, _from text, _to text, _detail jsonb, _origin public.audit_origin); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.write_audit(_actor uuid, _action text, _entity_kind text, _entity_id uuid, _case_id uuid, _from text, _to text, _detail jsonb, _origin public.audit_origin) FROM PUBLIC;
GRANT ALL ON FUNCTION public.write_audit(_actor uuid, _action text, _entity_kind text, _entity_id uuid, _case_id uuid, _from text, _to text, _detail jsonb, _origin public.audit_origin) TO service_role;


--
-- Name: TABLE audit_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_events TO anon;
GRANT ALL ON TABLE public.audit_events TO authenticated;
GRANT ALL ON TABLE public.audit_events TO service_role;


--
-- Name: TABLE conversation_analysis; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_analysis TO anon;
GRANT ALL ON TABLE public.conversation_analysis TO authenticated;
GRANT ALL ON TABLE public.conversation_analysis TO service_role;


--
-- Name: TABLE conversation_turns; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_turns TO anon;
GRANT ALL ON TABLE public.conversation_turns TO authenticated;
GRANT ALL ON TABLE public.conversation_turns TO service_role;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversations TO anon;
GRANT ALL ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;


--
-- Name: TABLE guidelines; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.guidelines TO anon;
GRANT ALL ON TABLE public.guidelines TO authenticated;
GRANT ALL ON TABLE public.guidelines TO service_role;


--
-- Name: TABLE handoff_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.handoff_events TO anon;
GRANT ALL ON TABLE public.handoff_events TO authenticated;
GRANT ALL ON TABLE public.handoff_events TO service_role;


--
-- Name: TABLE handoffs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.handoffs TO anon;
GRANT ALL ON TABLE public.handoffs TO authenticated;
GRANT ALL ON TABLE public.handoffs TO service_role;


--
-- Name: TABLE insight_alerts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.insight_alerts TO anon;
GRANT ALL ON TABLE public.insight_alerts TO authenticated;
GRANT ALL ON TABLE public.insight_alerts TO service_role;


--
-- Name: TABLE insight_gaps; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.insight_gaps TO service_role;


--
-- Name: TABLE kb_embeddings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.kb_embeddings TO anon;
GRANT ALL ON TABLE public.kb_embeddings TO authenticated;
GRANT ALL ON TABLE public.kb_embeddings TO service_role;


--
-- Name: TABLE knowledge_ingestion_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.knowledge_ingestion_events TO anon;
GRANT ALL ON TABLE public.knowledge_ingestion_events TO authenticated;
GRANT ALL ON TABLE public.knowledge_ingestion_events TO service_role;


--
-- Name: TABLE knowledge_ingestion_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.knowledge_ingestion_jobs TO anon;
GRANT ALL ON TABLE public.knowledge_ingestion_jobs TO authenticated;
GRANT ALL ON TABLE public.knowledge_ingestion_jobs TO service_role;


--
-- Name: TABLE memory_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.memory_items TO anon;
GRANT ALL ON TABLE public.memory_items TO authenticated;
GRANT ALL ON TABLE public.memory_items TO service_role;


--
-- Name: TABLE observations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.observations TO anon;
GRANT ALL ON TABLE public.observations TO authenticated;
GRANT ALL ON TABLE public.observations TO service_role;


--
-- Name: TABLE passages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.passages TO anon;
GRANT ALL ON TABLE public.passages TO authenticated;
GRANT ALL ON TABLE public.passages TO service_role;


--
-- Name: TABLE permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.permissions TO anon;
GRANT ALL ON TABLE public.permissions TO authenticated;
GRANT ALL ON TABLE public.permissions TO service_role;


--
-- Name: TABLE rate_counters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rate_counters TO anon;
GRANT ALL ON TABLE public.rate_counters TO authenticated;
GRANT ALL ON TABLE public.rate_counters TO service_role;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.role_permissions TO anon;
GRANT ALL ON TABLE public.role_permissions TO authenticated;
GRANT ALL ON TABLE public.role_permissions TO service_role;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.roles TO anon;
GRANT ALL ON TABLE public.roles TO authenticated;
GRANT ALL ON TABLE public.roles TO service_role;


--
-- Name: TABLE sources; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sources TO anon;
GRANT ALL ON TABLE public.sources TO authenticated;
GRANT ALL ON TABLE public.sources TO service_role;


--
-- Name: TABLE staff_invitations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.staff_invitations TO anon;
GRANT ALL ON TABLE public.staff_invitations TO authenticated;
GRANT ALL ON TABLE public.staff_invitations TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: TABLE visitor_identifiers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.visitor_identifiers TO anon;
GRANT ALL ON TABLE public.visitor_identifiers TO authenticated;
GRANT ALL ON TABLE public.visitor_identifiers TO service_role;


--
-- Name: TABLE visitors; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.visitors TO anon;
GRANT ALL ON TABLE public.visitors TO authenticated;
GRANT ALL ON TABLE public.visitors TO service_role;


--
-- Name: TABLE widget_sites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.widget_sites TO anon;
GRANT ALL ON TABLE public.widget_sites TO authenticated;
GRANT ALL ON TABLE public.widget_sites TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--

\unrestrict hoYtBD4bTicdej2ctLZSL0L2nNDXOXeG4vTZ0opR1MMsLNdtSuWOzICvgcID17h

