import { createFileRoute } from "@tanstack/react-router";
import { authoriseScheduler } from "@/lib/statbridge/scheduler.server";

/**
 * Scheduled crawl endpoint. External schedulers (pg_cron, a hosted cron, or the
 * hosting platform's own scheduler) call this URL; without a valid token or
 * cron secret the endpoint refuses to run.
 */
const handler = async ({ request }: { request: Request }) => {
  const auth = authoriseScheduler(request);
  if (!auth.ok) return auth.response;

  const { runCrawl } = await import("@/lib/statbridge/crawler.server");
  const result = await runCrawl();
  return Response.json(result);
};

export const Route = createFileRoute("/api/public/crawl")({
  server: { handlers: { POST: handler, GET: handler } },
});
