CREATE VIEW public.review_queue WITH (security_invoker = true) AS
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
            AND v.status IN ('withdrawn','superseded')
       ) AS source_changed
  FROM public.cases c
  LEFT JOIN public.profiles p ON p.id = c.assigned_to
  LEFT JOIN LATERAL (
    SELECT dd.* FROM public.drafts dd WHERE dd.case_id = c.id ORDER BY dd.version_number DESC LIMIT 1
  ) d ON true
 WHERE c.status NOT IN ('released','rejected')
 ORDER BY (c.deadline_at IS NULL), c.deadline_at ASC, c.received_at ASC;
GRANT SELECT ON public.review_queue TO authenticated;

CREATE VIEW public.insight_topics WITH (security_invoker = true) AS
SELECT COALESCE(a.topic,'unclassified') AS topic, a.outcome, count(*) AS question_count,
       bool_or(a.is_demo_seed) AS includes_demo_seed,
       min(a.created_at) AS window_start, max(a.created_at) AS window_end
  FROM public.answers a
 GROUP BY 1, 2;
GRANT SELECT ON public.insight_topics TO authenticated;

CREATE VIEW public.insight_gaps WITH (security_invoker = true) AS
SELECT COALESCE(a.topic,'unclassified') AS topic, count(*) AS gap_count,
       max(a.created_at) AS most_recent,
       (array_agg(a.question_text ORDER BY a.created_at DESC))[1] AS recent_example,
       bool_or(a.is_demo_seed) AS includes_demo_seed
  FROM public.answers a
 WHERE a.outcome = 'gap'
 GROUP BY 1;
GRANT SELECT ON public.insight_gaps TO authenticated;

CREATE VIEW public.insight_turnaround WITH (security_invoker = true) AS
SELECT c.id AS case_id, c.reference, c.kind, c.received_at, c.released_at, c.deadline_at,
       c.is_demo_seed,
       EXTRACT(epoch FROM (c.released_at - c.received_at))/3600.0 AS hours_to_release,
       (c.released_at IS NOT NULL AND c.deadline_at IS NOT NULL AND c.released_at <= c.deadline_at) AS met_deadline
  FROM public.cases c
 WHERE c.kind = 'media';
GRANT SELECT ON public.insight_turnaround TO authenticated;

CREATE VIEW public.decision_record WITH (security_invoker = true) AS
SELECT r.id AS release_id, c.reference, c.kind, c.question_text,
       d.version_number AS released_version, d.author_kind AS first_author_kind,
       da.full_name AS drafted_by, ap.approved_by, aa.full_name AS approved_by_name,
       ap.approved_at, ap.approval_basis, ap.fingerprint,
       rb.full_name AS released_by_name, r.released_at,
       ap.source_version_ids, ap.guideline_id, r.memory_item_id, c.is_demo_seed
  FROM public.releases r
  JOIN public.cases c ON c.id = r.case_id
  JOIN public.drafts d ON d.id = r.draft_id
  JOIN public.approvals ap ON ap.id = r.approval_id
  LEFT JOIN public.profiles da ON da.id = d.author_id
  LEFT JOIN public.profiles aa ON aa.id = ap.approved_by
  LEFT JOIN public.profiles rb ON rb.id = r.released_by
 ORDER BY r.released_at DESC;
GRANT SELECT ON public.decision_record TO authenticated;