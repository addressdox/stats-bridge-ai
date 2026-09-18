import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/voice/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { transcribeVoice, VoiceError } = await import("@/lib/statbridge/voice.server");
        try {
          const form = await request.formData();
          const audio = form.get("audio");
          if (!(audio instanceof Blob))
            return Response.json({ error: "Please record your question first." }, { status: 400 });
          const language = form.get("language");
          const transcript = await transcribeVoice(
            audio,
            typeof language === "string" ? language : "auto",
          );
          return Response.json(transcript, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          return Response.json(
            {
              error:
                error instanceof VoiceError ? error.message : "The recording could not be read.",
            },
            { status: error instanceof VoiceError ? error.status : 400 },
          );
        }
      },
    },
  },
});
