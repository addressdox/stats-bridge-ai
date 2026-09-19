-- Run after 20260919070000_knowledge_deletion.sql as the database administrator.
-- Uses new synthetic records only. Every change is rolled back.
BEGIN;
DO $$
DECLARE
  actor uuid; denied boolean; s uuid := gen_random_uuid();
  pending_version uuid := gen_random_uuid(); approved_version uuid := gen_random_uuid();
  p uuid := gen_random_uuid(); retained_path text;
BEGIN
  SELECT id INTO actor FROM public.profiles WHERE public.has_permission(id, 'sources.approve') LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'Test needs an existing active knowledge reviewer'; END IF;
  IF has_function_privilege('anon', 'public.delete_knowledge_source(uuid,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.finalize_knowledge_deletion(uuid)', 'EXECUTE')
    THEN RAISE EXCEPTION 'FAIL: anonymous deletion grant'; END IF;

  INSERT INTO public.sources(id,title,source_type,publisher,audience)
    VALUES(s,'ROLLBACK TEST — library deletion','other','Synthetic fixture','public');
  INSERT INTO public.source_versions(id,source_id,version_label,status,ingest_state,file_path,original_url)
    VALUES(pending_version,s,'Synthetic pending','pending','done','rollback-test/not-an-existing-file.txt',NULL),
      (approved_version,s,'Synthetic approved','pending','done',NULL,'https://example.invalid/synthetic-knowledge-test');
  INSERT INTO public.passages(id,source_version_id,position,content)
    VALUES(p,approved_version,0,'NalediDeletionFixture synthetic evidence for an uncommitted library lifecycle test.');

  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  denied := false;
  BEGIN PERFORM public.delete_knowledge_source(pending_version,'Synthetic test'); EXCEPTION WHEN OTHERS THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: unauthorised deletion'; END IF;

  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  retained_path := public.delete_knowledge_source(pending_version,'Synthetic test');
  IF retained_path IS DISTINCT FROM 'rollback-test/not-an-existing-file.txt'
    OR NOT EXISTS (SELECT 1 FROM public.source_versions WHERE id=pending_version AND status='rejected' AND deleted_at IS NOT NULL AND deleted_by=actor)
    THEN RAISE EXCEPTION 'FAIL: pending source deletion and canonical cleanup path'; END IF;
  IF public.delete_knowledge_source(pending_version,'Retry synthetic test') IS DISTINCT FROM retained_path
    THEN RAISE EXCEPTION 'FAIL: storage cleanup retry'; END IF;
  PERFORM public.finalize_knowledge_deletion(pending_version);
  IF NOT EXISTS (SELECT 1 FROM public.source_versions WHERE id=pending_version AND file_path IS NULL)
    THEN RAISE EXCEPTION 'FAIL: original path cleanup'; END IF;

  PERFORM public.approve_source(approved_version,'demonstration');
  IF NOT EXISTS (SELECT 1 FROM public.search_passages_by_id(ARRAY[p])) THEN RAISE EXCEPTION 'FAIL: approved upload retrieval'; END IF;
  PERFORM public.delete_knowledge_source(approved_version,'Synthetic approved removal');
  PERFORM public.finalize_knowledge_deletion(approved_version);
  IF EXISTS (SELECT 1 FROM public.search_passages_by_id(ARRAY[p]))
    OR NOT EXISTS (SELECT 1 FROM public.source_versions WHERE id=approved_version AND status='withdrawn' AND deleted_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.sources WHERE id=s AND current_version_id IS NOT NULL)
    THEN RAISE EXCEPTION 'FAIL: deleted source still usable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.passages WHERE id=p)
    OR NOT EXISTS (SELECT 1 FROM public.audit_events WHERE entity_id=approved_version AND action='knowledge_source_deleted' AND actor_id=actor)
    THEN RAISE EXCEPTION 'FAIL: earlier evidence or audit lost'; END IF;
  denied := false;
  BEGIN PERFORM public.approve_source(approved_version,'demonstration'); EXCEPTION WHEN OTHERS THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: deleted evidence approved again'; END IF;
END;
$$;
SELECT 'PASS — approved upload retrieval, permission checks, deletion, retry, AI exclusion and retained audit; synthetic changes rolled back' AS result;
ROLLBACK;
