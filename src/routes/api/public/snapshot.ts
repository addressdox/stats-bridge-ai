import { createFileRoute } from "@tanstack/react-router";
import { authoriseScheduler } from "@/lib/statbridge/scheduler.server";

/**
 * Scheduled insight snapshot. A scheduler calls here once a day; the saved
 * snapshot is what makes week-on-week and month-on-month comparison possible.
 */
const handler = async ({ request }: { request: Request }) => {
  const auth = authoriseScheduler(request);
  if (!auth.ok) return auth.response;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("capture_insight_snapshot", { _window_hours: 24 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { refreshInsightAlerts } = await import("@/lib/statbridge/alerts.server");
  const alerts = await refreshInsightAlerts(supabaseAdmin).catch(() => ({ raised: 0 }));
  return Response.json({ snapshot_id: data, ...alerts });
};

export const Route = createFileRoute("/api/public/snapshot")({
  server: { handlers: { POST: handler, GET: handler } },
});
