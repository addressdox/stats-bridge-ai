import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { DeskConversation, DeskHandoff, DeskVisitor } from "@/lib/statbridge/desk.functions";
import { reviewSearchFilter } from "./review-queue";

const paging = {
  search: z.string().trim().max(120).default(""),
  page: z.number().int().min(1).max(100_000).default(1),
  pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]).default(10),
  sort: z.enum(["newest", "oldest"]).default("newest"),
};
export const conversationCollectionSchema = z.object({
  ...paging,
  state: z.enum(["all", "active", "ended", "handed_off", "abandoned"]).default("all"),
  channel: z.enum(["all", "chat", "voice", "widget", "api"]).default("all"),
});
export const handoffCollectionSchema = z.object({
  ...paging,
  state: z
    .enum(["all", "waiting", "accepted", "declined", "transferred", "closed"])
    .default("waiting"),
  urgency: z.enum(["all", "low", "normal", "high", "urgent"]).default("all"),
  channel: z.enum(["all", "chat", "voice", "widget", "api"]).default("all"),
});
export const visitorCollectionSchema = z.object({
  ...paging,
  consent: z.enum(["all", "given", "missing"]).default("all"),
  activity: z.enum(["all", "returning", "single"]).default("all"),
});
export type ConversationCollectionFilters = z.infer<typeof conversationCollectionSchema>;
export type HandoffCollectionFilters = z.infer<typeof handoffCollectionSchema>;
export type VisitorCollectionFilters = z.infer<typeof visitorCollectionSchema>;
export type CollectionPage<T> = { rows: T[]; total: number; page: number };

export async function loadConversationPage(
  db: SupabaseClient<Database>,
  filters: ConversationCollectionFilters,
): Promise<CollectionPage<DeskConversation>> {
  // Empty embeds are used only for matching. The full relationships remain intact
  // for display even when the search matched a different field.
  let query = db
    .from("conversations")
    .select(
      "id, channel, state, started_at, duration_seconds, turn_count, visitors(full_name, email), conversation_analysis(summary, topic, sentiment, urgency, resolved), match_visitors:visitors(), match_analysis:conversation_analysis()",
      { count: "exact" },
    );
  if (filters.state !== "all") query = query.eq("state", filters.state);
  if (filters.channel !== "all") query = query.eq("channel", filters.channel);
  if (filters.search)
    query = query
      .or(reviewSearchFilter(filters.search, ["full_name", "email"]), {
        referencedTable: "match_visitors",
      })
      .or(reviewSearchFilter(filters.search, ["summary", "topic"]), {
        referencedTable: "match_analysis",
      })
      .or("match_visitors.not.is.null,match_analysis.not.is.null");
  query = query
    .order("started_at", { ascending: filters.sort === "oldest" })
    .order("id", { ascending: filters.sort === "oldest" });
  const start = (filters.page - 1) * filters.pageSize;
  let result = await query.range(start, start + filters.pageSize - 1);
  let page = filters.page;
  if (result.error?.code === "PGRST103" && page > 1) {
    page = 1;
    result = await query.range(0, filters.pageSize - 1);
  }
  if (result.error) throw new Error(result.error.message);
  return {
    page,
    total: result.count ?? 0,
    rows: (result.data ?? []).map((row) => ({
      id: row.id,
      channel: row.channel,
      state: row.state,
      startedAt: row.started_at,
      durationSeconds: row.duration_seconds,
      turnCount: row.turn_count,
      visitorName: row.visitors?.full_name ?? null,
      visitorEmail: row.visitors?.email ?? null,
      summary: row.conversation_analysis?.summary ?? null,
      topic: row.conversation_analysis?.topic ?? null,
      sentiment: row.conversation_analysis?.sentiment ?? null,
      urgency: row.conversation_analysis?.urgency ?? null,
      resolved: row.conversation_analysis?.resolved ?? null,
    })),
  };
}

