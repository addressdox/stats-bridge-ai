-- Run as the database administrator after 20260919190001_knowledge_retrieval_relevance.sql.
-- Synthetic sources, values and embeddings exist only in this transaction.
BEGIN;
DO $$
DECLARE
  actor uuid; s uuid := gen_random_uuid(); staff_source uuid := gen_random_uuid();
  metadata_source uuid := gen_random_uuid(); v uuid := gen_random_uuid();
  old_v uuid := gen_random_uuid(); pending_v uuid := gen_random_uuid(); staff_v uuid := gen_random_uuid();
  deleted_v uuid := gen_random_uuid(); withdrawn_v uuid := gen_random_uuid(); superseded_v uuid := gen_random_uuid();
  metadata_v uuid := gen_random_uuid(); p uuid := gen_random_uuid(); old_p uuid := gen_random_uuid();
  pending_p uuid := gen_random_uuid(); staff_p uuid := gen_random_uuid(); deleted_p uuid := gen_random_uuid();
  withdrawn_p uuid := gen_random_uuid(); superseded_p uuid := gen_random_uuid(); metadata_p uuid := gen_random_uuid();
  verified_o uuid := gen_random_uuid(); timestamp_o uuid := gen_random_uuid(); person_o uuid := gen_random_uuid();
  disallowed_ids uuid[]; result_ids uuid[]; item record;
  exact_vector extensions.vector(1536); near_vector extensions.vector(1536);
  far_vector extensions.vector(1536);
