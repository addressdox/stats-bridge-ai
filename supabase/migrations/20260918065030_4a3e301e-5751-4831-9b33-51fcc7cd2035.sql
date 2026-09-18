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
    FROM passages p
    JOIN source_versions v ON v.id = p.source_version_id
    JOIN sources s ON s.id = v.source_id
   WHERE p.id = ANY(_ids)
     AND v.status = 'approved'
     AND s.audience = 'public'
   LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.search_passages_by_id(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_passages_by_id(uuid[]) TO service_role;

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
         v.id, v.version_label, v.published_on, v.original_url,
         s.title, s.publisher, 0::real
    FROM observations o
    JOIN source_versions v ON v.id = o.source_version_id
    JOIN sources s ON s.id = v.source_id
   WHERE o.id = ANY(_ids)
     AND v.status = 'approved'
     AND s.audience = 'public'
     AND o.verified_at IS NOT NULL
   LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.search_observations_by_id(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_observations_by_id(uuid[]) TO service_role;