-- Run after 20260919180003_media_email_release_guard.sql. No external email is sent.
-- All explicitly marked fixtures and release/audit changes roll back atomically.
BEGIN;
CREATE TEMP TABLE media_email_checks(check_name text,passed boolean) ON COMMIT DROP;
CREATE OR REPLACE FUNCTION pg_temp.email_expect_failure(_sql text,_fragment text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE _sql;
  EXCEPTION WHEN OTHERS THEN
    IF position(_fragment in SQLERRM)>0 THEN RETURN; END IF;
    RAISE EXCEPTION 'Unexpected failure: % (wanted %)',SQLERRM,_fragment;
  END;
  RAISE EXCEPTION 'Expected refusal containing %',_fragment;
END; $$;
DO $$
DECLARE actor uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid();
  vid uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid(); gid uuid; did uuid; approval uuid;
  evidence jsonb; claimed jsonb; again jsonb; rid uuid; attempted timestamptz;
BEGIN
  SELECT id INTO gid FROM public.guidelines WHERE status='active';
  ASSERT gid IS NOT NULL,'Active guideline required for validation';
  INSERT INTO public.profiles(id,full_name,role,is_demo,is_active) VALUES(actor,'EMAIL ROLLBACK TEST — no login','official',true,true);
  INSERT INTO public.user_roles(user_id,role_id) SELECT actor,id FROM public.roles WHERE key='communications_official';
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  INSERT INTO public.sources(id,title,source_type,audience) VALUES(sid,'EMAIL ROLLBACK TEST — never retained','statistical_release','public');
  INSERT INTO public.source_versions(id,source_id,version_label,original_url,status,ingest_state,approval_basis,approved_by,approved_at)
    VALUES(vid,sid,'rollback','https://example.invalid/rollback','approved','done','demonstration',actor,now());
  INSERT INTO public.passages(id,source_version_id,position,content) VALUES(pid,vid,0,'Test publication text only.');
  INSERT INTO public.cases(id,reference,kind,review_reasons,question_text,status_token_hash,is_demo_seed,requester_contact,contact_consent)
    VALUES(cid,'EMAIL-ROLLBACK-'||cid::text,'media',ARRAY['media']::public.review_reason[],'Test media email request only','unusable-test-token',true,'reporter@example.invalid',true);
  evidence:=jsonb_build_array(jsonb_build_object('sourceVersionId',vid,'passageId',pid,'statement','Test publication text only.'));
  did:=public.save_generated_case_draft(cid,'Test exact approved response',ARRAY[]::text[],evidence,gid,'test','rollback','ignored');
  ASSERT NOT has_function_privilege('anon','public.claim_media_email(uuid)','EXECUTE'),'Anonymous email sending allowed';
  ASSERT NOT has_function_privilege('authenticated','public.finish_media_email(uuid,timestamptz,public.delivery_state,text,text,boolean)','EXECUTE'),'Browser can fake delivery receipt';
  ASSERT NOT has_table_privilege('authenticated','public.releases','UPDATE'),'Authenticated clients can edit release delivery directly';
  ASSERT NOT has_table_privilege('authenticated','public.releases','DELETE'),'Authenticated clients can delete releases';
  ASSERT NOT has_table_privilege('anon','public.releases','UPDATE'),'Anonymous clients can edit release delivery';
  PERFORM pg_temp.email_expect_failure(format('SELECT public.claim_media_email(%L)',cid),'cases.release');
  INSERT INTO public.user_roles(user_id,role_id) SELECT actor,id FROM public.roles WHERE key='communications_manager' ON CONFLICT DO NOTHING;
  PERFORM pg_temp.email_expect_failure(format('SELECT public.claim_media_email(%L)',cid),'Only an approved case');
  INSERT INTO media_email_checks VALUES('Anonymous, missing permission and unapproved send rejected',true);

  PERFORM public.start_review(cid);
  approval:=public.approve_draft(did);
  UPDATE public.cases SET requester_contact='0712345678' WHERE id=cid;
  PERFORM pg_temp.email_expect_failure(format('SELECT public.claim_media_email(%L)',cid),'valid email');
  ASSERT NOT EXISTS(SELECT 1 FROM public.releases WHERE case_id=cid),'Invalid recipient released a response';
  UPDATE public.cases SET requester_contact='reporter@example.invalid' WHERE id=cid;
  UPDATE public.sources SET audience='staff' WHERE id=sid;
  PERFORM pg_temp.email_expect_failure(format('SELECT public.claim_media_email(%L)',cid),'supporting source');
  UPDATE public.sources SET audience='public' WHERE id=sid;
  INSERT INTO media_email_checks VALUES('Invalid recipient and confidential source fail before release',true);

  claimed:=public.claim_media_email(cid); rid:=(claimed->>'releaseId')::uuid; attempted:=(claimed->>'attemptedAt')::timestamptz;
  ASSERT (claimed->>'claimed')::boolean,'Approved response not claimed';
  ASSERT claimed->>'recipient'='reporter@example.invalid','Recipient differs from intake';
  ASSERT claimed->>'body'='Test exact approved response','Delivery differs from approved version';
  ASSERT (SELECT channel='email' AND delivery_state='queued' FROM public.releases WHERE id=rid),'Delivery not queued as email';
  PERFORM pg_temp.email_expect_failure(format('UPDATE public.releases SET released_body=%L WHERE id=%L','Tampered approved body',rid),'immutable');
  PERFORM pg_temp.email_expect_failure(format('UPDATE public.releases SET released_references=''[]''::jsonb WHERE id=%L',rid),'immutable');
  PERFORM pg_temp.email_expect_failure(format('UPDATE public.releases SET released_at=now()+interval ''1 hour'' WHERE id=%L',rid),'immutable');
  PERFORM pg_temp.email_expect_failure(format('UPDATE public.releases SET channel=''status_page'' WHERE id=%L',rid),'channel transition');
  PERFORM pg_temp.email_expect_failure(format('DELETE FROM public.releases WHERE id=%L',rid),'cannot be removed');
  INSERT INTO media_email_checks VALUES('Delivery metadata mutable only through granted paths; approved body, references, record and deletion remain protected',true);
  again:=public.claim_media_email(cid);
  ASSERT NOT (again->>'claimed')::boolean AND again->>'state'='queued','Concurrent click claimed delivery twice';
  ASSERT NOT public.finish_media_email(rid,attempted-interval '1 second','sent','test-receipt',NULL,false),'Stale attempt can overwrite current send';
  INSERT INTO media_email_checks VALUES('Exact approved recipient/body, concurrent lease and stale receipt protection',true);

  ASSERT public.finish_media_email(rid,attempted,'failed',NULL,'Test rejection',true),'Failure not saved';
  ASSERT (SELECT delivery_state='failed' AND email_sent_at IS NULL FROM public.releases WHERE id=rid),'Failure appears sent';
  claimed:=public.claim_media_email(cid); attempted:=(claimed->>'attemptedAt')::timestamptz;
  ASSERT (claimed->>'claimed')::boolean,'Confirmed failure cannot retry';
  ASSERT (claimed->>'releaseId')::uuid=rid,'Retry created another release';
  ASSERT public.finish_media_email(rid,attempted,'failed',NULL,'Test network timeout',false),'Uncertain failure not saved';
  UPDATE public.releases SET email_started_at=now()-interval '25 hours' WHERE id=rid;
  PERFORM pg_temp.email_expect_failure(format('SELECT public.claim_media_email(%L)',cid),'could not be confirmed');
  INSERT INTO media_email_checks VALUES('Failed status, same-release retry and uncertain expired deduplication window',true);

  UPDATE public.releases SET email_started_at=now() WHERE id=rid;
  claimed:=public.claim_media_email(cid); attempted:=(claimed->>'attemptedAt')::timestamptz;
  PERFORM pg_temp.email_expect_failure(format('SELECT public.finish_media_email(%L,%L,''sent'',NULL,NULL,false)',rid,attempted),'receipt');
  ASSERT public.finish_media_email(rid,attempted,'sent','test-email-receipt',NULL,false),'Success not saved';
  ASSERT (SELECT delivery_state='sent' AND email_sent_at IS NOT NULL AND email_provider_id='test-email-receipt' FROM public.releases WHERE id=rid),'Success receipt missing';
  again:=public.claim_media_email(cid);
  ASSERT NOT (again->>'claimed')::boolean AND again->>'state'='sent','Sent response can be delivered again';
  ASSERT (SELECT count(*)=1 FROM public.releases WHERE case_id=cid),'Retry duplicated release';
  INSERT INTO media_email_checks VALUES('Receipt required, successful send and already-sent idempotency',true);
END; $$;
SELECT check_name,passed FROM media_email_checks;
ROLLBACK;
