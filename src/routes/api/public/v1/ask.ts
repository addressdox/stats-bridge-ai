import { createFileRoute } from "@tanstack/react-router";

import { askRequestSchema } from "@/lib/statbridge/contract";

import { apiVersioned, badRequest, callerKey, jsonResponse, preflight } from "./_shared";

export const Route = createFileRoute("/api/public/v1/ask")({
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

        const parsed = askRequestSchema.safeParse(payload);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          return badRequest(`${issue?.path.join(".") || "body"}: ${issue?.message ?? "invalid"}`);
        }

        const { runAsk } = await import("@/lib/statbridge/pipeline.server");
        const answer = await runAsk({
          question: parsed.data.question,
          readingLevel: parsed.data.readingLevel,
          language: parsed.data.language,
          channel: "api",
          siteKey: parsed.data.siteKey ?? null,
          parentAnswerRef: parsed.data.parentAnswerRef ?? null,
          clientKey: callerKey(request),
        });

        return jsonResponse(apiVersioned(answer));
      },
    },
  },
});
