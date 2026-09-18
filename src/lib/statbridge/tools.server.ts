/**
 * One shared tool set for every assistant surface — the Ask room, the widget
 * and the live voice line.
 *
 * Two families of tool live here:
 *   • retrieval tools, which the assistant may call before it answers. They
 *     only ever read approved, public, South African source material.
 *   • visitor action tools, which do no more than an ordinary visitor may do:
 *     check a case, leave contact details, ask for a person, or lodge a media
 *     enquiry.
 *
 * No tool can invent a figure. Every value still comes from a verified record.
 */
import type { AssistantProvider } from "./provider.server";
import { parseModelJson } from "./provider.server";
import { localizeServiceText } from "./question.server";
import { normalizeLanguage } from "./languages";
import { spokenAnswer } from "./voice";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type RetrievalToolCall = {
  tool: string;
  query?: string;
  measure?: string;
  geography?: string;
};

export type RetrievalResult = {
  passageIds: string[];
  observationIds: string[];
  calls: Array<{ tool: string; query: string; found: number }>;
};

export const RETRIEVAL_TOOLS = [
  {
    name: "search_statistics",
    description:
      "Find human-verified South African figures (values, periods, geographies) for a phrase.",
    arguments: { query: "the measure, period and place in plain words" },
  },
  {
    name: "find_publications",
    description:
      "Find passages of approved Stats SA or other official South African publications for a phrase.",
    arguments: { query: "the subject in plain words" },
  },
  {
    name: "compare_measure",
    description:
      "Gather the same measure across several periods or provinces so a trend or comparison can be shown.",
    arguments: { measure: "the measure name", geography: "province, metro or South Africa" },
  },
] as const;

const PLANNER_SYSTEM = `You plan evidence gathering for StatBridge, the public information assistant for Statistics South Africa.

You do not answer. You only choose which of these read-only tools to call, and with what wording:
${RETRIEVAL_TOOLS.map((t) => `- ${t.name}: ${t.description} arguments: ${JSON.stringify(t.arguments)}`).join("\n")}

Only South African official material exists in this system. Reply with a single JSON object:
{"calls":[{"tool":"search_statistics","query":"..."},{"tool":"compare_measure","measure":"...","geography":"..."}]}

Rules:
- At most 3 calls. Prefer one precise call over several vague ones.
- Use compare_measure when the question asks about change over time, a trend, or a comparison between places.
- Use wording a statistician would use, including the period and the geography when the question implies them.
- If the question is not about South African official statistics, reply {"calls":[]}.`;

/** Asks the assistant which retrieval tools to run. Failure is never fatal. */
export async function planRetrieval(
  assistant: AssistantProvider,
  question: string,
): Promise<RetrievalToolCall[]> {
  try {
    const raw = await assistant.complete({
      system: PLANNER_SYSTEM,
      prompt: `QUESTION: ${question}`,
    });
    const parsed = parseModelJson(raw) as { calls?: RetrievalToolCall[] };
    const calls = Array.isArray(parsed.calls) ? parsed.calls : [];
    return calls
      .filter((call) => RETRIEVAL_TOOLS.some((tool) => tool.name === call.tool))
      .slice(0, 3)
      .map((call) => ({
        tool: call.tool,
        ...(call.query ? { query: String(call.query).slice(0, 300) } : {}),
        ...(call.measure ? { measure: String(call.measure).slice(0, 200) } : {}),
        ...(call.geography ? { geography: String(call.geography).slice(0, 120) } : {}),
      }));
  } catch {
    return [];
  }
}

/** Runs the planned retrieval tools against approved material only. */
export async function runRetrievalTools(
  db: Admin,
  calls: RetrievalToolCall[],
  fallbackQuery: string,
): Promise<RetrievalResult> {
  const passageIds = new Set<string>();
  const observationIds = new Set<string>();
  const log: RetrievalResult["calls"] = [];

  for (const call of calls) {
    const query =
      call.tool === "compare_measure"
        ? [call.measure, call.geography].filter(Boolean).join(" ") || fallbackQuery
        : (call.query ?? fallbackQuery);
    let found = 0;

    if (call.tool === "find_publications") {
      const { data } = await db.rpc("search_passages", { _q: query, _limit: 8 });
      for (const row of (data ?? []) as Array<{ passage_id: string }>) {
        passageIds.add(row.passage_id);
        found += 1;
      }
    } else {
      const limit = call.tool === "compare_measure" ? 16 : 10;
      const { data } = await db.rpc("search_observations", { _q: query, _limit: limit });
      for (const row of (data ?? []) as Array<{ observation_id: string }>) {
        observationIds.add(row.observation_id);
        found += 1;
      }
    }
    log.push({ tool: call.tool, query, found });
  }

  return { passageIds: [...passageIds], observationIds: [...observationIds], calls: log };
}

