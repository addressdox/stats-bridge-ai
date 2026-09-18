import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  conversationId: z.string().uuid(),
  browserToken: z.string().trim().min(8).max(80),
  language: z.enum(["en", "af"]),
  text: z.string().trim().min(1).max(2500),
});

export const Route = createFileRoute("/api/voice/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
        const { getAdminClient } = await import("@/lib/statbridge/pipeline.server");
        const { readConversationVisitor } = await import("@/lib/statbridge/visitor-contact.server");
        const { streamPreservedVoice } = await import("@/lib/statbridge/preserved-voice.server");
        const { VoiceError } = await import("@/lib/statbridge/voice.server");
        try {
          const owner = await readConversationVisitor(await getAdminClient(), parsed.data);
          if (!owner) return Response.json({ error: "unauthorised" }, { status: 403 });
          const audio = await streamPreservedVoice(
            parsed.data.text,
            parsed.data.language,
            AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
          );
          return new Response(audio, {
            headers: { "Content-Type": "audio/pcm;rate=24000", "Cache-Control": "no-store" },
          });
        } catch (error) {
          return Response.json(
            { error: "voice_unavailable" },
            { status: error instanceof VoiceError ? error.status : 502 },
          );
        }
      },
    },
  },
});
