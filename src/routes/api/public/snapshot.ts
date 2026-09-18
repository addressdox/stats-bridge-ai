import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/**
 * Scheduled insight snapshot. A scheduler posts here once a day with the
 * shared CRAWL_TOKEN header; the saved snapshot is what makes week-on-week
 * and month-on-month comparison possible.
 */
export const Route = createFileRoute("/api/public/snapshot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CRAWL_TOKEN"];
        if (!expected) return Response.json({ error: "not_configured" }, { status: 503 });
        const provided = Buffer.from(request.headers.get("x-crawl-token") ?? "");
        const wanted = Buffer.from(expected);
        const ok = provided.length === wanted.length && provided.length > 0 && timingSafeEqual(provided, wanted);
        if (!ok) return Response.json({ error: "unauthorised" }, { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("capture_insight_snapshot", { _window_hours: 24 });
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const { refreshInsightAlerts } = await import("@/lib/statbridge/alerts.server");
        const alerts = await refreshInsightAlerts(supabaseAdmin).catch(() => ({ raised: 0 }));
        return Response.json({ snapshot_id: data, ...alerts });
      },
    },
  },
});
