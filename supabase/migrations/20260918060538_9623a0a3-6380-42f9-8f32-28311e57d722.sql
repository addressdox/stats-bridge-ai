CREATE OR REPLACE FUNCTION public.search_passages(_q text, _limit int DEFAULT 12)
RETURNS TABLE (
  passage_id uuid, content text, page_number int, section_label text,
  source_version_id uuid, version_label text, published_on date, reference_period text,
  original_url text, source_id uuid, title text, publisher text, source_type source_type,
  topic text, rank real
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', _q) AS strict_q,
           (SELECT to_tsquery('english', string_agg(lexeme, ' | '))
              FROM (SELECT unnest(tsvector_to_array(to_tsvector('english', _q))) AS lexeme) words) AS any_q
  ),
  docs AS (
    SELECT p.id, p.content, p.page_number, p.section_label,
           v.id AS source_version_id, v.version_label, v.published_on, v.reference_period, v.original_url,
           s.id AS source_id, s.title, s.publisher, s.source_type, s.topic,
           p.search_text AS doc
      FROM passages p
      JOIN source_versions v ON v.id = p.source_version_id
      JOIN sources s ON s.id = v.source_id
     WHERE v.status = 'approved'
       AND s.audience = 'public'
  )
  SELECT d.id, d.content, d.page_number, d.section_label,
         d.source_version_id, d.version_label, d.published_on, d.reference_period, d.original_url,
         d.source_id, d.title, d.publisher, d.source_type, d.topic,
         ts_rank(d.doc, q.strict_q) AS rank
    FROM docs d CROSS JOIN q
   WHERE (d.doc @@ q.strict_q OR (q.any_q IS NOT NULL AND d.doc @@ q.any_q))
   ORDER BY (d.doc @@ q.strict_q) DESC, ts_rank(d.doc, q.strict_q) DESC,
            d.published_on DESC NULLS LAST
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
    SELECT websearch_to_tsquery('english', _q) AS strict_q,
           (SELECT to_tsquery('english', string_agg(lexeme, ' | '))
              FROM (SELECT unnest(tsvector_to_array(to_tsvector('english', _q))) AS lexeme) words) AS any_q
  ),
  docs AS (
    SELECT o.id, o.measure, o.measure_key, o.display_value, o.value, o.value_state, o.unit,
           o.geography, o.population, o.reference_period, o.period_start, o.period_end,
           o.adjustment, o.reported_change, o.comparability_note, o.page_number, o.table_label,
           v.id AS source_version_id, v.version_label, v.published_on, v.original_url,
           s.title, s.publisher,
           to_tsvector('english',
             o.measure || ' ' || o.geography || ' ' || coalesce(o.population,'') || ' ' ||
             o.reference_period || ' ' || coalesce(o.adjustment,'') || ' ' || s.title) AS doc
      FROM observations o
      JOIN source_versions v ON v.id = o.source_version_id
      JOIN sources s ON s.id = v.source_id
     WHERE v.status = 'approved'
       AND s.audience = 'public'
       AND o.verified_at IS NOT NULL
  )
  SELECT d.id, d.measure, d.measure_key, d.display_value, d.value, d.value_state, d.unit,
         d.geography, d.population, d.reference_period, d.period_start, d.period_end,
         d.adjustment, d.reported_change, d.comparability_note, d.page_number, d.table_label,
         d.source_version_id, d.version_label, d.published_on, d.original_url,
         d.title, d.publisher,
         ts_rank(d.doc, q.strict_q) AS rank
    FROM docs d CROSS JOIN q
   WHERE (d.doc @@ q.strict_q OR (q.any_q IS NOT NULL AND d.doc @@ q.any_q))
   ORDER BY (d.doc @@ q.strict_q) DESC, ts_rank(d.doc, q.strict_q) DESC,
            d.period_end DESC NULLS LAST
   LIMIT greatest(1, least(_limit, 40));
$$;