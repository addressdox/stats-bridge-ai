import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const page = z.coerce.number().int().min(1).max(100_000).catch(1);
const search = z.string().trim().max(200).catch("");
const attention = z.enum(["all", "sensitive", "complex", "source_changed"]).catch("all");

export const reviewQueueSearchSchema = z.object({
  q: search,
  page,
  size: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50)])).catch(10),
  status: z.enum(["open", "all", "received", "draft_prepared", "in_review", "changes_requested", "approved", "released", "rejected"]).catch("open"),
  kind: z.enum(["all", "media", "public_escalation"]).catch("all"),
  attention,
  assignment: z.enum(["all", "mine", "unassigned"]).catch("all"),
  emailQ: search,
  emailPage: page,
  delivery: z.enum(["all", "shown", "queued", "sent", "failed"]).catch("all"),
  emailAttention: z.enum(["all", "sensitive", "complex"]).catch("all"),
});

export type ReviewQueueSearch = z.infer<typeof reviewQueueSearchSchema>;

/** Quote PostgREST filter values and treat user-entered LIKE wildcards literally. */
export function reviewSearchFilter(value: string, columns: string[]) {
  const escaped = value.replace(/[\\%_*]/g, "\\$&").replace(/"/g, '\\"');
  return columns.map((column) => `${column}.ilike."%${escaped}%"`).join(",");
}

export async function loadReviewQueue(client: SupabaseClient<Database>, filters: ReviewQueueSearch, userId: string, signal?: AbortSignal) {
  let query = client.rpc("staff_review_cases", undefined, { count: "exact" });
  if (filters.q) query = query.or(reviewSearchFilter(filters.q, ["reference", "question_text", "assigned_to_name"]));
  if (filters.status === "open") query = query.not("status", "in", "(released,rejected)");
  else if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.kind !== "all") query = query.eq("kind", filters.kind);
  if (filters.attention === "source_changed") query = query.eq("source_changed", true);
  else if (filters.attention !== "all") query = query.contains("review_reasons", [filters.attention]);
  if (filters.assignment === "mine") query = query.eq("assigned_to", userId);
  else if (filters.assignment === "unassigned") query = query.is("assigned_to", null);
  query = query.order("received_at", { ascending: false, nullsFirst: false }).order("case_id", { ascending: false });
  const start = (filters.page - 1) * filters.size;
  query = query.range(start, start + filters.size - 1);
  if (signal) query = query.abortSignal(signal);
  let response = await query;
  let page = filters.page;
  // A saved URL or concurrent review may move the requested page past the end.
  if (response.error?.code === "PGRST103" && page > 1) {
    page = 1;
    response = await query.range(0, filters.size - 1);
  }
  if (response.error) throw new Error(response.error.message);
  return { rows: response.data ?? [], total: response.count ?? 0, page };
}

export async function loadMediaDelivery(client: SupabaseClient<Database>, filters: ReviewQueueSearch, signal?: AbortSignal) {
  let query = client.from("releases")
    .select("id,case_id,delivery_state,released_at,cases!inner(reference,kind,question_text,review_reasons,is_demo_seed)", { count: "exact" })
    .eq("cases.kind", "media");
  if (filters.emailQ) query = query.or(reviewSearchFilter(filters.emailQ, ["reference", "question_text"]), { referencedTable: "cases" });
  if (filters.delivery !== "all") query = query.eq("delivery_state", filters.delivery);
  if (filters.emailAttention !== "all") query = query.contains("cases.review_reasons", [filters.emailAttention]);
  query = query.order("released_at", { ascending: false }).order("id", { ascending: false });
  const start = (filters.emailPage - 1) * filters.size;
  query = query.range(start, start + filters.size - 1);
  if (signal) query = query.abortSignal(signal);
  let response = await query;
  let page = filters.emailPage;
  // A saved URL or concurrent review may move the requested page past the end.
  if (response.error?.code === "PGRST103" && page > 1) {
    page = 1;
    response = await query.range(0, filters.size - 1);
  }
  if (response.error) throw new Error(response.error.message);
  return { rows: response.data ?? [], total: response.count ?? 0, page };
}
