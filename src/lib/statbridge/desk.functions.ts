/**
 * The staff operations desk: overview figures, conversations, handoffs and
 * visitor records. Every function checks the signed-in staff account first.
 */
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function staffOnly(context: { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }; userId: string }) {
  const { data } = await context.supabase.rpc("is_staff", { _uid: context.userId });
  if (data !== true) throw new Error("This area is for Stats SA communications staff.");
  return context.userId;
}

export type DeskOverview = {
  generatedAt: string;
  liveConversations: number;
  waitingHandoffs: number;
  conversationsToday: number;
  answeredToday: number;
  resolutionRate: number | null;
  averageSeconds: number | null;
  openCases: number;
  coverageGaps: number;
  visitors: number;
};

export const getDeskOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeskOverview> => {
    await staffOnly(context as never);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [live, waiting, today, analyses, cases, gaps, visitors] = await Promise.all([
      db.from("conversations").select("id", { count: "exact", head: true }).eq("state", "active"),
      db.from("handoffs").select("id", { count: "exact", head: true }).eq("state", "waiting"),
      db.from("conversations").select("duration_seconds").gte("started_at", since).limit(1000),
      db.from("conversation_analysis").select("resolved, created_at").gte("created_at", since).limit(1000),
      db.from("cases").select("id", { count: "exact", head: true }).in("status", ["received", "draft_prepared", "in_review", "changes_requested"]),
      db.from("answers").select("id", { count: "exact", head: true }).eq("outcome", "gap").gte("created_at", since),
      db.from("visitors").select("id", { count: "exact", head: true }),
    ]);

    const durations = (today.data ?? []).map((r) => r.duration_seconds).filter((n): n is number => typeof n === "number");
    const resolvedRows = analyses.data ?? [];
    const resolvedCount = resolvedRows.filter((r) => r.resolved).length;

    return {
      generatedAt: new Date().toISOString(),
      liveConversations: live.count ?? 0,
      waitingHandoffs: waiting.count ?? 0,
      conversationsToday: today.data?.length ?? 0,
      answeredToday: resolvedCount,
      resolutionRate: resolvedRows.length > 0 ? Math.round((resolvedCount / resolvedRows.length) * 100) : null,
      averageSeconds:
        durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      openCases: cases.count ?? 0,
      coverageGaps: gaps.count ?? 0,
      visitors: visitors.count ?? 0,
    };
  });

export type DeskConversation = {
  id: string;
  channel: string;
  state: string;
  startedAt: string;
  durationSeconds: number | null;
  turnCount: number;
  visitorName: string | null;
  visitorEmail: string | null;
  summary: string | null;
  topic: string | null;
  sentiment: string | null;
  urgency: string | null;
  resolved: boolean | null;
};

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).default(""),
        state: z.enum(["all", "active", "ended", "handed_off", "abandoned"]).default("all"),
        channel: z.enum(["all", "chat", "voice", "widget", "api"]).default("all"),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<DeskConversation[]> => {
    await staffOnly(context as never);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    let query = db
      .from("conversations")
      .select(
        "id, channel, state, started_at, duration_seconds, turn_count, visitors(full_name, email), conversation_analysis(summary, topic, sentiment, urgency, resolved)",
      )
      .order("started_at", { ascending: false })
      .limit(data.limit);

    if (data.state !== "all") query = query.eq("state", data.state);
    if (data.channel !== "all") query = query.eq("channel", data.channel);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const term = data.search.toLowerCase();
    return (rows ?? [])
      .map((row) => {
        const visitor = row.visitors as { full_name: string | null; email: string | null } | null;
        const analysis = row.conversation_analysis as {
          summary: string | null;
          topic: string | null;
          sentiment: string | null;
          urgency: string | null;
          resolved: boolean | null;
        } | null;
        return {
          id: row.id,
          channel: row.channel,
          state: row.state,
          startedAt: row.started_at,
          durationSeconds: row.duration_seconds,
          turnCount: row.turn_count,
          visitorName: visitor?.full_name ?? null,
          visitorEmail: visitor?.email ?? null,
          summary: analysis?.summary ?? null,
          topic: analysis?.topic ?? null,
          sentiment: analysis?.sentiment ?? null,
          urgency: analysis?.urgency ?? null,
          resolved: analysis?.resolved ?? null,
        };
      })
      .filter((row) =>
        term
          ? [row.visitorName, row.visitorEmail, row.summary, row.topic].some((v) => v?.toLowerCase().includes(term))
          : true,
      );
  });

export const readConversationDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await staffOnly(context as never);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const [conversation, turns, analysis, handoff] = await Promise.all([
      db
        .from("conversations")
        .select("id, channel, state, language, device, page_url, started_at, ended_at, duration_seconds, visitors(id, full_name, email, phone, organisation, conversation_count)")
        .eq("id", data.conversationId)
        .maybeSingle(),
      db
        .from("conversation_turns")
        .select("id, author, body, outcome, created_at, spoken")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: true })
        .limit(300),
      db.from("conversation_analysis").select("*").eq("conversation_id", data.conversationId).maybeSingle(),
      db
        .from("handoffs")
        .select("id, state, reason, urgency, summary, requested_at, accepted_at")
        .eq("conversation_id", data.conversationId)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      conversation: conversation.data,
      turns: turns.data ?? [],
      analysis: analysis.data,
      handoff: handoff.data,
    };
  });

export type DeskHandoff = {
  id: string;
  conversationId: string;
  state: string;
  reason: string;
  urgency: string;
  topic: string | null;
  summary: string;
  requestedAt: string;
  acceptedBy: string | null;
  acceptedByName: string | null;
  visitorName: string | null;
  visitorEmail: string | null;
  visitorPhone: string | null;
  channel: string;
  callerPhone: string | null;
  offeredPhone: string | null;
};

