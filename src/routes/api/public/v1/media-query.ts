import { createFileRoute } from "@tanstack/react-router";

import { mediaQueryRequestSchema } from "@/lib/statbridge/contract";

import { apiVersioned, badRequest, callerKey, jsonResponse, preflight } from "./_shared";

export const Route = createFileRoute("/api/public/v1/media-query")({
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

        const parsed = mediaQueryRequestSchema.safeParse(payload);
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
            language: "en",
            channel: "api",
            clientKey: callerKey(request),
          },
          reasons: ["media"],
          siteId: null,
          guidelineId: null,
          startedAt: Date.now(),
          kind: "media",
          deadline: parsed.data.deadline ?? null,
          requester: {
            name: parsed.data.name,
            outlet: parsed.data.outlet,
            contact: parsed.data.contact,
            consent: parsed.data.consent,
          },
        });

        return jsonResponse(apiVersioned(answer));
      },
    },
  },
});
