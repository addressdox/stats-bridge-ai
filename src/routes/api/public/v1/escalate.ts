import { createFileRoute } from "@tanstack/react-router";

import { escalateRequestSchema } from "@/lib/statbridge/contract";

import { apiVersioned, badRequest, callerKey, jsonResponse, preflight } from "./_shared";

export const Route = createFileRoute("/api/public/v1/escalate")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return badRequest("The request body must be JSON.");
        }

        const parsed = escalateRequestSchema.safeParse(payload);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          return badRequest(`${issue?.path.join(".") || "body"}: ${issue?.message ?? "invalid"}`);
        }

        const { escalateToCase, getAdminClient } = await import("@/lib/statbridge/pipeline.server");
        const db = await getAdminClient();
        const answer = await escalateToCase({
          db,
          input: {
            question: parsed.data.question,
            readingLevel: "short",
            language: parsed.data.language,
            channel: "api",
            clientKey: callerKey(request),
          },
          reasons: ["complex"],
          siteId: null,
          guidelineId: null,
          startedAt: Date.now(),
          kind: "public_escalation",
          ...(parsed.data.contact
            ? { requester: { contact: parsed.data.contact, consent: parsed.data.consent } }
            : {}),
        });

        return jsonResponse(apiVersioned(answer));
      },
    },
  },
});
