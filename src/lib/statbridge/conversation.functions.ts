/**
 * Everything a visitor's browser may do with their own conversation record.
 *
 * The browser only ever holds a random token it generated itself. All reading
 * and writing of visitor records happens here, on the server.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const contactSchema = z.object({
  fullName: z.string().trim().max(120).nullish(),
  email: z.string().trim().email().max(200).nullish(),
  phone: z.string().trim().min(6).max(40).nullish(),
  address: z.string().trim().max(400).nullish(),
  organisation: z.string().trim().max(200).nullish(),
  consent: z.boolean().optional(),
});

const openSchema = z.object({
  browserToken: z.string().trim().min(8).max(80),
  channel: z.enum(["chat", "voice", "widget", "api"]).default("chat"),
  language: z.string().trim().max(12).default("en"),
  device: z.string().trim().max(200).nullish(),
  pageUrl: z.string().trim().max(500).nullish(),
});

export type OpenedConversation = {
  conversationId: string;
  visitorId: string;
  returning: boolean;
  knownName: string | null;
  hasContact: boolean;
};

export const openConversation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => openSchema.parse(input))
  .handler(async ({ data }): Promise<OpenedConversation> => {
    const { getAdminClient } = await import("./pipeline.server");
    const { resolveVisitor, startConversation } = await import("./visitors.server");
    const db = await getAdminClient();

    const visitor = await resolveVisitor(db, { browserToken: data.browserToken });
    const conversationId = await startConversation(db, {
      visitorId: visitor.visitorId,
      channel: data.channel,
      language: data.language,
      device: data.device ?? null,
      pageUrl: data.pageUrl ?? null,
    });

    const { data: row } = await db
      .from("visitors")
      .select("full_name, email, phone")
      .eq("id", visitor.visitorId)
      .maybeSingle();

    return {
      conversationId,
      visitorId: visitor.visitorId,
      returning: visitor.returning,
      knownName: row?.full_name ?? null,
      hasContact: Boolean(row?.email || row?.phone),
    };
  });

export const saveContactDetails = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ browserToken: z.string().trim().min(8).max(80), contact: contactSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./pipeline.server");
    const { resolveVisitor } = await import("./visitors.server");
    const db = await getAdminClient();
    const visitor = await resolveVisitor(db, { browserToken: data.browserToken, contact: data.contact });
    return { visitorId: visitor.visitorId, knownName: visitor.knownName };
  });

export const logConversationTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        author: z.enum(["visitor", "assistant"]),
        body: z.string().trim().min(1).max(8000),
        outcome: z.string().trim().max(40).nullish(),
        spoken: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./pipeline.server");
    const { recordTurn } = await import("./visitors.server");
    const db = await getAdminClient();
    await recordTurn(db, {
      conversationId: data.conversationId,
      author: data.author,
      body: data.body,
      outcome: data.outcome ?? null,
      spoken: data.spoken ?? false,
    });
    return { ok: true };
  });

export const closeConversation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./pipeline.server");
    const { endConversation } = await import("./visitors.server");
    const db = await getAdminClient();
    await endConversation(db, data.conversationId, "ended");
    return { ok: true };
  });

export const askForHuman = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        browserToken: z.string().trim().min(8).max(80),
        reason: z
          .enum(["visitor_request", "media", "sensitive", "unsupported", "low_confidence", "complaint", "other"])
          .default("visitor_request"),
        urgency: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        summary: z.string().trim().min(1).max(2000),
        topic: z.string().trim().max(120).nullish(),
        contact: contactSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./pipeline.server");
    const { resolveVisitor, requestHandoff } = await import("./visitors.server");
    const db = await getAdminClient();

    const visitor = await resolveVisitor(db, {
      browserToken: data.browserToken,
      contact: data.contact ?? {},
    });

    const handoffId = await requestHandoff(db, {
      conversationId: data.conversationId,
      visitorId: visitor.visitorId,
      reason: data.reason,
      urgency: data.urgency,
      topic: data.topic ?? null,
      summary: data.summary,
    });

    return { handoffId };
  });

/** Lets a visitor watch their own conversation while an official replies. */
export const readConversation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string().uuid(), browserToken: z.string().trim().min(8).max(80) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./pipeline.server");
    const db = await getAdminClient();

    const { data: identifier } = await db
      .from("visitor_identifiers")
      .select("visitor_id")
      .eq("kind", "browser_token")
      .eq("value", data.browserToken)
      .maybeSingle();

    const { data: conversation } = await db
      .from("conversations")
      .select("id, visitor_id, state")
      .eq("id", data.conversationId)
      .maybeSingle();

    if (!conversation || !identifier || conversation.visitor_id !== identifier.visitor_id) {
      return { state: null, turns: [], handoff: null };
    }

    const [{ data: turns }, { data: handoff }] = await Promise.all([
      db
        .from("conversation_turns")
        .select("id, author, body, created_at")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: true })
        .limit(200),
      db
        .from("handoffs")
        .select("id, state, accepted_at")
        .eq("conversation_id", data.conversationId)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return { state: conversation.state, turns: turns ?? [], handoff: handoff ?? null };
  });

/** A visitor may send a message once an official has joined. */
export const sendToOfficialThread = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        browserToken: z.string().trim().min(8).max(80),
        body: z.string().trim().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./pipeline.server");
    const { recordTurn } = await import("./visitors.server");
    const db = await getAdminClient();

    const { data: identifier } = await db
      .from("visitor_identifiers")
      .select("visitor_id")
      .eq("kind", "browser_token")
      .eq("value", data.browserToken)
      .maybeSingle();
    const { data: conversation } = await db
      .from("conversations")
      .select("visitor_id")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!identifier || !conversation || conversation.visitor_id !== identifier.visitor_id) {
      throw new Error("This conversation could not be found.");
    }

    await recordTurn(db, { conversationId: data.conversationId, author: "visitor", body: data.body });
    return { ok: true };
  });

/** Removal on request, as the privacy notice promises. */
export const eraseMyRecord = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ browserToken: z.string().trim().min(8).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./pipeline.server");
    const db = await getAdminClient();
    const { data: identifier } = await db
      .from("visitor_identifiers")
      .select("visitor_id")
      .eq("kind", "browser_token")
      .eq("value", data.browserToken)
      .maybeSingle();
    if (!identifier) return { removed: false };
    await db
      .from("visitors")
      .update({ full_name: null, email: null, phone: null, address: null, organisation: null, notes: "Erased on request" })
      .eq("id", identifier.visitor_id);
    await db.from("visitor_identifiers").delete().eq("visitor_id", identifier.visitor_id);
    return { removed: true };
  });
