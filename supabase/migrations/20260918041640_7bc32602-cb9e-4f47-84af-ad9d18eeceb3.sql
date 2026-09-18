CREATE OR REPLACE FUNCTION public.search_passages(_q text, _limit int DEFAULT 12)
RETURNS TABLE (
  passage_id uuid, content text, page_number int, section_label text,
  source_version_id uuid, version_label text, published_on date, reference_period text,
  original_url text, source_id uuid, title text, publisher text, source_type source_type,
  topic text, rank real
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.content, p.page_number, p.section_label,
         v.id, v.version_label, v.published_on, v.reference_period, v.original_url,
         s.id, s.title, s.publisher, s.source_type, s.topic,
         ts_rank(p.search_text, websearch_to_tsquery('english', _q)) AS rank
    FROM passages p
    JOIN source_versions v ON v.id = p.source_version_id
    JOIN sources s ON s.id = v.source_id
   WHERE v.status = 'approved'
     AND s.audience = 'public'
     AND p.search_text @@ websearch_to_tsquery('english', _q)
   ORDER BY rank DESC, v.published_on DESC NULLS LAST
   LIMIT greatest(1, least(_limit, 40));
$$;
REVOKE EXECUTE ON FUNCTION public.search_passages(text,int) FROM PUBLIC, anon;

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
  SELECT o.id, o.measure, o.measure_key, o.display_value, o.value, o.value_state, o.unit,
         o.geography, o.population, o.reference_period, o.period_start, o.period_end,
         o.adjustment, o.reported_change, o.comparability_note, o.page_number, o.table_label,
         v.id, v.version_label, v.published_on, v.original_url, s.title, s.publisher,
         ts_rank(to_tsvector('english',
           o.measure || ' ' || o.geography || ' ' || coalesce(o.population,'') || ' ' ||
           o.reference_period || ' ' || coalesce(o.adjustment,'') || ' ' || s.title),
           websearch_to_tsquery('english', _q)) AS rank
    FROM observations o
    JOIN source_versions v ON v.id = o.source_version_id
    JOIN sources s ON s.id = v.source_id
   WHERE v.status = 'approved'
     AND s.audience = 'public'
     AND o.verified_by IS NOT NULL
     AND to_tsvector('english',
           o.measure || ' ' || o.geography || ' ' || coalesce(o.population,'') || ' ' ||
           o.reference_period || ' ' || coalesce(o.adjustment,'') || ' ' || s.title)
         @@ websearch_to_tsquery('english', _q)
   ORDER BY rank DESC, o.period_end DESC NULLS LAST
   LIMIT greatest(1, least(_limit, 40));
$$;
REVOKE EXECUTE ON FUNCTION public.search_observations(text,int) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.search_memory(_q text, _limit int DEFAULT 5)
RETURNS TABLE (
  memory_id uuid, item_type memory_type, title text, body text, topic text,
  communicated_on date, reference_period text, reuse_status reuse_status,
  approval_basis approval_basis, rank real
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.item_type, m.title, m.body, m.topic, m.communicated_on, m.reference_period,
         m.reuse_status, m.approval_basis,
         ts_rank(m.search_text, websearch_to_tsquery('english', _q)) AS rank
    FROM memory_items m
   WHERE m.reuse_status IN ('reusable','needs_review')
     AND m.search_text @@ websearch_to_tsquery('english', _q)
   ORDER BY rank DESC, m.communicated_on DESC
   LIMIT greatest(1, least(_limit, 20));
$$;
REVOKE EXECUTE ON FUNCTION public.search_memory(text,int) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.bump_rate_counter(_key_hash text, _window_start timestamptz, _limit int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c int;
BEGIN
  INSERT INTO rate_counters(key_hash, window_start, count)
  VALUES (_key_hash, _window_start, 1)
  ON CONFLICT (key_hash, window_start) DO UPDATE SET count = rate_counters.count + 1
  RETURNING count INTO c;
  DELETE FROM rate_counters WHERE window_start < now() - interval '2 hours';
  RETURN c <= _limit;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.bump_rate_counter(text,timestamptz,int) FROM PUBLIC, anon, authenticated;