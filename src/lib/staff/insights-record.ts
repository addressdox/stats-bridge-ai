import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { reviewSearchFilter } from "./review-queue";

const page = z.coerce.number().int().min(1).max(100_000).catch(1);
const size = z.coerce
  .number()
  .pipe(z.union([z.literal(10), z.literal(25), z.literal(50)]))
  .catch(10);
const search = z.string().trim().max(200).catch("");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "Invalid date")
  .or(z.literal(""))
  .catch("");

export const decisionRecordSearchSchema = z.object({
  q: search,
  page,
  size,
  kind: z.enum(["all", "media", "public_escalation"]).catch("all"),
  basis: z.enum(["all", "official", "demonstration"]).catch("all"),
  memory: z.enum(["all", "filed", "not_filed"]).catch("all"),
  from: date,
  to: date,
});
export type DecisionRecordSearch = z.infer<typeof decisionRecordSearchSchema>;

export const insightsSearchSchema = z.object({
  days: z.coerce
    .number()
    .pipe(z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]))
    .catch(30),
  demo: z.enum(["yes", "no"]).catch("no"),
  q: search,
  page,
  size,
  outcome: z.enum(["all", "gaps", "escalated", "answered"]).catch("all"),
  sort: z.enum(["total", "gaps", "escalated", "topic"]).catch("total"),
  alertQ: search,
  alertPage: page,
  severity: z.enum(["all", "information", "warning", "critical"]).catch("all"),
  alertState: z.enum(["unresolved", "all", "open", "acknowledged", "resolved"]).catch("unresolved"),
});
export type InsightsSearch = z.infer<typeof insightsSearchSchema>;
export type TopicCount = {
  topic: string;
  total: number;
  answered: number;
  escalated: number;
  gaps: number;
};

/** Aggregate the complete eligible window before filtering and paging the topic table. */
export function topicCounts(
  answers: Array<{ topic: string | null; outcome: string }>,
): TopicCount[] {
  const topics = new Map<string, TopicCount>();
  for (const answer of answers) {
    const topic = answer.topic ?? "Not classified";
    const row = topics.get(topic) ?? { topic, total: 0, answered: 0, escalated: 0, gaps: 0 };
    row.total += 1;
    if (answer.outcome === "answered") row.answered += 1;
    if (answer.outcome === "escalated") row.escalated += 1;
    if (answer.outcome === "gap") row.gaps += 1;
    topics.set(topic, row);
  }
  return [...topics.values()].sort((a, b) => b.total - a.total || a.topic.localeCompare(b.topic));
}

export function filterTopics(topics: TopicCount[], filters: InsightsSearch) {
  const searchTerm = filters.q.toLocaleLowerCase();
  return topics
    .filter(
      (row) =>
        row.topic.toLocaleLowerCase().includes(searchTerm) &&
        (filters.outcome === "all" || row[filters.outcome] > 0),
    )
    .sort((a, b) =>
      filters.sort === "topic"
        ? a.topic.localeCompare(b.topic)
        : b[filters.sort] - a[filters.sort] || a.topic.localeCompare(b.topic),
    );
}

export function topicPage(topics: TopicCount[], filters: InsightsSearch) {
  const rows = filterTopics(topics, filters);
  const page = Math.min(filters.page, Math.max(1, Math.ceil(rows.length / filters.size)));
  const start = (page - 1) * filters.size;
  return { rows: rows.slice(start, start + filters.size), total: rows.length, page };
}

/** Fetch all rows in stable batches; a PostgREST row cap must never alter metrics or exports. */
export async function collectAll<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  batchSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const response = await fetchPage(offset, offset + batchSize - 1);
    if (response.error)
      throw new Error(
        response.error.message ?? "The decision intelligence records could not be loaded.",
      );
    const batch = response.data ?? [];
    rows.push(...batch);
    if (!batch.length) return rows;
    offset += batch.length;
  }
}

export async function loadDecisionRecord(
  client: SupabaseClient<Database>,
  filters: DecisionRecordSearch,
) {
  let query = client.from("decision_record").select("*", { count: "exact" });
  if (filters.q)
    query = query.or(
      reviewSearchFilter(filters.q, [
        "reference",
        "question_text",
        "drafted_by",
        "approved_by_name",
        "released_by_name",
      ]),
    );
  if (filters.kind !== "all") query = query.eq("kind", filters.kind);
  if (filters.basis !== "all") query = query.eq("approval_basis", filters.basis);
  if (filters.memory === "filed") query = query.not("memory_item_id", "is", null);
  if (filters.memory === "not_filed") query = query.is("memory_item_id", null);
  if (filters.from) query = query.gte("released_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to)
    query = query.lt(
      "released_at",
      new Date(Date.parse(`${filters.to}T00:00:00.000Z`) + 86400000).toISOString(),
    );
  query = query
    .order("released_at", { ascending: false, nullsFirst: false })
    .order("release_id", { ascending: false });
  const start = (filters.page - 1) * filters.size;
  let response = await query.range(start, start + filters.size - 1);
  let page = filters.page;
  if (response.error?.code === "PGRST103" && page > 1) {
    page = 1;
    response = await query.range(0, filters.size - 1);
  }
  if (response.error) throw new Error(response.error.message);
  return { rows: response.data ?? [], total: response.count ?? 0, page };
}

export async function loadInsightAlerts(client: SupabaseClient<Database>, filters: InsightsSearch) {
  let query = client
    .from("insight_alerts")
    .select(
      "id,title,description,severity,state,metric_name,metric_value,threshold_value,created_at",
      { count: "exact" },
    );
  if (filters.alertQ)
    query = query.or(reviewSearchFilter(filters.alertQ, ["title", "description", "metric_name"]));
  if (filters.severity !== "all") query = query.eq("severity", filters.severity);
  if (filters.alertState === "unresolved") query = query.neq("state", "resolved");
  else if (filters.alertState !== "all") query = query.eq("state", filters.alertState);
  query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
  const start = (filters.alertPage - 1) * filters.size;
  let response = await query.range(start, start + filters.size - 1);
  let page = filters.alertPage;
  if (response.error?.code === "PGRST103" && page > 1) {
    page = 1;
    response = await query.range(0, filters.size - 1);
  }
  if (response.error) throw new Error(response.error.message);
  return { rows: response.data ?? [], total: response.count ?? 0, page };
}
