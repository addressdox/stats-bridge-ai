BEGIN;

-- A broad query such as "fertility rate South Africa" must not fall back to
-- every publication mentioning "rate". Keep a subject-only fallback, while
-- retaining the original web-search query for exact matches and ranking.
CREATE OR REPLACE FUNCTION public.knowledge_search_queries(_q text)
RETURNS TABLE (strict_q tsquery, subject_q tsquery, any_q tsquery)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  WITH words AS (
    SELECT unnest(tsvector_to_array(to_tsvector('english', coalesce(_q, '')))) AS lexeme
  ), generic AS (
    SELECT tsvector_to_array(to_tsvector('english',
      'what which how when where who please provide give tell show know information data statistics statistical official published publication latest recent current South Africa African national rate rates number numbers total percentage percent year years quarter quarterly annual report request response media prepare answer enquiry question figure figures')) AS lexemes
  )
  SELECT websearch_to_tsquery('english', coalesce(_q, '')),
    to_tsquery('english', string_agg(quote_literal(w.lexeme), ' | ')
      FILTER (WHERE NOT (w.lexeme = ANY(g.lexemes)) AND w.lexeme ~ '[[:alpha:]]')),
    to_tsquery('english', string_agg(quote_literal(w.lexeme), ' | '))
  FROM words w CROSS JOIN generic g;
$$;

