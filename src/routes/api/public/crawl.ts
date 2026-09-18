import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/**
 * Scheduled crawl endpoint. External schedulers (pg_cron or a hosted cron)
 * call this URL with the shared CRAWL_TOKEN header. The token lives only in
 * server environment variables; without it the endpoint refuses to run.
 */
export const Route = createFileRoute("/api/public/crawl")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CRAWL_TOKEN"];
        if (!expected) {
          return Response.json({ error: "crawl_not_configured" }, { status: 503 });
        }
        const provided = request.headers.get("x-crawl-token") ?? "";
        const providedBuf = Buffer.from(provided);
        const expectedBuf = Buffer.from(expected);
        const ok =
          providedBuf.length === expectedBuf.length && providedBuf.length > 0 && timingSafeEqual(providedBuf, expectedBuf);
        if (!ok) {
          return Response.json({ error: "unauthorised" }, { status: 401 });
        }

        const { runCrawl } = await import("@/lib/statbridge/crawler.server");
        const result = await runCrawl();
        return Response.json(result);
      },
    },
  },
});
