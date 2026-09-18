import { createFileRoute } from "@tanstack/react-router";

/**
 * Speaks a checked answer in a South African woman's voice.
 *
 * Only wording the assistant has already produced is ever sent here; the
 * credential stays on the server.
 */
const VOICE_ID = "OcBcxJXlaNwru6LlLs4L"; // Naledi — calm, clear, South African English

export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["ELEVENLABS_API_KEY"];
        if (!key) return new Response("Voice is not available", { status: 503 });

        let text = "";
        try {
          const body = (await request.json()) as { text?: unknown };
          text = typeof body.text === "string" ? body.text.trim() : "";
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (text.length < 2) return new Response("Nothing to say", { status: 400 });
        text = text.slice(0, 2500);

        const upstream = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: { "xi-api-key": key, "Content-Type": "application/json" },
            body: JSON.stringify({
              text,
              model_id: "eleven_turbo_v2_5",
              voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true },
            }),
          },
        );

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          console.error(`Speech failed [${upstream.status}]: ${detail}`);
          return new Response("Voice unavailable", { status: 502 });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
