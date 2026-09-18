/**
 * Visitor identity, conversation history and human handoff.
 *
 * Nothing here is reachable from the browser directly: every table is closed to
 * the public key and only server functions may write. Staff read it through the
 * desk.
 */
import { getAssistant, parseModelJson } from "./provider.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type ContactDetails = {
  fullName?: string | null | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  address?: string | null | undefined;
  organisation?: string | null | undefined;
  consent?: boolean | undefined;
};

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Finds the visitor behind a browser token, email or phone, creating one if needed. */
export async function resolveVisitor(
  db: Admin,
  args: { browserToken: string; contact?: ContactDetails },
): Promise<{ visitorId: string; returning: boolean; knownName: string | null }> {
  const token = args.browserToken.trim();
  const email = clean(args.contact?.email)?.toLowerCase() ?? null;
  const phone = clean(args.contact?.phone);

  const lookups = [
    { kind: "browser_token", value: token },
    ...(email ? [{ kind: "email", value: email }] : []),
    ...(phone ? [{ kind: "phone", value: phone }] : []),
  ];

  let visitorId: string | null = null;
  for (const lookup of lookups) {
    const { data } = await db
      .from("visitor_identifiers")
      .select("visitor_id")
      .eq("kind", lookup.kind)
      .eq("value", lookup.value)
      .maybeSingle();
    if (data?.visitor_id) {
      visitorId = data.visitor_id;
      break;
    }
  }

  const returning = visitorId !== null;

  if (!visitorId) {
    const { data, error } = await db
      .from("visitors")
      .insert({
        full_name: clean(args.contact?.fullName),
        email,
        phone,
        address: clean(args.contact?.address),
        organisation: clean(args.contact?.organisation),
        consent_given: args.contact?.consent ?? false,
        consent_at: args.contact?.consent ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not record this visitor.");
    visitorId = data.id;
  }

  for (const lookup of lookups) {
    await db
      .from("visitor_identifiers")
      .upsert({ visitor_id: visitorId, kind: lookup.kind, value: lookup.value }, { onConflict: "kind,value" });
  }

  const patch: Record<string, string | boolean | null> = { last_seen_at: new Date().toISOString() };
  if (clean(args.contact?.fullName)) patch["full_name"] = clean(args.contact?.fullName);
  if (email) patch["email"] = email;
  if (phone) patch["phone"] = phone;
  if (clean(args.contact?.address)) patch["address"] = clean(args.contact?.address);
  if (clean(args.contact?.organisation)) patch["organisation"] = clean(args.contact?.organisation);
  if (args.contact?.consent) {
    patch["consent_given"] = true;
    patch["consent_at"] = new Date().toISOString();
  }
  await db.from("visitors").update(patch as never).eq("id", visitorId);

  const { data: visitor } = await db.from("visitors").select("full_name").eq("id", visitorId).maybeSingle();

  return { visitorId, returning, knownName: visitor?.full_name ?? null };
}

export async function startConversation(
  db: Admin,
  args: {
    visitorId: string;
    channel: "chat" | "voice" | "widget" | "api";
    language?: string;
    device?: string | null;
    pageUrl?: string | null;
  },
) {
  const { data, error } = await db
    .from("conversations")
    .insert({
      visitor_id: args.visitorId,
      channel: args.channel,
      language: args.language ?? "en",
      device: args.device ?? null,
      page_url: args.pageUrl ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not start this conversation.");

  const { count } = await db
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("visitor_id", args.visitorId);
  await db
    .from("visitors")
    .update({ conversation_count: count ?? 1, last_seen_at: new Date().toISOString() })
    .eq("id", args.visitorId);

  return data.id;
}

export async function recordTurn(
  db: Admin,
  args: {
    conversationId: string;
    author: "visitor" | "assistant" | "official" | "system";
    body: string;
    answerId?: string | null;
    outcome?: string | null;
    toolsUsed?: string[];
    spoken?: boolean;
    authorProfileId?: string | null;
  },
) {
  const { data, error } = await db
    .from("conversation_turns")
    .insert({
      conversation_id: args.conversationId,
      author: args.author,
      author_profile_id: args.authorProfileId ?? null,
      body: args.body.slice(0, 8000),
      answer_id: args.answerId ?? null,
      outcome: (args.outcome ?? null) as never,
      tools_used: args.toolsUsed ?? [],
      spoken: args.spoken ?? false,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { count } = await db
    .from("conversation_turns")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", args.conversationId);
  await db.from("conversations").update({ turn_count: count ?? 0 }).eq("id", args.conversationId);

  return data?.id ?? null;
}

const ANALYSIS_PROMPT = `You read one finished conversation between a member of the public and the Statistics South Africa assistant.

Reply with a single JSON object and nothing else:
{
  "summary": "two sentences describing what the person wanted and what happened",
  "topic": "short lowercase topic label",
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "urgency": "low" | "normal" | "high" | "urgent",
  "resolved": true | false,
  "unmetNeed": "one sentence, or empty when the person got what they wanted",
  "keyPoints": ["up to 4 short factual points"]
}

Describe only what is in the transcript. Never add figures, causes or opinions.`;

/** Summarises and grades a finished conversation for the desk. */
export async function analyseConversation(db: Admin, conversationId: string) {
  const { data: turns } = await db
    .from("conversation_turns")
    .select("author, body, outcome")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(80);

  if (!turns || turns.length === 0) return null;

  const transcript = turns.map((t) => `${t.author.toUpperCase()}: ${t.body}`).join("\n");

  let analysis = {
    summary: `${turns.length} turns exchanged.`,
    topic: null as string | null,
    sentiment: "neutral" as "positive" | "neutral" | "negative" | "frustrated",
    urgency: "normal" as "low" | "normal" | "high" | "urgent",
    resolved: turns.some((t) => t.outcome === "answered"),
    unmetNeed: null as string | null,
    keyPoints: [] as string[],
  };

  try {
    const assistant = getAssistant();
    const raw = await assistant.complete({ system: ANALYSIS_PROMPT, prompt: transcript.slice(0, 12000) });
    const parsed = parseModelJson(raw) as Partial<typeof analysis> & { unmetNeed?: string };
    analysis = {
      summary: typeof parsed.summary === "string" && parsed.summary ? parsed.summary : analysis.summary,
      topic: typeof parsed.topic === "string" ? parsed.topic : null,
      sentiment: (["positive", "neutral", "negative", "frustrated"] as const).includes(parsed.sentiment as never)
        ? (parsed.sentiment as typeof analysis.sentiment)
        : "neutral",
      urgency: (["low", "normal", "high", "urgent"] as const).includes(parsed.urgency as never)
        ? (parsed.urgency as typeof analysis.urgency)
        : "normal",
      resolved: typeof parsed.resolved === "boolean" ? parsed.resolved : analysis.resolved,
      unmetNeed: typeof parsed.unmetNeed === "string" && parsed.unmetNeed.trim() ? parsed.unmetNeed.trim() : null,
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.filter((p) => typeof p === "string").slice(0, 4) : [],
    };
  } catch {
    // The transcript is still recorded even when the summary cannot be written.
  }

  await db.from("conversation_analysis").upsert({
    conversation_id: conversationId,
    summary: analysis.summary,
    topic: analysis.topic,
    sentiment: analysis.sentiment,
    urgency: analysis.urgency,
    resolved: analysis.resolved,
    unmet_need: analysis.unmetNeed,
    key_points: analysis.keyPoints,
  });

  return analysis;
}

export async function endConversation(db: Admin, conversationId: string, state: "ended" | "abandoned" = "ended") {
  const { data: row } = await db.from("conversations").select("started_at, state").eq("id", conversationId).maybeSingle();
  if (!row) return null;
  if (row.state === "handed_off") return null;

  const endedAt = new Date();
  const seconds = Math.max(0, Math.round((endedAt.getTime() - new Date(row.started_at).getTime()) / 1000));
  await db
    .from("conversations")
    .update({ state, ended_at: endedAt.toISOString(), duration_seconds: seconds })
    .eq("id", conversationId);

  return await analyseConversation(db, conversationId);
}

/** Raises a request for a Stats SA official to take over. */
export async function requestHandoff(
  db: Admin,
  args: {
    conversationId: string;
    visitorId: string | null;
    reason: "visitor_request" | "media" | "sensitive" | "unsupported" | "low_confidence" | "complaint" | "other";
    urgency?: "low" | "normal" | "high" | "urgent";
    topic?: string | null;
    summary: string;
    caseId?: string | null;
  },
) {
  const { data: open } = await db
    .from("handoffs")
    .select("id, state")
    .eq("conversation_id", args.conversationId)
    .in("state", ["waiting", "accepted"])
    .maybeSingle();
  if (open) return open.id;

  const { data, error } = await db
    .from("handoffs")
    .insert({
      conversation_id: args.conversationId,
      visitor_id: args.visitorId,
      case_id: args.caseId ?? null,
      reason: args.reason,
      urgency: args.urgency ?? "normal",
      topic: args.topic ?? null,
      summary: args.summary.slice(0, 2000),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not reach an official just now.");

  await db.from("conversations").update({ state: "handed_off" }).eq("id", args.conversationId);
  await db.from("handoff_events").insert({ handoff_id: data.id, action: "requested", detail: args.reason });
  await db.from("conversation_turns").insert({
    conversation_id: args.conversationId,
    author: "system",
    body: "Handed over to a Stats SA official. Someone will join this conversation.",
  });

  return data.id;
}