CREATE OR REPLACE FUNCTION public.search_passages(_q text, _limit int DEFAULT 12)
RETURNS TABLE (
  passage_id uuid, content text, page_number int, section_label text,
  source_version_id uuid, version_label text, published_on date, reference_period text,
  original_url text, source_id uuid, title text, publisher text, source_type source_type,
  topic text, rank real
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (
    SELECT strict_q, coalesce(subject_q, any_q) AS fallback_q
    FROM public.knowledge_search_queries(_q)
  ), docs AS (
    SELECT p.id, p.content, p.page_number, p.section_label,
      v.id AS source_version_id, v.version_label, v.published_on, v.reference_period, v.original_url,
      s.id AS source_id, s.title, s.publisher, s.source_type, s.topic,
      p.search_text AS body_doc,
      setweight(to_tsvector('english', s.title || ' ' || coalesce(s.topic, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(p.section_label, '')), 'B') ||
      setweight(p.search_text, 'C') AS doc
    FROM public.passages p
    JOIN public.source_versions v ON v.id = p.source_version_id
    JOIN public.sources s ON s.id = v.source_id
    WHERE v.status = 'approved' AND v.deleted_at IS NULL AND s.audience = 'public'
  )
  SELECT d.id, d.content, d.page_number, d.section_label,
    d.source_version_id, d.version_label, d.published_on, d.reference_period, d.original_url,
    d.source_id, d.title, d.publisher, d.source_type, d.topic,
    (ts_rank_cd(d.doc, q.strict_q) + coalesce(ts_rank_cd(d.doc, q.fallback_q), 0))::real AS rank
  FROM docs d CROSS JOIN q
  WHERE d.doc @@ q.strict_q OR d.doc @@ q.fallback_q
  ORDER BY (d.doc @@ q.strict_q) DESC,
    coalesce(ts_rank_cd(d.body_doc, q.fallback_q), 0) DESC,
    (ts_rank_cd(d.doc, q.strict_q) + coalesce(ts_rank_cd(d.doc, q.fallback_q), 0)) DESC,
    d.published_on DESC NULLS LAST, d.id
  LIMIT greatest(1, least(_limit, 40));
$$;

CREATE OR REPLACE FUNCTION public.search_observations(_q text, _limit int DEFAULT 12)
RETURNS TABLE (
  observation_id uuid, measure text, measure_key text, display_value text, value numeric,
  value_state value_state, unit text, geography text, population text, reference_period text,
  period_start date, period_end date, adjustment text, reported_change text,
  comparability_note text, page_number int, table_label text,
  source_version_id uuid, version_label text, published_on date, original_url text,
  title text, publisher text, rank real
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (
    SELECT strict_q, coalesce(subject_q, any_q) AS fallback_q
    FROM public.knowledge_search_queries(_q)
  ), docs AS (
    SELECT o.*, v.version_label, v.published_on, v.original_url, s.title, s.publisher,
      to_tsvector('english', o.measure || ' ' || o.measure_key) AS measure_doc,
      setweight(to_tsvector('english', o.measure || ' ' || o.measure_key), 'A') ||
      setweight(to_tsvector('english', s.title || ' ' || coalesce(s.topic, '') || ' ' || coalesce(o.table_label, '')), 'B') ||
      setweight(to_tsvector('english', o.geography || ' ' || coalesce(o.population, '') || ' ' ||
        o.reference_period || ' ' || coalesce(o.adjustment, '')), 'C') AS doc
    FROM public.observations o
    JOIN public.source_versions v ON v.id = o.source_version_id
    JOIN public.sources s ON s.id = v.source_id
    WHERE v.status = 'approved' AND v.deleted_at IS NULL AND s.audience = 'public'
      AND o.verified_at IS NOT NULL AND o.verified_by IS NOT NULL
  )
  SELECT d.id, d.measure, d.measure_key, d.display_value, d.value, d.value_state, d.unit,
    d.geography, d.population, d.reference_period, d.period_start, d.period_end,
    d.adjustment, d.reported_change, d.comparability_note, d.page_number, d.table_label,
    d.source_version_id, d.version_label, d.published_on, d.original_url, d.title, d.publisher,
    (ts_rank_cd(d.doc, q.strict_q) + coalesce(ts_rank_cd(d.doc, q.fallback_q), 0))::real AS rank
  FROM docs d CROSS JOIN q
  WHERE d.doc @@ q.strict_q OR d.doc @@ q.fallback_q
  ORDER BY (d.doc @@ q.strict_q) DESC,
    coalesce(ts_rank_cd(d.measure_doc, q.fallback_q), 0) DESC,
    (ts_rank_cd(d.doc, q.strict_q) + coalesce(ts_rank_cd(d.doc, q.fallback_q), 0)) DESC,
    d.period_end DESC NULLS LAST, d.published_on DESC NULLS LAST, d.id
  LIMIT greatest(1, least(_limit, 40));
$$;

-- Re-check eligibility when hydrating semantic IDs, including deletions that
-- happened after candidate search. Earlier approved snapshots remain usable;
-- a current_version_id pointer alone does not invalidate a historical period.
CREATE OR REPLACE FUNCTION public.search_passages_by_id(_ids uuid[])
RETURNS TABLE (
  passage_id uuid, content text, page_number int, section_label text,
  source_version_id uuid, version_label text, published_on date, reference_period text,
  original_url text, source_id uuid, title text, publisher text, source_type source_type,
  topic text, rank real
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.content, p.page_number, p.section_label,
    v.id, v.version_label, v.published_on, v.reference_period, v.original_url,
    s.id, s.title, s.publisher, s.source_type, s.topic, 0::real
  FROM public.passages p
  JOIN public.source_versions v ON v.id = p.source_version_id
  JOIN public.sources s ON s.id = v.source_id
  WHERE p.id = ANY(_ids) AND v.status = 'approved' AND v.deleted_at IS NULL AND s.audience = 'public'
  ORDER BY array_position(_ids, p.id)
  LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.search_observations_by_id(_ids uuid[])
RETURNS TABLE (
  observation_id uuid, measure text, measure_key text, display_value text, value numeric,
  value_state value_state, unit text, geography text, population text, reference_period text,
  period_start date, period_end date, adjustment text, reported_change text,
  comparability_note text, page_number int, table_label text,
  source_version_id uuid, version_label text, published_on date, original_url text,
  title text, publisher text, rank real
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.measure, o.measure_key, o.display_value, o.value, o.value_state, o.unit,
    o.geography, o.population, o.reference_period, o.period_start, o.period_end,
    o.adjustment, o.reported_change, o.comparability_note, o.page_number, o.table_label,
    v.id, v.version_label, v.published_on, v.original_url, s.title, s.publisher, 0::real
  FROM public.observations o
  JOIN public.source_versions v ON v.id = o.source_version_id
  JOIN public.sources s ON s.id = v.source_id
  WHERE o.id = ANY(_ids) AND v.status = 'approved' AND v.deleted_at IS NULL AND s.audience = 'public'
    AND o.verified_at IS NOT NULL AND o.verified_by IS NOT NULL
  ORDER BY array_position(_ids, o.id)
  LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.search_knowledge_semantic(
  _embedding extensions.vector(1536), _limit integer DEFAULT 12
)
RETURNS TABLE (
  owner_kind public.embedding_owner, owner_id uuid, source_version_id uuid,
  content text, similarity double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  -- Materialise the eligible corpus first: a nearest-neighbour index scan
  -- followed by audience filtering can otherwise exhaust its candidates on
  -- private, withdrawn or unchecked items and return fewer public results.
  WITH eligible AS MATERIALIZED (
    SELECT e.* FROM public.kb_embeddings e
    JOIN public.source_versions v ON v.id = e.source_version_id
    JOIN public.sources s ON s.id = v.source_id
    WHERE v.status = 'approved' AND v.deleted_at IS NULL AND s.audience = 'public'
      AND (
        (e.owner_kind = 'passage' AND EXISTS (
          SELECT 1 FROM public.passages p WHERE p.id = e.owner_id AND p.source_version_id = v.id
        )) OR
        (e.owner_kind = 'observation' AND EXISTS (
          SELECT 1 FROM public.observations o WHERE o.id = e.owner_id AND o.source_version_id = v.id
            AND o.verified_at IS NOT NULL AND o.verified_by IS NOT NULL
        ))
      )
  )
  SELECT e.owner_kind, e.owner_id, e.source_version_id, e.content,
    1 - (e.embedding <=> _embedding) AS similarity
  FROM eligible e
  ORDER BY e.embedding <=> _embedding, e.owner_kind, e.owner_id
  LIMIT greatest(1, least(_limit, 50));
$$;

REVOKE ALL ON FUNCTION public.knowledge_search_queries(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_passages(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_observations(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_passages_by_id(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_observations_by_id(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_knowledge_semantic(extensions.vector, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.knowledge_search_queries(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_passages(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_observations(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_passages_by_id(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_observations_by_id(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_knowledge_semantic(extensions.vector, integer) TO service_role;

COMMIT;
