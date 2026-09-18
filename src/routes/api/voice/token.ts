import { createFileRoute } from "@tanstack/react-router";

/**
 * Mints a short-lived ElevenLabs conversation token so the browser can open a
 * real-time voice session. The account credential never leaves the server.
 */
export const Route = createFileRoute("/api/voice/token")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env["ELEVENLABS_API_KEY"];
        const agentId = process.env["ELEVENLABS_AGENT_ID"];
        if (!key || !agentId) {
          return new Response(JSON.stringify({ error: "voice_unavailable" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        const upstream = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
          { headers: { "xi-api-key": key } },
        );

        if (!upstream.ok) {
          const detail = await upstream.text().catch(() => "");
          console.error(`Voice token failed [${upstream.status}]: ${detail}`);
          return new Response(JSON.stringify({ error: "voice_unavailable" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }

        const body = (await upstream.json()) as { signed_url?: string };
        if (!body.signed_url) return Response.json({ error: "voice_unavailable" }, { status: 502 });
        return new Response(
          JSON.stringify({ signedUrl: body.signed_url, agentId, liveLanguages: ["en", "af"] }),
          {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