BEGIN
  SELECT id INTO actor FROM public.profiles LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'Test needs an existing staff profile'; END IF;

  FOR item IN SELECT unnest(ARRAY[
    'public.knowledge_search_queries(text)', 'public.search_passages(text,integer)',
    'public.search_observations(text,integer)', 'public.search_passages_by_id(uuid[])',
    'public.search_observations_by_id(uuid[])', 'public.search_knowledge_semantic(extensions.vector,integer)'
  ]) AS signature LOOP
    IF has_function_privilege('anon', item.signature, 'EXECUTE')
      OR has_function_privilege('authenticated', item.signature, 'EXECUTE')
      OR NOT has_function_privilege('service_role', item.signature, 'EXECUTE')
      THEN RAISE EXCEPTION 'FAIL: retrieval grants for %', item.signature; END IF;
  END LOOP;

  INSERT INTO public.sources(id,title,source_type,publisher,audience,topic) VALUES
    (s,'ROLLBACK TEST — retrieval corpus','other','Synthetic fixture','public',NULL),
    (staff_source,'ROLLBACK TEST — private corpus','other','Synthetic fixture','staff',NULL),
    (metadata_source,'metadataverificationtoken','other','Synthetic fixture','public','topicverificationtoken');
  INSERT INTO public.source_versions(id,source_id,version_label,original_url,status,ingest_state,published_on) VALUES
    (v,s,'Synthetic newer','https://example.invalid/current','approved','done','2026-01-01'),
    (old_v,s,'Synthetic older approved snapshot','https://example.invalid/older','approved','done','2020-01-01'),
    (pending_v,s,'Synthetic pending','https://example.invalid/pending','pending','done','2026-01-02'),
    (staff_v,staff_source,'Synthetic staff','https://example.invalid/staff','approved','done','2026-01-02'),
    (deleted_v,s,'Synthetic deleted','https://example.invalid/deleted','approved','done','2026-01-02'),
    (withdrawn_v,s,'Synthetic withdrawn','https://example.invalid/withdrawn','withdrawn','done','2026-01-02'),
    (superseded_v,s,'Synthetic superseded','https://example.invalid/superseded','superseded','done','2026-01-02'),
    (metadata_v,metadata_source,'Synthetic metadata','https://example.invalid/metadata','approved','done','2020-01-01');
  UPDATE public.sources SET current_version_id=v WHERE id=s;
  UPDATE public.source_versions SET deleted_at=now() WHERE id=deleted_v;
  INSERT INTO public.passages(id,source_version_id,position,section_label,content) VALUES
    (p,v,0,NULL,'retrievalfixtureboundary: synthetic unemployment rate, South Africa.'),
    (old_p,old_v,0,NULL,'retrievalfixtureboundary: synthetic fertility estimates. The fertility rate is 2.2 live births per woman in South Africa.'),
    (pending_p,pending_v,0,NULL,'retrievalfixtureboundary: synthetic fertility rate, South Africa.'),
    (staff_p,staff_v,0,NULL,'retrievalfixtureboundary: private synthetic fertility rate, South Africa.'),
    (deleted_p,deleted_v,0,NULL,'retrievalfixtureboundary: deleted synthetic fertility rate, South Africa.'),
    (withdrawn_p,withdrawn_v,0,NULL,'retrievalfixtureboundary: withdrawn synthetic fertility rate, South Africa.'),
    (superseded_p,superseded_v,0,NULL,'retrievalfixtureboundary: superseded synthetic fertility rate, South Africa.'),
    (metadata_p,metadata_v,0,'sectionverificationtoken','This synthetic passage has no copy of its metadata keywords.');
  -- Generic newer matches must not exhaust the candidate budget first.
  INSERT INTO public.passages(source_version_id,position,content)
    SELECT v, i, 'Synthetic monetary policy rate for South Africa, test entry '||i FROM generate_series(1,45) i;
  IF NOT EXISTS(SELECT 1 FROM public.search_passages('fertility rate annual estimates',1) WHERE passage_id=old_p)
    THEN RAISE EXCEPTION 'FAIL: relevant older partial match lost to newer generic rate matches'; END IF;
  IF EXISTS(SELECT 1 FROM public.search_passages('fertility rate annual estimates',40) WHERE source_version_id=v)
    THEN RAISE EXCEPTION 'FAIL: generic rate alone admits unrelated material'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.search_passages_by_id(ARRAY[old_p]) WHERE passage_id=old_p)
    THEN RAISE EXCEPTION 'FAIL: an older still-approved snapshot was excluded by current_version_id'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.search_passages('metadataverificationtoken',5) WHERE passage_id=metadata_p)
    OR NOT EXISTS(SELECT 1 FROM public.search_passages('topicverificationtoken',5) WHERE passage_id=metadata_p)
    OR NOT EXISTS(SELECT 1 FROM public.search_passages('sectionverificationtoken',5) WHERE passage_id=metadata_p)
    THEN RAISE EXCEPTION 'FAIL: title, topic or section metadata not searchable'; END IF;

  disallowed_ids := ARRAY[pending_p,staff_p,deleted_p,withdrawn_p,superseded_p];
  IF EXISTS(SELECT 1 FROM public.search_passages('retrievalfixtureboundary',40) WHERE passage_id=ANY(disallowed_ids))
    OR EXISTS(SELECT 1 FROM public.search_passages_by_id(disallowed_ids))
    THEN RAISE EXCEPTION 'FAIL: non-public or ineligible passage searchable'; END IF;

  INSERT INTO public.observations(id,source_version_id,measure,measure_key,value,value_state,display_value,unit,geography,reference_period,verified_by,verified_at) VALUES
    (verified_o,old_v,'retrievalfixturefertility total fertility rate','fixture_fertility',2.2,'reported','2.2','births per woman','South Africa','Synthetic 2020',actor,now()),
    (timestamp_o,v,'retrievalfixturefertility timestamp-only rate','fixture_timestamp',2.3,'reported','2.3','births per woman','South Africa','Synthetic 2026',NULL,now()),
    (person_o,v,'retrievalfixturefertility reviewer-only rate','fixture_person',2.4,'reported','2.4','births per woman','South Africa','Synthetic 2026',actor,NULL);
  SELECT array_agg(observation_id) INTO result_ids FROM public.search_observations('retrievalfixturefertility',20);
  IF result_ids IS DISTINCT FROM ARRAY[verified_o]
    THEN RAISE EXCEPTION 'FAIL: keyword figures require both reviewer and verification time'; END IF;
  SELECT array_agg(observation_id) INTO result_ids FROM public.search_observations_by_id(ARRAY[timestamp_o,verified_o,person_o]);
  IF result_ids IS DISTINCT FROM ARRAY[verified_o]
    THEN RAISE EXCEPTION 'FAIL: hydrated figures require both reviewer and verification time'; END IF;

  SELECT ('['||string_agg(CASE WHEN i=1 THEN '1' ELSE '0' END, ',')||']')::extensions.vector INTO exact_vector FROM generate_series(1,1536) i;
  SELECT ('['||string_agg(CASE WHEN i=1 THEN '1' WHEN i=2 THEN '0.01' ELSE '0' END, ',')||']')::extensions.vector INTO near_vector FROM generate_series(1,1536) i;
  SELECT ('['||string_agg(CASE WHEN i=1 THEN '1' WHEN i=2 THEN '0.02' ELSE '0' END, ',')||']')::extensions.vector INTO far_vector FROM generate_series(1,1536) i;
  INSERT INTO public.kb_embeddings(owner_kind,owner_id,source_version_id,content,embedding,model)
    SELECT 'passage', id, source_version_id, content, exact_vector, 'synthetic-rollback-test' FROM public.passages WHERE id=ANY(disallowed_ids);
  INSERT INTO public.kb_embeddings(owner_kind,owner_id,source_version_id,content,embedding,model) VALUES
    ('passage',old_p,old_v,'Synthetic approved passage',near_vector,'synthetic-rollback-test'),
    ('observation',verified_o,old_v,'Synthetic verified figure',far_vector,'synthetic-rollback-test'),
    ('observation',timestamp_o,v,'Synthetic unchecked figure',exact_vector,'synthetic-rollback-test'),
    ('observation',person_o,v,'Synthetic unchecked figure',exact_vector,'synthetic-rollback-test'),
    ('passage',gen_random_uuid(),v,'Synthetic orphaned owner',exact_vector,'synthetic-rollback-test'),
    ('passage',p,old_v,'Synthetic mismatched owner version',exact_vector,'synthetic-rollback-test');
  -- Existing vectors are not changed; compare within all returned eligible
  -- fixture owners, and ensure the denied exact matches never consume the limit.
  IF EXISTS(SELECT 1 FROM public.search_knowledge_semantic(exact_vector,50)
    WHERE owner_id=ANY(disallowed_ids || ARRAY[timestamp_o,person_o,p]))
    THEN RAISE EXCEPTION 'FAIL: semantic eligibility or owner/version checks'; END IF;
  SELECT array_agg(owner_id) INTO result_ids FROM public.search_knowledge_semantic(exact_vector,2);
  IF NOT (old_p=ANY(result_ids)) OR NOT (verified_o=ANY(result_ids)) OR cardinality(result_ids)<>2
    THEN RAISE EXCEPTION 'FAIL: excluded semantic candidates exhausted the result limit'; END IF;

  SELECT array_agg(passage_id) INTO result_ids FROM public.search_passages_by_id(ARRAY[metadata_p,old_p]);
  IF result_ids IS DISTINCT FROM ARRAY[metadata_p,old_p]
    THEN RAISE EXCEPTION 'FAIL: hydration lost retrieval ranking'; END IF;
  IF EXISTS(SELECT 1 FROM public.search_passages('the and of',5))
    OR EXISTS(SELECT 1 FROM public.search_observations('',5))
    THEN RAISE EXCEPTION 'FAIL: empty or stopword-only queries'; END IF;
END;
$$;
SELECT 'PASS — topic ranking, metadata search, approved snapshots, lexical/semantic eligibility, verified figures, hydration order and grants; fixtures rolled back' AS result;
ROLLBACK;
