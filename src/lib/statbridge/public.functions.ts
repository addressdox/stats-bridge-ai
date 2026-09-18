/**
 * The four public doors into StatBridge: ask, escalate, media intake and
 * private case status. Everything privileged happens behind them.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
  askRequestSchema,
  caseStatusRequestSchema,
  CASE_STATUS_LABELS,
  escalateRequestSchema,
  mediaQueryRequestSchema,
  type CaseStatus,
  type PublicAnswer,
} from "./contract";
import { spokenAnswer } from "./voice";

function clientKey() {
  try {
    const request = getRequest();
    return (
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "anonymous"
    );
  } catch {
    return "anonymous";
  }
}

export const askQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => askRequestSchema.parse(input))
  .handler(async ({ data }): Promise<PublicAnswer> => {
    const { runAsk } = await import("./pipeline.server");
    const answer = await runAsk({
      question: data.question,
      readingLevel: data.readingLevel,
      language: data.language,
      channel: data.channel,
      siteKey: data.siteKey ?? null,
      parentAnswerRef: data.parentAnswerRef ?? null,
      clientKey: clientKey(),
    });

    // The conversation record is kept alongside the answer, never instead of it.
    if (data.conversationId) {
      try {
        const { getAdminClient } = await import("./pipeline.server");
        const { recordTurn } = await import("./visitors.server");
        const db = await getAdminClient();
        const [{ data: identifier }, { data: conversation }, { data: stored }] = await Promise.all([
          db
            .from("visitor_identifiers")
            .select("visitor_id")
            .eq("kind", "browser_token")
            .eq("value", data.browserToken ?? "")
            .maybeSingle(),
          db.from("conversations").select("visitor_id").eq("id", data.conversationId).maybeSingle(),
          db.from("answers").select("id").eq("public_ref", answer.answerRef).single(),
        ]);
        if (!identifier || identifier.visitor_id !== conversation?.visitor_id) return answer;
        await db
          .from("conversations")
          .update({ language: answer.language ?? "en" })
          .eq("id", data.conversationId);
        await recordTurn(db, {
          conversationId: data.conversationId,
          author: "visitor",
          body: data.question,
        });
        await recordTurn(db, {
          conversationId: data.conversationId,
          author: "assistant",
          body: spokenAnswer(answer) || "No public response wording was available.",
          outcome: answer.outcome,
          answerId: stored?.id ?? null,
        });
      } catch {
        // A failed history write must never withhold a checked answer.
      }
    }

    return answer;
  });

export const sendToOfficial = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => escalateRequestSchema.parse(input))
  .handler(async ({ data }): Promise<PublicAnswer> => {
    const { escalateToCase, getAdminClient } = await import("./pipeline.server");
    const db = await getAdminClient();
    return escalateToCase({
      db,
      input: {
        question: data.question,
        readingLevel: "short",
        language: data.language,
        channel: data.channel,
        clientKey: clientKey(),
      },
      reasons: ["complex"],
      siteId: null,
      guidelineId: null,
      startedAt: Date.now(),
      kind: "public_escalation",
      ...(data.contact ? { requester: { contact: data.contact, consent: data.consent } } : {}),
    });
  });

export const submitMediaQuery = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => mediaQueryRequestSchema.parse(input))
  .handler(async ({ data }): Promise<PublicAnswer> => {
    const { escalateToCase, getAdminClient } = await import("./pipeline.server");
    const db = await getAdminClient();
    return escalateToCase({
      db,
      input: {
        question: data.question,
        readingLevel: "short",
        language: data.language,
        channel: data.channel,
        clientKey: clientKey(),
      },
      reasons: ["media"],
      siteId: null,
      guidelineId: null,
      startedAt: Date.now(),
      kind: "media",
      deadline: data.deadline ?? null,
      requester: {
        name: data.name,
        outlet: data.outlet,
        contact: data.contact,
        consent: data.consent,
      },
    });
  });

/**
 * Private case status. An invalid token and a case that does not exist give
 * exactly the same refusal, so the page cannot be used to discover cases.
 */
export const readCaseStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => caseStatusRequestSchema.parse(input))
  .handler(async ({ data }): Promise<CaseStatus | null> => {
    const { getAdminClient, hashToken } = await import("./pipeline.server");
    const db = await getAdminClient();

    const { data: row } = await db
      .from("cases")
      .select(
        "reference, status, received_at, deadline_at, released_at, closed_reason, status_token_hash",
      )
      .eq("reference", data.reference.trim().toUpperCase())
      .maybeSingle();

    if (!row || row.status_token_hash !== hashToken(data.token.trim())) return null;

    let releasedBody: string | null = null;
    let releasedReferences: CaseStatus["releasedReferences"] = [];
    if (row.status === "released") {
      const { data: release } = await db
        .from("releases")
        .select("released_body, released_references, case_id, cases!inner(reference)")
        .eq("cases.reference", row.reference)
        .order("released_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      releasedBody = release?.released_body ?? null;
      releasedReferences = (release?.released_references as CaseStatus["releasedReferences"]) ?? [];
    }

    return {
      reference: row.reference,
      status: row.status,
      statusLabel: CASE_STATUS_LABELS[row.status],
      receivedAt: row.received_at,
      deadlineAt: row.deadline_at,
      releasedAt: row.released_at,
      releasedBody,
      releasedReferences,
      closedReason: row.status === "rejected" ? row.closed_reason : null,
    };
  });
