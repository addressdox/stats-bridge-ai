-- Run after 20260918180001_knowledge_lifecycle.sql as the database administrator.
-- All synthetic fixture records and audit events are rolled back. No real source is approved.
BEGIN;
DO $$
DECLARE
  actor uuid; denied boolean; s uuid := gen_random_uuid(); v1 uuid := gen_random_uuid();
  v2 uuid := gen_random_uuid(); v3 uuid := gen_random_uuid(); p uuid := gen_random_uuid();
  o uuid := gen_random_uuid(); mem uuid := gen_random_uuid();
BEGIN
  SELECT id INTO actor FROM public.profiles
    WHERE public.has_permission(id, 'sources.approve') AND public.has_permission(id, 'sources.verify') LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'Test needs an existing active knowledge reviewer'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.approve_source(uuid,public.approval_basis)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.approve_source(uuid,public.approval_basis)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.flag_source_change(uuid,public.void_reason,uuid)', 'EXECUTE')
    THEN RAISE EXCEPTION 'FAIL: lifecycle entry-point grants'; END IF;

  INSERT INTO public.sources(id,title,source_type,publisher,audience)
    VALUES(s,'ROLLBACK TEST — knowledge lifecycle','other','Synthetic test fixture','staff');
  INSERT INTO public.source_versions(id,source_id,version_label,original_url,status,ingest_state)
    VALUES(v1,s,'Test 1','https://example.invalid/test','pending','done');
  INSERT INTO public.passages(id,source_version_id,position,content)
    VALUES(p,v1,0,'Synthetic test evidence. This is not an official statistic.');
  INSERT INTO public.observations(id,source_version_id,passage_id,measure,measure_key,value,value_state,display_value,unit,geography,reference_period)
    VALUES(o,v1,p,'Synthetic measure','rollback_test',1,'reported','1','test','South Africa','Test only');

  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  denied := false;
  BEGIN PERFORM public.approve_source(v1,'demonstration'); EXCEPTION WHEN OTHERS THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: unauthorised approval'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  denied := false;
  BEGIN PERFORM public.approve_source(v1,'demonstration'); EXCEPTION WHEN OTHERS THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: unverified figure approval'; END IF;

  PERFORM public.verify_observations(ARRAY[o]);
  IF NOT EXISTS(SELECT 1 FROM public.observations WHERE id=o AND verified_by=actor AND verified_at IS NOT NULL)
    THEN RAISE EXCEPTION 'FAIL: actual reviewer attribution'; END IF;
  PERFORM public.approve_source(v1,'demonstration');
  IF NOT EXISTS(SELECT 1 FROM public.source_versions WHERE id=v1 AND status='approved' AND approved_by=actor AND approval_basis='demonstration')
    OR NOT EXISTS(SELECT 1 FROM public.sources WHERE id=s AND current_version_id=v1)
    OR NOT EXISTS(SELECT 1 FROM public.audit_events WHERE entity_id=v1 AND action='source_approved' AND actor_id=actor)
    THEN RAISE EXCEPTION 'FAIL: atomic approval state and audit'; END IF;

  -- Simulate the timestamp-only seeded demonstration within the uncommitted fixture.
  UPDATE public.observations SET verified_by=NULL WHERE id=o;
  PERFORM public.verify_observations(ARRAY[o]);
  IF NOT EXISTS(SELECT 1 FROM public.observations WHERE id=o AND verified_by=actor)
    THEN RAISE EXCEPTION 'FAIL: explicit legacy demonstration review'; END IF;
  UPDATE public.source_versions SET approval_basis='official' WHERE id=v1;
  UPDATE public.observations SET verified_by=NULL WHERE id=o;
  denied := false;
  BEGIN PERFORM public.verify_observations(ARRAY[o]); EXCEPTION WHEN OTHERS THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: official approved figure changed'; END IF;
  UPDATE public.source_versions SET approval_basis='demonstration' WHERE id=v1;
  UPDATE public.observations SET verified_by=actor WHERE id=o;

  INSERT INTO public.memory_items(id,item_type,title,body,audience,communicated_on,origin,is_demo_seed)
    VALUES(mem,'faq','ROLLBACK TEST memory','Synthetic response','staff',current_date,'imported',true);
  INSERT INTO public.evidence_links(owner_kind,owner_id,source_version_id,passage_id)
    VALUES('memory_item',mem,v1,p);
  INSERT INTO public.source_versions(id,source_id,version_label,original_url,status,ingest_state,supersedes_version_id)
    VALUES(v2,s,'Test 2','https://example.invalid/test-2','pending','done',v1);
  INSERT INTO public.passages(source_version_id,position,content)
    VALUES(v2,0,'Replacement synthetic test evidence.');
  PERFORM public.approve_source(v2,'demonstration');
  IF NOT EXISTS(SELECT 1 FROM public.source_versions WHERE id=v1 AND status='superseded')
    OR NOT EXISTS(SELECT 1 FROM public.sources WHERE id=s AND current_version_id=v2)
    OR NOT EXISTS(SELECT 1 FROM public.memory_items WHERE id=mem AND reuse_status='needs_review')
    THEN RAISE EXCEPTION 'FAIL: supersession and dependent-memory invalidation'; END IF;

  denied := false;
  BEGIN PERFORM public.reject_source(v2,'Wrong state'); EXCEPTION WHEN OTHERS THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: approved version rejected'; END IF;
  PERFORM public.withdraw_source(v2,'Synthetic withdrawal test');
  IF NOT EXISTS(SELECT 1 FROM public.source_versions WHERE id=v2 AND status='withdrawn' AND withdrawn_by=actor)
    OR NOT EXISTS(SELECT 1 FROM public.sources WHERE id=s AND current_version_id IS NULL)
    OR NOT EXISTS(SELECT 1 FROM public.audit_events WHERE entity_id=v2 AND action='source_withdrawn')
    THEN RAISE EXCEPTION 'FAIL: withdrawal state and audit'; END IF;
  denied := false;
  BEGIN PERFORM public.approve_source(v2,'demonstration'); EXCEPTION WHEN OTHERS THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: withdrawn version approved again'; END IF;
  INSERT INTO public.source_versions(id,source_id,version_label,original_url,status,ingest_state)
    VALUES(v3,s,'Test 3','https://example.invalid/test-3','pending','done');
  PERFORM public.reject_source(v3,'Synthetic rejection test');
  IF NOT EXISTS(SELECT 1 FROM public.source_versions WHERE id=v3 AND status='rejected')
    OR NOT EXISTS(SELECT 1 FROM public.audit_events WHERE entity_id=v3 AND action='source_rejected')
    THEN RAISE EXCEPTION 'FAIL: rejection state and audit'; END IF;
END;
$$;
SELECT 'PASS — knowledge lifecycle, permissions, explicit verification, replacement, withdrawal and audit; fixture changes rolled back' AS result;
ROLLBACK;
