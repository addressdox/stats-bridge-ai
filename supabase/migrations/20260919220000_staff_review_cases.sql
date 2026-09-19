-- Preserve the existing open-queue RPC while allowing staff to search closed case history.
CREATE OR REPLACE FUNCTION public.staff_review_cases()
RETURNS SETOF public.review_queue
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id AS case_id, c.reference, c.kind, c.status, c.review_reasons, c.question_text,
         c.deadline_at, c.received_at, c.channel, c.is_demo_seed,
         c.assigned_to, p.full_name AS assigned_to_name,
         d.version_number AS latest_draft_version, d.id AS latest_draft_id,
         (SELECT count(*) FROM public.drafts dd WHERE dd.case_id = c.id) AS draft_count,
         EXISTS (SELECT 1 FROM public.approvals a WHERE a.case_id = c.id AND a.status = 'active') AS has_active_approval,
         EXISTS (
           SELECT 1 FROM public.evidence_links e
           JOIN public.source_versions v ON v.id = e.source_version_id
           WHERE e.owner_kind = 'draft' AND e.owner_id = d.id
             AND v.status IN ('withdrawn', 'superseded')
         ) AS source_changed
  FROM public.cases c
  LEFT JOIN public.profiles p ON p.id = c.assigned_to
  LEFT JOIN LATERAL (
    SELECT dd.* FROM public.drafts dd WHERE dd.case_id = c.id
    ORDER BY dd.version_number DESC LIMIT 1
  ) d ON true
  WHERE public.has_permission(auth.uid(), 'cases.review')
  ORDER BY c.received_at DESC, c.id DESC;
$$;
REVOKE ALL ON FUNCTION public.staff_review_cases() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_review_cases() TO authenticated, service_role;
