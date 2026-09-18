import { createFileRoute } from "@tanstack/react-router";

/** Speak the already checked answer in the detected/requested language. Credentials stay server-side. */
export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { synthesizeVoice, VoiceError } = await import("@/lib/statbridge/voice.server");
        try {
          const body = (await request.json()) as { text?: unknown; language?: unknown };
          const text = typeof body.text === "string" ? body.text.trim().slice(0, 2500) : "";
          if (text.length < 2) return new Response("Nothing to say", { status: 400 });
          const result = await synthesizeVoice(
            text,
            typeof body.language === "string" ? body.language : "auto",
          );
          return new Response(result.body as BodyInit, {
            headers: {
              "Content-Type": result.contentType,
              "Cache-Control": "no-store",
              "X-Speech-Preview": String(result.preview),
            },
          });
        } catch (error) {
          return new Response(error instanceof VoiceError ? error.message : "Voice unavailable", {
            status: error instanceof VoiceError ? error.status : 400,
          });
        }
      },
    },
  },
});