export async function loadHandoffPage(
  db: SupabaseClient<Database>,
  filters: HandoffCollectionFilters,
): Promise<CollectionPage<DeskHandoff> & { waitingTotal: number }> {
  let query = db
    .from("handoffs")
    .select(
      "id, conversation_id, state, reason, urgency, topic, summary, requested_at, accepted_by, channel, caller_phone, offered_phone, visitors(full_name, email, phone), profiles!handoffs_accepted_by_fkey(full_name), match_visitors:visitors(), match_officer:profiles!handoffs_accepted_by_fkey()",
      { count: "exact" },
    );
  if (filters.state !== "all") query = query.eq("state", filters.state);
  if (filters.urgency !== "all") query = query.eq("urgency", filters.urgency);
  if (filters.channel !== "all") query = query.eq("channel", filters.channel);
  if (filters.search)
    query = query
      .or(reviewSearchFilter(filters.search, ["full_name", "email", "phone"]), {
        referencedTable: "match_visitors",
      })
      .or(reviewSearchFilter(filters.search, ["full_name"]), { referencedTable: "match_officer" })
      .or(
        `${reviewSearchFilter(filters.search, ["summary", "topic", "caller_phone"])},match_visitors.not.is.null,match_officer.not.is.null`,
      );
  query = query
    .order("requested_at", { ascending: filters.sort === "oldest" })
    .order("id", { ascending: filters.sort === "oldest" });
  const start = (filters.page - 1) * filters.pageSize;
  const [firstPage, waiting] = await Promise.all([
    query.range(start, start + filters.pageSize - 1),
    db.from("handoffs").select("id", { count: "exact", head: true }).eq("state", "waiting"),
  ]);
  let result = firstPage;
  let page = filters.page;
  if (result.error?.code === "PGRST103" && page > 1) {
    page = 1;
    result = await query.range(0, filters.pageSize - 1);
  }
  if (result.error) throw new Error(result.error.message);
  if (waiting.error) throw new Error(waiting.error.message);
  return {
    page,
    total: result.count ?? 0,
    waitingTotal: waiting.count ?? 0,
    rows: (result.data ?? []).map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      state: row.state,
      reason: row.reason,
      urgency: row.urgency,
      topic: row.topic,
      summary: row.summary,
      requestedAt: row.requested_at,
      acceptedBy: row.accepted_by,
      acceptedByName: row.profiles?.full_name ?? null,
      visitorName: row.visitors?.full_name ?? null,
      visitorEmail: row.visitors?.email ?? null,
      visitorPhone: row.visitors?.phone ?? null,
      channel: row.channel,
      callerPhone: row.caller_phone,
      offeredPhone: row.offered_phone,
    })),
  };
}

export async function loadVisitorPage(
  db: SupabaseClient<Database>,
  filters: VisitorCollectionFilters,
): Promise<CollectionPage<DeskVisitor>> {
  let query = db
    .from("visitors")
    .select(
      "id, full_name, email, phone, organisation, conversation_count, first_seen_at, last_seen_at, consent_given",
      { count: "exact" },
    );
  if (filters.search)
    query = query.or(
      reviewSearchFilter(filters.search, ["full_name", "email", "phone", "organisation"]),
    );
  if (filters.consent !== "all") query = query.eq("consent_given", filters.consent === "given");
  if (filters.activity === "returning") query = query.gt("conversation_count", 1);
  if (filters.activity === "single") query = query.lte("conversation_count", 1);
  query = query
    .order("last_seen_at", { ascending: filters.sort === "oldest" })
    .order("id", { ascending: filters.sort === "oldest" });
  const start = (filters.page - 1) * filters.pageSize;
  let result = await query.range(start, start + filters.pageSize - 1);
  let page = filters.page;
  if (result.error?.code === "PGRST103" && page > 1) {
    page = 1;
    result = await query.range(0, filters.pageSize - 1);
  }
  if (result.error) throw new Error(result.error.message);
  return {
    page,
    total: result.count ?? 0,
    rows: (result.data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      organisation: row.organisation,
      conversationCount: row.conversation_count,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      consentGiven: row.consent_given,
    })),
  };
}
