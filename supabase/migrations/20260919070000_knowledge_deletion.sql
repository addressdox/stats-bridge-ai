BEGIN;

ALTER TABLE public.source_versions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

-- An active version still needs its original. A deleted version keeps provenance
-- and citations after its private file is physically removed from Storage.
ALTER TABLE public.source_versions DROP CONSTRAINT source_version_has_location;
ALTER TABLE public.source_versions ADD CONSTRAINT source_version_has_location
  CHECK (file_path IS NOT NULL OR original_url IS NOT NULL OR deleted_at IS NOT NULL);

-- Removal excludes evidence immediately. Existing answers retain their citation
-- and audit records, while the server deletes the private original through Storage.
CREATE OR REPLACE FUNCTION public.delete_knowledge_source(_version_id uuid, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := public.require_access('sources.approve'); v record;
BEGIN
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'A deletion reason is required'; END IF;
  SELECT * INTO v FROM public.source_versions WHERE id = _version_id FOR UPDATE;
  IF v IS NULL THEN RAISE EXCEPTION 'No such source version'; END IF;
  IF v.deleted_at IS NULL THEN
    IF v.status = 'approved' THEN
      UPDATE public.source_versions SET status = 'withdrawn', withdrawn_by = actor,
        withdrawn_at = now(), withdrawal_reason = trim(_reason) WHERE id = _version_id;
      PERFORM public.flag_source_change(_version_id, 'source_withdrawn', actor);
    ELSIF v.status = 'pending' THEN
      UPDATE public.source_versions SET status = 'rejected', change_note = trim(_reason) WHERE id = _version_id;
    END IF;
    UPDATE public.sources SET current_version_id = NULL WHERE current_version_id = _version_id;
    UPDATE public.source_versions SET deleted_at = now(), deleted_by = actor WHERE id = _version_id;
    DELETE FROM public.kb_embeddings WHERE source_version_id = _version_id;
    PERFORM public.write_audit(actor, 'knowledge_source_deleted', 'source_version', _version_id,
      NULL, v.status::text, 'deleted', jsonb_build_object('reason', trim(_reason), 'original_pending_removal', v.file_path IS NOT NULL), 'screen');
  END IF;
  RETURN v.file_path;
END; $$;

CREATE OR REPLACE FUNCTION public.finalize_knowledge_deletion(_version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := public.require_access('sources.approve'); v record;
BEGIN
  SELECT * INTO v FROM public.source_versions WHERE id = _version_id FOR UPDATE;
  IF v IS NULL OR v.deleted_at IS NULL THEN RAISE EXCEPTION 'Remove the source from the library first'; END IF;
  -- Never clear a path while the original still exists. This check also protects
  -- the authenticated RPC from being used to bypass the server's Storage removal.
  IF v.file_path IS NOT NULL AND EXISTS (
    SELECT 1 FROM storage.objects WHERE bucket_id = 'knowledge-files' AND name = v.file_path
  ) THEN RAISE EXCEPTION 'The private original has not been removed yet'; END IF;
  UPDATE public.source_versions SET file_path = NULL WHERE id = _version_id;
  UPDATE public.knowledge_ingestion_jobs SET storage_path = NULL WHERE source_version_id = _version_id;
  PERFORM public.write_audit(actor, 'knowledge_original_deleted', 'source_version', _version_id,
    NULL, NULL, 'deleted', jsonb_build_object('audit_evidence_retained', true), 'screen');
END; $$;

REVOKE ALL ON FUNCTION public.delete_knowledge_source(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_knowledge_deletion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_knowledge_source(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_knowledge_deletion(uuid) TO authenticated, service_role;

COMMIT;
