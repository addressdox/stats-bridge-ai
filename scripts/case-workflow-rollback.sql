-- Run in the project's SQL editor after 20260918180002_case_drafts.sql.
-- Every fixture is explicitly marked as a demonstration and rolled back.
-- No genuine official is impersonated; the temporary profile has no login.
-- No source is approved, reply released, or test identity retained after ROLLBACK.
BEGIN;
CREATE TEMP TABLE case_workflow_checks(check_name text, passed boolean) ON COMMIT DROP;
CREATE OR REPLACE FUNCTION pg_temp.expect_failure(_sql text,_fragment text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE _sql;
  EXCEPTION WHEN OTHERS THEN
    IF position(_fragment in SQLERRM)>0 THEN RETURN; END IF;
    RAISE EXCEPTION 'Unexpected failure: % (wanted %)',SQLERRM,_fragment;
  END;
  RAISE EXCEPTION 'Expected refusal containing %, but operation succeeded',_fragment;
END; $$;
DO $$
DECLARE actor uuid:=gen_random_uuid(); caseid uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid();
 versionid uuid:=gen_random_uuid(); wrongversion uuid:=gen_random_uuid(); passageid uuid:=gen_random_uuid();
 legacyfigure uuid:=gen_random_uuid(); gid uuid; evidence jsonb; did uuid; edited uuid; ap uuid; rel uuid;
BEGIN
  SELECT id INTO gid FROM public.guidelines WHERE status='active';
  ASSERT gid IS NOT NULL,'An active guideline is needed for workflow validation';
  INSERT INTO public.profiles(id,full_name,role,is_demo,is_active) VALUES(actor,'ROLLBACK TEST — no login','official',true,true);
  INSERT INTO public.user_roles(user_id,role_id) SELECT actor,id FROM public.roles WHERE key='communications_official';
  ASSERT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=actor),'Communications reviewer role missing';
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);

  INSERT INTO public.sources(id,title,source_type,audience) VALUES(sid,'ROLLBACK TEST — never retained','statistical_release','public');
  INSERT INTO public.source_versions(id,source_id,version_label,original_url,status,ingest_state,approval_basis,approved_by,approved_at)
  VALUES(versionid,sid,'rollback-only','https://example.invalid/rollback','approved','done','demonstration',actor,now()),
        (wrongversion,sid,'wrong-version','https://example.invalid/rollback-wrong','approved','done','demonstration',actor,now());
  INSERT INTO public.passages(id,source_version_id,position,content) VALUES(passageid,versionid,0,'A test publication extract, not real statistics.');
  INSERT INTO public.observations(id,source_version_id,measure,measure_key,value,value_state,display_value,unit,geography,reference_period,verified_at,verified_by)
  VALUES(legacyfigure,versionid,'Test figure','rollback_test',1,'reported','1','test units','Test geography','Test period',now(),NULL);
  INSERT INTO public.cases(id,reference,kind,review_reasons,question_text,status_token_hash,is_demo_seed)
  VALUES(caseid,'ROLLBACK-'||caseid::text,'public_escalation',ARRAY['formal_approval']::public.review_reason[],'Rollback-only communications workflow test','unusable-test-token',true);
  evidence:=jsonb_build_array(jsonb_build_object('sourceVersionId',versionid,'passageId',passageid,'statement','A test publication extract, not real statistics.'));

  ASSERT NOT has_function_privilege('anon','public.save_generated_case_draft(uuid,text,text[],jsonb,uuid,text,text,text)','EXECUTE'),'Anonymous callers can create private drafts';
  ASSERT NOT has_function_privilege('authenticated','public.save_generated_case_draft(uuid,text,text[],jsonb,uuid,text,text,text)','EXECUTE'),'Browser clients can impersonate the automatic drafter';
  ASSERT NOT has_function_privilege('anon','public.save_review_draft(uuid,text,public.draft_format,text[],jsonb)','EXECUTE'),'Anonymous callers can edit drafts';
  INSERT INTO case_workflow_checks VALUES('Private draft RPC access',true);

  -- A citation must match its actual source version. Failure leaves zero drafts.
  PERFORM pg_temp.expect_failure(format('SELECT public.save_generated_case_draft(%L,%L,ARRAY[]::text[],%L::jsonb,%L,%L,%L,%L)',caseid,'Test body',jsonb_build_array(jsonb_build_object('sourceVersionId',wrongversion,'passageId',passageid,'statement','Test')),gid,'test','rollback','ignored'),'does not belong');
  ASSERT NOT EXISTS(SELECT 1 FROM public.drafts WHERE case_id=caseid),'Invalid references left a partial draft';
  PERFORM pg_temp.expect_failure(format('SELECT public.save_generated_case_draft(%L,%L,ARRAY[]::text[],%L::jsonb,%L,%L,%L,%L)',caseid,'Test body',jsonb_build_array(jsonb_build_object('sourceVersionId',versionid,'observationId',legacyfigure,'statement','Test')),gid,'test','rollback','ignored'),'not been verified');
  INSERT INTO case_workflow_checks VALUES('Invalid and timestamp-only evidence refused atomically',true);

  did:=public.save_generated_case_draft(caseid,'Original private wording',ARRAY[]::text[],evidence,gid,'test','rollback-only','ignored');
  ASSERT (SELECT status='draft_prepared' FROM public.cases WHERE id=caseid),'Case was not marked draft prepared';
  ASSERT (SELECT author_kind='ai' AND author_id IS NULL FROM public.drafts WHERE id=did),'Automatic draft impersonated an official';
  ASSERT (SELECT count(*)=1 FROM public.evidence_links WHERE owner_kind='draft' AND owner_id=did),'Draft evidence missing';
  ASSERT NOT EXISTS(SELECT 1 FROM public.approvals WHERE case_id=caseid),'Automatic draft acquired approval';
  ASSERT NOT EXISTS(SELECT 1 FROM public.releases WHERE case_id=caseid),'Automatic draft became public';
  ASSERT public.save_generated_case_draft(caseid,'Retry should not replace',ARRAY[]::text[],evidence,gid,'test','rollback-only','ignored')=did,'Retry did not reuse initial draft';
  ASSERT (SELECT count(*)=1 FROM public.drafts WHERE case_id=caseid),'Retry created another draft';
  INSERT INTO case_workflow_checks VALUES('Private initial draft and retry idempotency',true);

  PERFORM pg_temp.expect_failure(format('SELECT public.approve_draft(%L)',did),'Start review');
  PERFORM public.start_review(caseid);
  edited:=public.save_review_draft(caseid,'Wording requiring evidence review','general_reply',ARRAY['Unresolved source question'],NULL);
  PERFORM pg_temp.expect_failure(format('SELECT public.approve_draft(%L)',edited),'Resolve the recorded evidence gaps');
  edited:=public.save_review_draft(caseid,'Reviewed exact wording','general_reply',ARRAY[]::text[],evidence);
  PERFORM pg_temp.expect_failure(format('SELECT public.approve_draft(%L)',did),'latest draft');
  ap:=public.approve_draft(edited);
  PERFORM pg_temp.expect_failure(format('SELECT public.release_draft(%L)',caseid),'cases.release');
  INSERT INTO case_workflow_checks VALUES('Review, unresolved gap, latest version and release permission gates',true);

  edited:=public.save_review_draft(caseid,'Final revised wording','general_reply',ARRAY[]::text[],NULL);
  ASSERT (SELECT status='void' FROM public.approvals WHERE id=ap),'Edit did not void previous approval';
  ASSERT (SELECT count(*)=1 FROM public.evidence_links WHERE owner_kind='draft' AND owner_id=edited),'Manual edit lost carried evidence';
  INSERT INTO public.user_roles(user_id,role_id) SELECT actor,id FROM public.roles WHERE key='communications_manager' ON CONFLICT DO NOTHING;
  PERFORM pg_temp.expect_failure(format('SELECT public.release_draft(%L)',caseid),'Only an approved case');
  ap:=public.approve_draft(edited);
  UPDATE public.sources SET audience='staff' WHERE id=sid;
  PERFORM pg_temp.expect_failure(format('SELECT public.release_draft(%L)',caseid),'supporting source');
  UPDATE public.sources SET audience='public' WHERE id=sid;
  rel:=public.release_draft(caseid);
  ASSERT (SELECT released_body='Final revised wording' AND draft_id=edited FROM public.releases WHERE id=rel),'Release differed from the approved version';
  ASSERT (SELECT approval_basis='demonstration' FROM public.approvals WHERE id=ap),'Test approval was not labelled demonstration';
  ASSERT EXISTS(SELECT 1 FROM public.audit_events WHERE case_id=caseid AND action='reply_released'),'Release audit missing';
  PERFORM pg_temp.expect_failure(format('SELECT public.save_review_draft(%L,%L,%L,ARRAY[]::text[],NULL)',caseid,'Closed edit','general_reply'),'closed');
  PERFORM pg_temp.expect_failure(format('SELECT public.approve_draft(%L)',edited),'Start review');
  PERFORM pg_temp.expect_failure(format('SELECT public.release_draft(%L)',caseid),'Only an approved case');
  INSERT INTO case_workflow_checks VALUES('Edit invalidation, source confidentiality, exact release, audit and closed-case gates',true);
END; $$;
SELECT check_name,passed FROM case_workflow_checks;
ROLLBACK;
