/**
 * Tool endpoint for the live ElevenLabs voice agent.
 *
 * The agent can never invent a statistic: the only way it obtains figures is by
 * calling `answer` here, which runs the same approved-source pipeline the
 * website uses. Everything else it can do (contact capture, human handover,
 * case status, media intake) is limited to what an ordinary visitor may do.
 */
import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse, preflight } from "./_shared";

function unauthorised() {
  return jsonResponse({ error: "unauthorised" }, 401);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Body = Record<string, unknown>;

const str = (body: Body, key: string) => {
  const value = body[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

export const Route = createFileRoute("/api/public/v1/agent/$tool")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request, params }) => {
        const expected = process.env["AGENT_TOOL_TOKEN"];
        if (!expected) return jsonResponse({ error: "not_configured" }, 503);
        const presented = request.headers.get("x-agent-token") ?? "";
        if (!safeEqual(presented, expected)) return unauthorised();

        let body: Body = {};
        try {
          body = ((await request.json()) as Body) ?? {};
        } catch {
          body = {};
        }

        const conversationId = str(body, "conversation_id");
        const browserToken = str(body, "browser_token") ?? "voice-agent-anonymous";

        const { getAdminClient } = await import("@/lib/statbridge/pipeline.server");

        switch (params.tool) {
          case "answer": {
            const question = str(body, "question");
            if (!question) return jsonResponse({ spoken: "I did not catch the question. Could you say it again?" });

            const { runAsk } = await import("@/lib/statbridge/pipeline.server");
            const answer = await runAsk({
              question,
              readingLevel: "short",
              language: (str(body, "language") ?? "en") as never,
              channel: "web",
              siteKey: null,
              parentAnswerRef: null,
              clientKey: "voice-agent",
            });

            const citations = answer.references
              .map((reference) => reference.title)
              .filter((label) => label.length > 0);

            if (conversationId) {
              try {
                const { recordTurn } = await import("@/lib/statbridge/visitors.server");
                const db = await getAdminClient();
                await recordTurn(db, { conversationId, author: "visitor", body: question, spoken: true });
                await recordTurn(db, {
                  conversationId,
                  author: "assistant",
                  body: answer.aiExplanation ?? answer.clarification?.question ?? answer.gapDescription ?? "",
                  outcome: answer.outcome,
                  spoken: true,
                });
              } catch {
                // History must never withhold a checked answer.
              }
            }

            const spoken =
              answer.outcome === "answered"
                ? (answer.aiExplanation ?? "")
                : answer.outcome === "clarification"
                  ? (answer.clarification?.question ?? "Could you tell me a little more about what you need?")
                  : answer.outcome === "gap"
                    ? (answer.gapDescription ??
                      "I have no approved Stats SA publication covering that, so I cannot give you a figure.")
                    : "I have logged that for a Stats SA official; you will be given a reference.";

            return jsonResponse({
              outcome: answer.outcome,
              spoken,
              citations: [...new Set(citations)].slice(0, 4),
              case_reference: answer.caseReference ?? null,
            });
          }

          case "contact": {
            const { resolveVisitor } = await import("@/lib/statbridge/visitors.server");
            const db = await getAdminClient();
            const visitor = await resolveVisitor(db, {
              browserToken,
              contact: {
                fullName: str(body, "full_name"),
                email: str(body, "email"),
                phone: str(body, "phone"),
                organisation: str(body, "organisation"),
                address: str(body, "address"),
                consent: true,
              },
            });
            return jsonResponse({
              spoken: visitor.returning
                ? "Thank you, I have your details on file."
                : "Thank you, I have noted your details.",
              returning: visitor.returning,
              known_name: visitor.knownName,
            });
          }

          case "human": {
            if (!conversationId) return jsonResponse({ spoken: "I cannot reach an official on this line just now." });
            const { resolveVisitor, requestHandoff } = await import("@/lib/statbridge/visitors.server");
            const { readDeskSettings, callerPhoneOffer, speakableNumber } = await import(
              "@/lib/statbridge/settings.server"
            );
            const db = await getAdminClient();
            const [visitor, settings] = await Promise.all([
              resolveVisitor(db, { browserToken }),
              readDeskSettings(db),
            ]);
            const offer = callerPhoneOffer(settings);

            await requestHandoff(db, {
              conversationId,
              visitorId: visitor.visitorId,
              reason: (str(body, "reason") ?? "visitor_request") as never,
              urgency: (str(body, "urgency") ?? "high") as never,
              topic: str(body, "topic"),
              summary: str(body, "summary") ?? "Caller asked to speak to a person.",
              channel: "voice",
              offeredPhone: offer?.number ?? null,
              callerPhone: str(body, "caller_phone"),
            });

            const spoken = offer
              ? `I have alerted a Stats SA official now, and they can see this call on the desk. If you would rather speak to them straight away, the ${offer.label} number is ${speakableNumber(offer.number)}. Shall I say it once more?`
              : "I have alerted a Stats SA official now. They can see this call on the desk and will come back to you on the contact details you gave me.";

            return jsonResponse({
              spoken,
              officer_phone: offer?.number ?? null,
              officer_phone_label: offer?.label ?? null,
            });
          }

          case "case-status": {
            const reference = str(body, "reference");
            const token = str(body, "token");
            if (!reference || !token) {
              return jsonResponse({ spoken: "I need both the reference and the private token to check that." });
            }
            const { hashToken } = await import("@/lib/statbridge/pipeline.server");
            const db = await getAdminClient();
            const { data: row } = await db
              .from("cases")
              .select("reference, status, received_at, status_token_hash")
              .eq("reference", reference.toUpperCase())
              .maybeSingle();
            if (!row || row.status_token_hash !== hashToken(token)) {
              return jsonResponse({ spoken: "That reference and token do not match a request I can see." });
            }
            return jsonResponse({
              spoken: `Request ${row.reference} is currently ${row.status.replace(/_/g, " ")}.`,
              status: row.status,
            });
          }

          case "media": {
            const question = str(body, "question");
            if (!question) return jsonResponse({ spoken: "What is the media enquiry about?" });
            const { escalateToCase } = await import("@/lib/statbridge/pipeline.server");
            const db = await getAdminClient();
            const result = await escalateToCase({
              db,
              input: {
                question,
                readingLevel: "short",
                language: "en",
                channel: "web",
                clientKey: "voice-agent",
              },
              reasons: ["media"],
              siteId: null,
              guidelineId: null,
              startedAt: Date.now(),
              kind: "media",
              deadline: str(body, "deadline"),
              requester: {
                name: str(body, "name") ?? "Caller",
                outlet: str(body, "outlet") ?? "Not given",
                contact: str(body, "contact") ?? "Not given",
                consent: true,
              },
            });
            return jsonResponse({
              spoken: `I have logged that as a media enquiry. Your reference is ${result.caseReference ?? "being issued"}. An official will respond; I cannot answer media questions myself.`,
              case_reference: result.caseReference ?? null,
            });
          }

          default:
            return jsonResponse({ error: "unknown_tool" }, 404);
        }
      },
    },
  },
});
