import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { reviewSearchFilter } from "./review-queue";

const paging = {
  q: z.string().trim().max(200).catch(""),
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
  size: z.coerce
    .number()
    .pipe(z.union([z.literal(10), z.literal(25), z.literal(50)]))
    .catch(10),
};
export const sourceRegisterSearchSchema = z.object({
  ...paging,
  status: z
    .enum(["all", "pending", "approved", "rejected", "withdrawn", "superseded"])
    .catch("all"),
  sourceType: z
    .enum([
      "all",
      "statistical_release",
      "media_release",
      "methodology",
      "organisational_page",
      "faq_page",
      "other",
    ])
    .catch("all"),
  audience: z.enum(["all", "public", "staff"]).catch("all"),
});
export type SourceRegisterSearch = z.infer<typeof sourceRegisterSearchSchema>;
type SourceSummary = {
  id: string;
  status: string;
  version_label: string;
  job?: { file_name: string | null } | null;
  sources: {
    title: string;
    publisher: string;
    topic: string | null;
    source_type: string;
    audience: string;
  } | null;
};
/** Filter the complete register before slicing, retaining the server's stable newest-first order. */
export function sourceRegisterPage<T extends SourceSummary>(
  rows: T[],
  filters: SourceRegisterSearch,
) {
  const needle = filters.q.toLowerCase();
  const matching = rows.filter(
    (v) =>
      `${v.sources?.title ?? ""} ${v.sources?.publisher ?? ""} ${v.sources?.topic ?? ""} ${v.sources?.source_type?.replaceAll("_", " ") ?? ""} ${v.sources?.audience ?? ""} ${v.version_label} ${v.job?.file_name ?? ""} ${v.id}`
        .toLowerCase()
        .includes(needle) &&
      (filters.status === "all" || v.status === filters.status) &&
      (filters.sourceType === "all" || v.sources?.source_type === filters.sourceType) &&
      (filters.audience === "all" || v.sources?.audience === filters.audience),
  );
  const page = Math.min(filters.page, Math.max(1, Math.ceil(matching.length / filters.size)));
  return {
    rows: matching.slice((page - 1) * filters.size, page * filters.size),
    total: matching.length,
    page,
  };
}

export const memorySearchSchema = z.object({
  ...paging,
  status: z.enum(["all", "reusable", "needs_review", "historical_only", "withdrawn"]).catch("all"),
  kind: z
    .enum([
      "all",
      "media_response",
      "press_release",
      "official_statement",
      "faq",
      "other_messaging",
    ])
    .catch("all"),
  audience: z.enum(["all", "public", "staff"]).catch("all"),
});
export type MemorySearch = z.infer<typeof memorySearchSchema>;
export async function loadMemoryPage(
  db: SupabaseClient<Database>,
  filters: MemorySearch,
  signal?: AbortSignal,
) {
  let query = db
    .from("memory_items")
    .select(
      "id,title,body,item_type,topic,audience,communicated_on,reference_period,origin,approval_basis,reuse_status,review_flag_reason,is_demo_seed,original_url",
      { count: "exact" },
    );
  if (filters.q) query = query.or(reviewSearchFilter(filters.q, ["title", "body", "topic"]));
  if (filters.status !== "all") query = query.eq("reuse_status", filters.status);
  if (filters.kind !== "all") query = query.eq("item_type", filters.kind);
  if (filters.audience !== "all") query = query.eq("audience", filters.audience);
  query = query.order("communicated_on", { ascending: false }).order("id", { ascending: false });
  const start = (filters.page - 1) * filters.size;
  query = query.range(start, start + filters.size - 1);
  if (signal) query = query.abortSignal(signal);
  let response = await query,
    page = filters.page;
  if (response.error?.code === "PGRST103" && page > 1) {
    page = 1;
    response = await query.range(0, filters.size - 1);
  }
  if (response.error) throw new Error(response.error.message);
  return { rows: response.data ?? [], total: response.count ?? 0, page };
}
