import { timingSafeEqual } from "crypto";

const matches = (provided: string, expected: string): boolean => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
};

export type SchedulerAuth = { ok: true } | { ok: false; response: Response };

/**
 * Scheduled endpoints accept either the shared crawl token header (own
 * schedulers, pg_cron) or the hosting platform's cron bearer secret
 * (Vercel sends `Authorization: Bearer $CRON_SECRET`).
 */
export const authoriseScheduler = (request: Request): SchedulerAuth => {
  const token = process.env["CRAWL_TOKEN"];
  const cronSecret = process.env["CRON_SECRET"];
  if (!token && !cronSecret) {
    return { ok: false, response: Response.json({ error: "not_configured" }, { status: 503 }) };
  }

  const header = request.headers.get("x-crawl-token") ?? "";
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

  if ((token && matches(header, token)) || (cronSecret && matches(bearer, cronSecret))) {
    return { ok: true };
  }
  return { ok: false, response: Response.json({ error: "unauthorised" }, { status: 401 }) };
};
