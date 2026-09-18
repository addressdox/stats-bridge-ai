ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_changed_at timestamptz;

COMMENT ON COLUMN public.sources.last_checked_at IS 'When the crawler last looked at this publication listing.';
COMMENT ON COLUMN public.sources.last_changed_at IS 'When a new or changed version of this publication was last seen.';

UPDATE public.sources s
SET last_changed_at = COALESCE(s.last_changed_at, v.newest)
FROM (
  SELECT source_id, MAX(COALESCE(approved_at, created_at)) AS newest
  FROM public.source_versions
  GROUP BY source_id
) v
WHERE v.source_id = s.id;