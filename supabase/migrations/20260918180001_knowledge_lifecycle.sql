-- Restore the guarded staff entry points. Internal helpers remain inaccessible.
-- Permission checks use the actual signed-in active staff member, never a caller-supplied actor.
BEGIN;

-- Repair seed pointers only where the already-approved version is unambiguous.
-- This does not approve content or populate human approval/verification fields.
UPDATE public.sources s SET current_version_id = approved.id
FROM (
  SELECT source_id, (array_agg(id))[1] AS id
  FROM public.source_versions WHERE status = 'approved'
  GROUP BY source_id HAVING count(*) = 1
) approved
WHERE s.id = approved.source_id AND s.current_version_id IS NULL;

CREATE OR REPLACE FUNCTION public.approve_source(_version_id uuid, _basis public.approval_basis DEFAULT 'demonstration')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_access('sources.approve'); v record; current_version uuid;
BEGIN
  SELECT * INTO v FROM public.source_versions WHERE id = _version_id FOR UPDATE;
  IF v IS NULL THEN RAISE EXCEPTION 'No such source version'; END IF;
  IF v.status <> 'pending' THEN RAISE EXCEPTION 'Only a pending version can be approved'; END IF;
  IF v.ingest_state <> 'done' THEN RAISE EXCEPTION 'The text of this version has not been loaded yet'; END IF;
  IF _basis IS NULL THEN RAISE EXCEPTION 'An approval basis is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.passages WHERE source_version_id = _version_id) THEN
    RAISE EXCEPTION 'This version has no passages to search';
  END IF;
  IF EXISTS (SELECT 1 FROM public.observations WHERE source_version_id = _version_id AND (verified_at IS NULL OR verified_by IS NULL)) THEN
    RAISE EXCEPTION 'Every recorded figure must be checked by a person before approval';
  END IF;
  SELECT current_version_id INTO current_version FROM public.sources WHERE id = v.source_id FOR UPDATE;
  IF v.supersedes_version_id IS NOT NULL THEN
    IF current_version IS DISTINCT FROM v.supersedes_version_id OR NOT EXISTS (
      SELECT 1 FROM public.source_versions WHERE id = v.supersedes_version_id AND source_id = v.source_id AND status = 'approved'
    ) THEN RAISE EXCEPTION 'The version being replaced changed. Refresh and upload a new replacement.'; END IF;
    UPDATE public.source_versions SET status = 'superseded' WHERE id = v.supersedes_version_id;
    PERFORM public.flag_source_change(v.supersedes_version_id, 'source_superseded', uid);
  END IF;
  UPDATE public.source_versions SET status = 'approved', approved_by = uid, approved_at = now(), approval_basis = _basis WHERE id = _version_id;
  UPDATE public.sources SET current_version_id = _version_id WHERE id = v.source_id;
  UPDATE public.knowledge_ingestion_jobs SET state = 'approved' WHERE source_version_id = _version_id;
  PERFORM public.write_audit(uid, 'source_approved', 'source_version', _version_id, NULL, 'pending', 'approved',
    jsonb_build_object('basis', _basis, 'supersedes', v.supersedes_version_id), 'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.reject_source(_version_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_access('sources.approve'); st public.source_status;
BEGIN
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT status INTO st FROM public.source_versions WHERE id = _version_id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'No such source version'; END IF;
  IF st <> 'pending' THEN RAISE EXCEPTION 'Only a pending version can be rejected'; END IF;
  UPDATE public.source_versions SET status = 'rejected', change_note = trim(_reason) WHERE id = _version_id;
  PERFORM public.write_audit(uid, 'source_rejected', 'source_version', _version_id, NULL, 'pending', 'rejected', jsonb_build_object('reason', trim(_reason)), 'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.withdraw_source(_version_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_access('sources.approve'); v record;
BEGIN
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO v FROM public.source_versions WHERE id = _version_id FOR UPDATE;
  IF v IS NULL THEN RAISE EXCEPTION 'No such source version'; END IF;
  IF v.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved version can be withdrawn'; END IF;
  UPDATE public.source_versions SET status = 'withdrawn', withdrawn_by = uid, withdrawn_at = now(), withdrawal_reason = trim(_reason) WHERE id = _version_id;
  UPDATE public.sources SET current_version_id = NULL WHERE current_version_id = _version_id;
  PERFORM public.flag_source_change(_version_id, 'source_withdrawn', uid);
  PERFORM public.write_audit(uid, 'source_withdrawn', 'source_version', _version_id, NULL, 'approved', 'withdrawn', jsonb_build_object('reason', trim(_reason)), 'screen');
END; $$;

REVOKE ALL ON FUNCTION public.approve_source(uuid, public.approval_basis) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_source(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_source(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_source(uuid, public.approval_basis) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_source(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_source(uuid, text) TO authenticated, service_role;

-- Seeded demonstration figures carried timestamps without a human reviewer.
-- A real authorised reviewer may now check them explicitly; no checks are inferred.
CREATE OR REPLACE FUNCTION public.verify_observations(_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := public.require_access('sources.verify'); n integer; requested integer;
BEGIN
  SELECT count(DISTINCT id) INTO requested FROM unnest(_ids) AS id;
  IF requested < 1 OR requested > 500 THEN RAISE EXCEPTION 'Choose between 1 and 500 figures to verify'; END IF;
  PERFORM v.id FROM public.source_versions v JOIN public.observations o ON o.source_version_id = v.id
    WHERE o.id = ANY(_ids) ORDER BY v.id FOR UPDATE OF v;
  IF (SELECT count(*) FROM public.observations o JOIN public.source_versions v ON v.id = o.source_version_id
      WHERE o.id = ANY(_ids) AND (
        v.status = 'pending' OR (v.status = 'approved' AND v.approval_basis = 'demonstration' AND (o.verified_at IS NULL OR o.verified_by IS NULL))
      ) AND EXISTS (SELECT 1 FROM public.passages p WHERE p.id = o.passage_id AND p.source_version_id = o.source_version_id)) <> requested THEN
    RAISE EXCEPTION 'Only pending figures or unchecked demonstration figures with linked evidence can be verified here';
  END IF;
  UPDATE public.observations SET verified_by = actor, verified_at = now()
    WHERE id = ANY(_ids) AND (verified_at IS NULL OR verified_by IS NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.write_audit(actor, 'figures_verified', 'observation', NULL, NULL, NULL, NULL,
    jsonb_build_object('count', n, 'ids', _ids), 'screen');
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.verify_observations(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_observations(uuid[]) TO authenticated, service_role;

-- Keep internal mutations behind the guarded lifecycle entry points, including
-- deployments where earlier helper privilege revocations were not retained.
REVOKE ALL ON FUNCTION public.flag_source_change(uuid, public.void_reason, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flag_source_change(uuid, public.void_reason, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.write_audit(uuid, text, text, uuid, uuid, text, text, jsonb, public.audit_origin) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit(uuid, text, text, uuid, uuid, text, text, jsonb, public.audit_origin) TO service_role;

COMMIT;
