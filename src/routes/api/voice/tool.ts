import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  LIVE_VOICE_TOOL_ACTIONS,
  LIVE_VOICE_TOOL_NAMES,
  liveVoiceToolValues,
} from "@/lib/statbridge/live-voice-tools";
import type { VisitorToolInput } from "@/lib/statbridge/tools.server";

const requestSchema = z.object({
  conversationId: z.string().uuid(),
  browserToken: z.string().trim().min(8).max(80),
  name: z.enum(LIVE_VOICE_TOOL_NAMES),
  args: z.record(z.string(), z.unknown()).default({}),
});

type ToolDependencies = {
  ownsConversation: (conversationId: string, browserToken: string) => Promise<boolean>;
  runTool: (input: VisitorToolInput) => Promise<Record<string, unknown> | null>;
};

const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

/** Browser-callable tool boundary: the voice provider never receives an application credential. */
export async function handleLiveVoiceTool(
  request: Request,
  dependencies?: ToolDependencies,
): Promise<Response> {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply({ error: "Invalid voice tool request." }, 400);
  try {
    let boundary = dependencies;
    if (!boundary) {
      const [{ getAdminClient }, { readConversationVisitor }, { runVisitorTool }] =
        await Promise.all([
          import("@/lib/statbridge/pipeline.server"),
          import("@/lib/statbridge/visitor-contact.server"),
          import("@/lib/statbridge/tools.server"),
        ]);
      boundary = {
        ownsConversation: async (conversationId, browserToken) =>
          Boolean(
            await readConversationVisitor(await getAdminClient(), { conversationId, browserToken }),
          ),
        runTool: runVisitorTool,
      };
    }
    const { conversationId, browserToken, name, args } = parsed.data;
    if (!(await boundary.ownsConversation(conversationId, browserToken)))
      return reply({ error: "This voice conversation could not be found." }, 403);
    const result = await boundary.runTool({
      tool: LIVE_VOICE_TOOL_ACTIONS[name],
      conversationId,
      browserToken,
      channel: "web",
      spoken: true,
      values: liveVoiceToolValues(args),
    });
    if (!result) return reply({ error: "The voice action is unavailable. Please try again." }, 502);
    return reply({ result });
  } catch {
    return reply({ error: "The voice action could not be completed. Please try again." }, 502);
  }
}

export const Route = createFileRoute("/api/voice/tool")({
  server: { handlers: { POST: ({ request }) => handleLiveVoiceTool(request) } },
});
