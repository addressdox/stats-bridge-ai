/**
 * Turns the current state of the desk into decision alerts a manager can act
 * on. Run once a day by the scheduled snapshot; every alert states the figure
 * that triggered it so the reader can judge it themselves.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

type Candidate = {
  key: string;
  title: string;
  description: string;
  severity: Database["public"]["Enums"]["alert_severity"];
  metric: string;
  value: number;
  threshold: number;
};

export async function refreshInsightAlerts(
  db: Admin,
): Promise<{ raised: number; resolved: number }> {
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const [overdue, failedJobs, pending, gaps, staleSources, demand] = await Promise.all([
    db
      .from("cases")
      .select("id", { count: "exact", head: true })
      .lt("deadline_at", new Date().toISOString())
      .in("status", ["received", "draft_prepared", "in_review", "changes_requested"]),
    db
      .from("knowledge_ingestion_jobs")
      .select("id", { count: "exact", head: true })
      .eq("state", "failed"),
    db.from("source_versions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("outcome", "gap")
      .gte("created_at", since),
    db
      .from("source_versions")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .lt("published_on", new Date(Date.now() - 365 * 24 * 3600_000).toISOString().slice(0, 10)),
    db
      .from("answers")
      .select("topic,outcome")
      .eq("is_demo_seed", false)
      .gte("created_at", since)
      .limit(5000),
  ]);
  if ([overdue, failedJobs, pending, gaps, staleSources, demand].some((result) => result.error))
    throw new Error("The alert evidence could not be loaded.");

  const candidates: Candidate[] = [
    {
      key: "cases_overdue",
      title: "Requests have passed their deadline",
      description: "Media and public requests are past the time promised to the requester.",
      severity: "critical",
      metric: "overdue_cases",
      value: overdue.count ?? 0,
      threshold: 1,
    },
    {
      key: "ingestion_failed",
      title: "Publications failed to load",
      description:
        "Uploaded or fetched publications could not be read, so nothing from them can be quoted.",
      severity: "warning",
      metric: "failed_ingestions",
      value: failedJobs.count ?? 0,
      threshold: 1,
    },
    {
      key: "sources_pending",
      title: "Publications are waiting for approval",
      description: "Nothing waiting here is searchable until a person approves it.",
      severity: "information",
      metric: "pending_sources",
      value: pending.count ?? 0,
      threshold: 5,
    },
    {
      key: "coverage_gaps",
      title: "People are asking what we cannot answer",
      description: "Questions in the last seven days ended with no approved publication to quote.",
      severity: "warning",
      metric: "coverage_gaps_7d",
      value: gaps.count ?? 0,
      threshold: 10,
    },
    {
      key: "sources_stale",
      title: "Approved publications are more than a year old",
      description: "Older releases may have been superseded by a newer publication.",
      severity: "information",
      metric: "stale_sources",
      value: staleSources.count ?? 0,
      threshold: 3,
    },
  ];

  const topicCounts = new Map<string, { total: number; gaps: number }>();
  for (const answer of demand.data ?? []) {
    const topic = answer.topic?.trim();
    if (!topic) continue;
    const row = topicCounts.get(topic) ?? { total: 0, gaps: 0 };
    row.total++;
    if (answer.outcome === "gap") row.gaps++;
    topicCounts.set(topic, row);
  }
  const repeated = [...topicCounts]
    .filter(([, count]) => count.total >= 5)
    .sort((a, b) => b[1].total - a[1].total);
  candidates.push({
    key: "communications_repeated_topics",
    title: "Recurring questions suggest a communications briefing",
    description: repeated.length
      ? `In the last seven days: ${repeated
          .slice(0, 3)
          .map(
            ([topic, count]) => `${topic}: ${count.total} questions (${count.gaps} evidence gaps)`,
          )
          .join(
            "; ",
          )}. Prepare a reviewed FAQ or press-release draft from approved sources; resolve evidence gaps first.`
      : "No topic reached five recorded questions in the last seven days.",
    severity: "information",
    metric: "topics_with_repeated_questions_7d",
    value: repeated.length,
    threshold: 1,
  });

  let raised = 0;
  let resolved = 0;

  for (const candidate of candidates) {
    const { data: existing } = await db
      .from("insight_alerts")
      .select("id, state")
      .eq("alert_key", candidate.key)
      .neq("state", "resolved")
      .maybeSingle();

    const breached = candidate.value >= candidate.threshold;

    if (breached && !existing) {
      const { error } = await db.from("insight_alerts").insert({
        alert_key: candidate.key,
        title: candidate.title,
        description: `${candidate.description} Currently ${candidate.value}.`,
        severity: candidate.severity,
        state: "open",
        metric_name: candidate.metric,
        metric_value: candidate.value,
        threshold_value: candidate.threshold,
        evidence: { observed: candidate.value, threshold: candidate.threshold } as never,
      });
      if (!error) raised += 1;
    } else if (!breached && existing) {
      const { error } = await db
        .from("insight_alerts")
        .update({ state: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (!error) resolved += 1;
    } else if (breached && existing) {
      await db
        .from("insight_alerts")
        .update({
          metric_value: candidate.value,
          description: `${candidate.description} Currently ${candidate.value}.`,
        })
        .eq("id", existing.id);
    }
  }

  return { raised, resolved };
}
