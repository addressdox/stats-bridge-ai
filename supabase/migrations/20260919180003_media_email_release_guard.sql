BEGIN;

-- Only delivery metadata may change after release. The approved response,
-- references, identities, timestamps and memory linkage remain immutable.
-- Authenticated clients retain SELECT only; claim_media_email runs as its
-- permission-checked owner and finish_media_email is service-role-only.
CREATE OR REPLACE FUNCTION public.guard_release_delivery_update()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE delivery_fields text[]:=ARRAY['channel','delivery_state','email_started_at','email_attempted_at',
  'email_sent_at','email_provider_id','email_error','email_retry_safe'];
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'A released response cannot be removed'; END IF;
  IF (to_jsonb(NEW)-delivery_fields) IS DISTINCT FROM (to_jsonb(OLD)-delivery_fields) THEN
    RAISE EXCEPTION 'The approved response and its record are immutable';
  END IF;
  IF NEW.channel IS DISTINCT FROM OLD.channel AND NOT (OLD.channel='status_page' AND NEW.channel='email') THEN
    RAISE EXCEPTION 'Only an email delivery channel transition is allowed';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS releases_immutable ON public.releases;
CREATE TRIGGER releases_immutable BEFORE UPDATE OR DELETE ON public.releases
  FOR EACH ROW EXECUTE FUNCTION public.guard_release_delivery_update();

REVOKE UPDATE, DELETE ON public.releases FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_release_delivery_update() FROM PUBLIC, anon, authenticated;

COMMIT;
