import { createFileRoute } from "@tanstack/react-router";

/**
 * Rebuilds the meaning index for approved publications.
 *
 * Called by a scheduler, never by a browser: the caller must present the same
 * shared token the crawler endpoint uses.
 */
export const Route = createFileRoute("/api/public/embeddings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CRAWL_TOKEN"];
        if (!expected) return new Response("Not configured", { status: 503 });
        const presented = request.headers.get("x-crawl-token") ?? "";
        if (presented.length !== expected.length || presented !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { backfillEmbeddings } = await import("@/lib/statbridge/embeddings.server");
        try {
          const result = await backfillEmbeddings(supabaseAdmin, 200);
          return Response.json(result);
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "failed" }, { status: 500 });
        }
      },
    },
  },
});