export const listHandoffs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ state: z.enum(["all", "waiting", "accepted", "declined", "transferred", "closed"]).default("all") }).parse(
      input ?? {},
    ),
  )
  .handler(async ({ data, context }): Promise<DeskHandoff[]> => {
    await staffOnly(context as never);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    let query = db
      .from("handoffs")
      .select(
        "id, conversation_id, state, reason, urgency, topic, summary, requested_at, accepted_by, channel, caller_phone, offered_phone, visitors(full_name, email, phone), profiles!handoffs_accepted_by_fkey(full_name)",
      )
      .order("requested_at", { ascending: false })
      .limit(100);
    if (data.state !== "all") query = query.eq("state", data.state);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((row) => {
      const visitor = row.visitors as { full_name: string | null; email: string | null; phone: string | null } | null;
      const officer = row.profiles as { full_name: string } | null;
      return {
        id: row.id,
        conversationId: row.conversation_id,
        state: row.state,
        reason: row.reason,
        urgency: row.urgency,
        topic: row.topic,
        summary: row.summary,
        requestedAt: row.requested_at,
        acceptedBy: row.accepted_by,
        acceptedByName: officer?.full_name ?? null,
        visitorName: visitor?.full_name ?? null,
        visitorEmail: visitor?.email ?? null,
        visitorPhone: visitor?.phone ?? null,
        channel: row.channel,
        callerPhone: row.caller_phone,
        offeredPhone: row.offered_phone,
      };
    });
  });

export const actOnHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        handoffId: z.string().uuid(),
        action: z.enum(["accept", "decline", "transfer", "close"]),
        reason: z.string().trim().max(500).nullish(),
        transferTo: z.string().uuid().nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = await staffOnly(context as never);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    const patch: Record<string, unknown> = {};
    if (data.action === "accept") {
      patch["state"] = "accepted";
      patch["accepted_by"] = userId;
      patch["accepted_at"] = now;
    } else if (data.action === "decline") {
      patch["state"] = "declined";
      patch["declined_by"] = userId;
      patch["declined_at"] = now;
      patch["decline_reason"] = data.reason ?? null;
    } else if (data.action === "transfer") {
      if (!data.transferTo) throw new Error("Choose a colleague to transfer this to.");
      patch["state"] = "transferred";
      patch["transferred_to"] = data.transferTo;
      patch["transferred_at"] = now;
    } else {
      patch["state"] = "closed";
      patch["closed_at"] = now;
    }

    const { data: row, error } = await db.from("handoffs").update(patch as never).eq("id", data.handoffId).select("conversation_id").single();
    if (error) throw new Error(error.message);

    await db.from("handoff_events").insert({
      handoff_id: data.handoffId,
      actor_profile_id: userId,
      action: data.action,
      detail: data.reason ?? data.transferTo ?? null,
    });

    if (data.action === "accept" && row) {
      const { data: profile } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
      await db.from("conversation_turns").insert({
        conversation_id: row.conversation_id,
        author: "system",
        body: `${profile?.full_name ?? "A Stats SA official"} has joined this conversation.`,
      });
    }
    if (data.action === "close" && row) {
      await db.from("conversations").update({ state: "ended", ended_at: now }).eq("id", row.conversation_id);
    }

    return { ok: true };
  });

export const replyAsOfficial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = await staffOnly(context as never);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { recordTurn } = await import("./visitors.server");
    await recordTurn(db, {
      conversationId: data.conversationId,
      author: "official",
      authorProfileId: userId,
      body: data.body,
    });
    return { ok: true };
  });

export const listColleagues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = await staffOnly(context as never);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data } = await db.from("profiles").select("id, full_name, role").eq("is_active", true).neq("id", userId);
    return data ?? [];
  });

export type DeskVisitor = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  organisation: string | null;
  conversationCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  consentGiven: boolean;
};

export const listVisitors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ search: z.string().trim().max(120).default("") }).parse(input ?? {}))
  .handler(async ({ data, context }): Promise<DeskVisitor[]> => {
    await staffOnly(context as never);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await db
      .from("visitors")
      .select("id, full_name, email, phone, organisation, conversation_count, first_seen_at, last_seen_at, consent_given")
      .order("last_seen_at", { ascending: false })
      .limit(200);

    const term = data.search.toLowerCase();
    return (rows ?? [])
      .filter((r) =>
        term ? [r.full_name, r.email, r.phone, r.organisation].some((v) => v?.toLowerCase().includes(term)) : true,
      )
      .map((r) => ({
        id: r.id,
        fullName: r.full_name,
        email: r.email,
        phone: r.phone,
        organisation: r.organisation,
        conversationCount: r.conversation_count,
        firstSeenAt: r.first_seen_at,
        lastSeenAt: r.last_seen_at,
        consentGiven: r.consent_given,
      }));
  });

/** Knowledge health: embedding coverage and the most recent crawler activity. */
export const getKnowledgeHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await staffOnly(context as never);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [embeddings, passages, observations, pending, approved] = await Promise.all([
      db.from("kb_embeddings").select("id", { count: "exact", head: true }),
      db.from("passages").select("id", { count: "exact", head: true }),
      db.from("observations").select("id", { count: "exact", head: true }),
      db.from("source_versions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("source_versions").select("id", { count: "exact", head: true }).eq("status", "approved"),
    ]);
    return {
      embeddings: embeddings.count ?? 0,
      passages: passages.count ?? 0,
      observations: observations.count ?? 0,
      pendingVersions: pending.count ?? 0,
      approvedVersions: approved.count ?? 0,
    };
  });

export const rebuildEmbeddings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await staffOnly(context as never);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { backfillEmbeddings } = await import("./embeddings.server");
    return await backfillEmbeddings(db, 200);
  });
