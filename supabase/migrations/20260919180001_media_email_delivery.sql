BEGIN;

-- Delivery metadata belongs to the existing immutable approved release. Contact
-- details remain on cases so the existing retention job continues to remove them.
ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS email_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_provider_id text,
  ADD COLUMN IF NOT EXISTS email_error text,
  ADD COLUMN IF NOT EXISTS email_retry_safe boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.claim_media_email(_case_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := public.require_permission('cases.release'); c record; r record; ap record; d record; rel uuid;
BEGIN
  SELECT * INTO c FROM public.cases WHERE id=_case_id FOR UPDATE;
  IF c IS NULL OR c.kind <> 'media' THEN RAISE EXCEPTION 'No such media request'; END IF;
  IF NOT c.contact_consent THEN RAISE EXCEPTION 'Consent is required before sending a response'; END IF;
  IF c.requester_contact IS NULL OR c.requester_contact !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'This request does not contain a valid email address';
  END IF;
  SELECT * INTO r FROM public.releases WHERE case_id=_case_id ORDER BY released_at DESC LIMIT 1 FOR UPDATE;
  IF r IS NULL THEN
    -- Reuse all existing approval, latest-version, source and permission gates.
    rel := public.release_draft(_case_id);
    SELECT * INTO r FROM public.releases WHERE id=rel FOR UPDATE;
  END IF;
  IF r.delivery_state='sent' THEN
    RETURN jsonb_build_object('releaseId',r.id,'state','sent','claimed',false);
  END IF;
  SELECT * INTO ap FROM public.approvals WHERE id=r.approval_id AND status='active';
  SELECT * INTO d FROM public.drafts WHERE id=r.draft_id;
  IF ap IS NULL OR d IS NULL OR d.body IS DISTINCT FROM r.released_body OR ap.fingerprint IS DISTINCT FROM d.fingerprint
    OR ap.draft_id IS DISTINCT FROM (SELECT id FROM public.drafts WHERE case_id=_case_id ORDER BY version_number DESC LIMIT 1)
    OR cardinality(d.gaps)>0 THEN
    RAISE EXCEPTION 'The response no longer has a valid approval';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.guidelines WHERE id=ap.guideline_id AND status='active') THEN
    RAISE EXCEPTION 'Guidelines changed; the response must be reviewed again';
  END IF;
  IF EXISTS(SELECT 1 FROM public.source_versions v JOIN public.sources s ON s.id=v.source_id
    WHERE v.id=ANY(ap.source_version_ids) AND (v.status<>'approved' OR s.audience<>'public')) THEN
    RAISE EXCEPTION 'A supporting source was corrected or withdrawn. Sending is blocked.';
  END IF;
  IF r.delivery_state='queued' AND r.email_attempted_at > now()-interval '2 minutes' THEN
    RETURN jsonb_build_object('releaseId',r.id,'state','queued','claimed',false);
  END IF;
  -- The email service retains idempotency keys for 24 hours. An uncertain old
  -- attempt must be checked by an administrator, never blindly sent twice.
  IF NOT r.email_retry_safe AND r.email_started_at < now()-interval '23 hours' THEN
    RAISE EXCEPTION 'The earlier delivery could not be confirmed. Ask an administrator to check it before retrying.';
  END IF;
  UPDATE public.releases SET channel='email', delivery_state='queued', email_error=NULL,
    email_started_at=CASE WHEN email_retry_safe THEN now() ELSE COALESCE(email_started_at,now()) END,
    email_attempted_at=clock_timestamp(), email_retry_safe=false WHERE id=r.id RETURNING * INTO r;
  PERFORM public.write_audit(uid,'media_email_requested','release',r.id,_case_id,NULL,'queued','{}'::jsonb,'screen');
  RETURN jsonb_build_object('releaseId',r.id,'state','queued','claimed',true,'attemptedAt',r.email_attempted_at,
    'recipient',trim(c.requester_contact),'reference',c.reference,'body',r.released_body);
END; $$;

CREATE OR REPLACE FUNCTION public.finish_media_email(_release_id uuid, _attempted_at timestamptz,
  _state public.delivery_state, _provider_id text DEFAULT NULL, _error text DEFAULT NULL, _retry_safe boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
  IF _state NOT IN ('sent','failed') THEN RAISE EXCEPTION 'Invalid email delivery result'; END IF;
  SELECT * INTO r FROM public.releases WHERE id=_release_id FOR UPDATE;
  IF r IS NULL OR r.delivery_state<>'queued' OR r.email_attempted_at IS DISTINCT FROM _attempted_at THEN RETURN false; END IF;
  IF _state='sent' AND NULLIF(trim(_provider_id),'') IS NULL THEN RAISE EXCEPTION 'A delivery receipt is required'; END IF;
  UPDATE public.releases SET delivery_state=_state,
    email_sent_at=CASE WHEN _state='sent' THEN now() ELSE NULL END,
    email_provider_id=CASE WHEN _state='sent' THEN left(_provider_id,200) ELSE NULL END,
    email_error=CASE WHEN _state='failed' THEN left(_error,400) ELSE NULL END,
    email_retry_safe=CASE WHEN _state='sent' THEN false ELSE _retry_safe END WHERE id=_release_id;
  PERFORM public.write_audit(NULL,'media_email_'||_state::text,'release',r.id,r.case_id,'queued',_state::text,'{}'::jsonb,'system');
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.claim_media_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_media_email(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finish_media_email(uuid,timestamptz,public.delivery_state,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_media_email(uuid,timestamptz,public.delivery_state,text,text,boolean) TO service_role;

COMMIT;