// ---------------------------------------------------------------------------
// Visitor action tools. Shared by the voice agent endpoint and the chat/widget
// surfaces so that every channel behaves identically.
// ---------------------------------------------------------------------------

export type VisitorToolName = "answer" | "contact" | "human" | "case-status" | "media";

export type VisitorToolInput = {
  tool: string;
  conversationId?: string | null;
  browserToken?: string | null;
  channel?: "web" | "widget" | "api";
  spoken?: boolean;
  values: Record<string, unknown>;
};

type VisitorToolDependencies = Partial<
  Pick<typeof import("./pipeline.server"), "getAdminClient" | "runAsk">
>;

const str = (values: Record<string, unknown>, key: string) => {
  const value = values[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

export async function runVisitorTool(
  input: VisitorToolInput,
  dependencies: VisitorToolDependencies = {},
): Promise<Record<string, unknown> | null> {
  const result = await runVisitorAction(input, dependencies);
  if (!result || input.tool === "answer") return result;
  let language = normalizeLanguage(str(input.values, "language"));
  if (language === "auto" && input.conversationId) {
    const getAdminClient =
      dependencies.getAdminClient ?? (await import("./pipeline.server")).getAdminClient;
    const db = await getAdminClient();
    const { data } = await db
      .from("conversations")
      .select("language")
      .eq("id", input.conversationId)
      .maybeSingle();
    language = normalizeLanguage(data?.language);
  }
  if (typeof result["spoken"] === "string" && language !== "auto") {
    result["spoken"] = await localizeServiceText(result["spoken"], language);
  }
  return { ...result, language: language === "auto" ? "en" : language };
}

async function runVisitorAction(
  input: VisitorToolInput,
  dependencies: VisitorToolDependencies,
): Promise<Record<string, unknown> | null> {
  const { values } = input;
  const conversationId = input.conversationId ?? null;
  const browserToken = input.browserToken ?? "assistant-anonymous";
  const spoken = input.spoken ?? false;
  const getAdminClient =
    dependencies.getAdminClient ?? (await import("./pipeline.server")).getAdminClient;

  switch (input.tool) {
    case "answer": {
      const question = str(values, "question");
      if (!question) return { spoken: "I did not catch the question. Could you say it again?" };

      const runAsk = dependencies.runAsk ?? (await import("./pipeline.server")).runAsk;
      const db = conversationId ? await getAdminClient() : null;
      const { readConversationVisitor } = await import("./visitor-contact.server");
      const owned = Boolean(
        db && (await readConversationVisitor(db, { conversationId, browserToken })),
      );
      let parentAnswerRef: string | null = null;
      if (owned && db && conversationId) {
        const { data: turn } = await db
          .from("conversation_turns")
          .select("answer_id")
          .eq("conversation_id", conversationId)
          .eq("author", "assistant")
          .not("answer_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (turn?.answer_id) {
          const { data: previous } = await db
            .from("answers")
            .select("public_ref")
            .eq("id", turn.answer_id)
            .in("outcome", ["answered", "clarification"])
            .is("case_id", null)
            .eq("review_flag", "none")
            .maybeSingle();
          parentAnswerRef = previous?.public_ref ?? null;
        }
      }
      const answer = await runAsk({
        question,
        readingLevel: "short",
        language: str(values, "language") ?? "auto",
        channel: input.channel ?? "web",
        siteKey: null,
        parentAnswerRef,
        clientKey: spoken ? "voice-agent" : "assistant-tool",
      });

      const line = spokenAnswer(answer) || "No public response wording was available.";
      if (owned && conversationId && db) {
        try {
          const { recordTurn } = await import("./visitors.server");
          const { data: stored } = await db
            .from("answers")
            .select("id")
            .eq("public_ref", answer.answerRef)
            .single();
          await db
            .from("conversations")
            .update({ language: answer.language ?? "en" })
            .eq("id", conversationId);
          await recordTurn(db, { conversationId, author: "visitor", body: question, spoken });
          await recordTurn(db, {
            conversationId,
            author: "assistant",
            body: line,
            outcome: answer.outcome,
            answerId: stored?.id ?? null,
            spoken,
          });
        } catch {
          // A history fault must never withhold a checked answer.
        }
      }

      return {
        outcome: answer.outcome,
        language: answer.language ?? "en",
        answer_ref: answer.answerRef,
        spoken: line,
        citations: [...new Set(answer.references.map((r) => r.title).filter(Boolean))].slice(0, 4),
        case_reference: answer.caseReference ?? null,
      };
    }

    case "contact": {
      const { validateVisitorContact } = await import("./visitor-contact");
      const intake = validateVisitorContact(values);
      if (!intake.ready) return intake.reply;
      const { resolveVisitor } = await import("./visitors.server");
      const { readConversationVisitor } = await import("./visitor-contact.server");
      const db = await getAdminClient();
      const owner = await readConversationVisitor(db, { conversationId, browserToken });
      if (!owner)
        return {
          spoken:
            "I could not link those details to this call, so I have not saved them. Please reconnect the call and try again.",
          saved: false,
        };
      const visitor = await resolveVisitor(db, {
        browserToken,
        contact: intake.contact,
      });
      return {
        saved: true,
        spoken: visitor.returning
          ? "Thank you, I have your details on file."
          : "Thank you, I have noted your details.",
        returning: visitor.returning,
        known_name: visitor.knownName,
      };
    }

    case "human": {
      if (!conversationId)
        return {
          spoken: "I cannot link a request to this call just now. Please reconnect and try again.",
          handoff_id: null,
        };
      const { requestHandoff } = await import("./visitors.server");
      const { readConversationVisitor } = await import("./visitor-contact.server");
      const { validateVisitorContact } = await import("./visitor-contact");
      const { readDeskSettings, callerPhoneOffer, speakableNumber } =
        await import("./settings.server");
      const db = await getAdminClient();
      const visitor = await readConversationVisitor(db, { conversationId, browserToken });
      if (!visitor)
        return {
          spoken:
            "I could not link the request to this call. Please reconnect and ask again; no handover has been logged.",
          handoff_id: null,
        };
      const intake = validateVisitorContact({
        full_name: visitor.full_name,
        email: visitor.email,
        phone: visitor.phone,
        consent: visitor.consent_given,
      });
      if (!intake.ready)
        return {
          ...intake.reply,
          spoken:
            "I can ask an official to follow up. Please tell me your name and an email address or phone number. May we store those details so the Stats SA desk can respond?",
          handoff_id: null,
          next_tool: "save_contact",
        };
      const settings = await readDeskSettings(db);
      const offer = callerPhoneOffer(settings);
      const reasons = [
        "visitor_request",
        "media",
        "sensitive",
        "unsupported",
        "low_confidence",
        "complaint",
        "other",
      ] as const;
      const urgencies = ["low", "normal", "high", "urgent"] as const;
      const reason = str(values, "reason");
      const urgency = str(values, "urgency");
      const handoffId = await requestHandoff(db, {
        conversationId,
        visitorId: visitor.id,
        reason: reasons.includes(reason as (typeof reasons)[number])
          ? (reason as (typeof reasons)[number])
          : "visitor_request",
        urgency: urgencies.includes(urgency as (typeof urgencies)[number])
          ? (urgency as (typeof urgencies)[number])
          : "high",
        topic: str(values, "topic"),
        summary: str(values, "summary") ?? "The visitor asked to speak to a person.",
        channel: spoken ? "voice" : "chat",
        offeredPhone: offer?.number ?? null,
        callerPhone: visitor.phone,
      });

      return {
        handoff_id: handoffId,
        spoken: offer
          ? `I have logged your request for an official, and it is visible on the desk with your contact details. You can also call the ${offer.label} on ${spoken ? speakableNumber(offer.number) : offer.number}. Shall I say the number once more?`
          : "I have logged your request for an official. It is visible on the desk with the contact details you gave me so the team can follow up.",
        officer_phone: offer?.number ?? null,
        officer_phone_label: offer?.label ?? null,
      };
    }

    case "case-status": {
      const reference = str(values, "reference");
      const token = str(values, "token");
      if (!reference || !token) {
        return { spoken: "I need both the reference and the private token to check that." };
      }
      const { hashToken } = await import("./pipeline.server");
      const db = await getAdminClient();
      const { data: row } = await db
        .from("cases")
        .select("reference, status, received_at, status_token_hash")
        .eq("reference", reference.toUpperCase())
        .maybeSingle();
      if (!row || row.status_token_hash !== hashToken(token)) {
        return { spoken: "That reference and token do not match a request I can see." };
      }
      return {
        spoken: `Request ${row.reference} is currently ${row.status.replace(/_/g, " ")}.`,
        status: row.status,
      };
    }

    case "media": {
      const { validateMediaIntake } = await import("./media-intake");
      const intake = validateMediaIntake({ ...values, channel: input.channel ?? "web" });
      if (!intake.ready) return intake.reply;
      const { question, name, outlet, contact, consent, deadline, language } = intake.data;
      const { escalateToCase } = await import("./pipeline.server");
      const db = await getAdminClient();
      const result = await escalateToCase({
        db,
        input: {
          question,
          readingLevel: "short",
          language,
          channel: input.channel ?? "web",
          clientKey: spoken ? "voice-agent" : "assistant-tool",
        },
        reasons: ["media"],
        siteId: null,
        guidelineId: null,
        startedAt: Date.now(),
        kind: "media",
        deadline: deadline ?? null,
        requester: {
          name,
          outlet,
          contact,
          consent,
        },
      });
      return {
        spoken: `I have logged that as a media enquiry. Your reference is ${result.caseReference ?? "being issued"}. An official will respond; I cannot answer media questions myself.`,
        case_reference: result.caseReference ?? null,
      };
    }

    default:
      return null;
  }
}
