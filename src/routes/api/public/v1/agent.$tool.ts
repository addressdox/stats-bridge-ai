/**
 * Tool endpoint for the live ElevenLabs voice agent.
 *
 * The agent can never invent a statistic: every tool here is the shared
 * assistant tool set used by the Ask room and the widget, so the voice line
 * behaves exactly like the website.
 */
import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse, preflight } from "./_shared";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/v1/agent/$tool")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request, params }) => {
        const expected = process.env["AGENT_TOOL_TOKEN"];
        if (!expected) return jsonResponse({ error: "not_configured" }, 503);
        const presented = request.headers.get("x-agent-token") ?? "";
        if (!safeEqual(presented, expected)) return jsonResponse({ error: "unauthorised" }, 401);

        let body: Record<string, unknown> = {};
        try {
          body = ((await request.json()) as Record<string, unknown>) ?? {};
        } catch {
          body = {};
        }

        const text = (key: string) => {
          const value = body[key];
          return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
        };

        const { runVisitorTool } = await import("@/lib/statbridge/tools.server");
        const result = await runVisitorTool({
          tool: params.tool,
          conversationId: text("conversation_id"),
          browserToken: text("browser_token") ?? "voice-agent-anonymous",
          channel: "web",
          spoken: true,
          values: body,
        });

        if (!result) return jsonResponse({ error: "unknown_tool" }, 404);
        return jsonResponse(result);
      },
    },
  },
});
