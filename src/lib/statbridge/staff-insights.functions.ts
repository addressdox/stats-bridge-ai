import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { communicationSuggestions } from "./communications-intelligence";
import {
  collectAll,
  insightsSearchSchema,
  loadInsightAlerts,
  topicCounts,
  topicPage,
} from "@/lib/staff/insights-record";
type Ctx = {
  userId: string;
  supabase: {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>;
  };
};
async function access(c: Ctx, key: string) {
  const r = await c.supabase.rpc("has_permission", { _uid: c.userId, _permission: key });
  if (r.error || r.data !== true)
    throw new Error("Your account cannot view decision intelligence.");
}
export const getStaffInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        days: z.number().int().min(7).max(365).default(30),
        includeDemo: z.boolean().default(false),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    await access(context as never, "insights.view");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const [answers, cases, handoffs, conversations, sources, alerts] = await Promise.all([
      collectAll((from, to) =>
        db
          .from("answers")
          .select("topic,outcome,created_at,is_demo_seed")
          .gte("created_at", since)
          .order("created_at")
          .order("id")
          .range(from, to),
      ),
      collectAll((from, to) =>
        db
          .from("cases")
          .select("kind,status,received_at,released_at,deadline_at,is_demo_seed")
          .gte("received_at", since)
          .order("received_at")
          .order("id")
          .range(from, to),
      ),
      collectAll((from, to) =>
        db
          .from("handoffs")
          .select("state,urgency,requested_at,accepted_at,is_demo")
          .gte("requested_at", since)
          .order("requested_at")
          .order("id")
          .range(from, to),
      ),
      collectAll((from, to) =>
        db
          .from("conversations")
          .select("channel,state,started_at,duration_seconds,is_demo")
          .gte("started_at", since)
          .order("started_at")
          .order("id")
          .range(from, to),
      ),
      collectAll((from, to) =>
        db
          .from("sources")
          .select(
            "id,title,publisher,last_checked_at,current_version_id,source_versions!sources_current_version_fk(published_on,status)",
          )
          .order("id")
          .range(from, to),
      ),
      collectAll((from, to) =>
        db
          .from("insight_alerts")
          .select(
            "id,title,description,severity,state,metric_name,metric_value,threshold_value,created_at",
          )
          .neq("state", "resolved")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      ),
    ]);
    const real = (r: any) => data.includeDemo || !(r.is_demo || r.is_demo_seed);
    const a = answers.filter(real),
      c = cases.filter(real),
      h = handoffs.filter(real),
      conv = conversations.filter(real);
    const daily = new Map<
      string,
      {
        date: string;
        questions: number;
        answered: number;
        escalated: number;
        gaps: number;
        cases: number;
      }
    >();
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      daily.set(d, {
        date: d.slice(5),
        questions: 0,
        answered: 0,
        escalated: 0,
        gaps: 0,
        cases: 0,
      });
    }
    for (const r of a) {
      const x = daily.get(r.created_at.slice(0, 10));
      if (x) {
        x.questions++;
        if (r.outcome === "answered") x.answered++;
        if (r.outcome === "escalated") x.escalated++;
        if (r.outcome === "gap") x.gaps++;
      }
    }
    for (const r of c) {
      const x = daily.get(r.received_at.slice(0, 10));
      if (x) x.cases++;
    }
    const topics = new Map<
      string,
      { topic: string; total: number; answered: number; escalated: number; gaps: number }
    >();
    for (const r of a) {
      const k = r.topic ?? "Not classified",
        x = topics.get(k) ?? { topic: k, total: 0, answered: 0, escalated: 0, gaps: 0 };
      x.total++;
      if (r.outcome === "answered") x.answered++;
      if (r.outcome === "escalated") x.escalated++;
      if (r.outcome === "gap") x.gaps++;
      topics.set(k, x);
    }
    const releaseHours = c
      .filter((r: any) => r.released_at)
      .map(
        (r: any) =>
          (new Date(r.released_at).getTime() - new Date(r.received_at).getTime()) / 3600000,
      )
      .filter((n: number) => n >= 0);
    const responseMinutes = h
      .filter((r: any) => r.accepted_at)
      .map(
        (r: any) =>
          (new Date(r.accepted_at).getTime() - new Date(r.requested_at).getTime()) / 60000,
      )
      .filter((n: number) => n >= 0);
    const stale = sources.filter(
      (s: any) =>
        !s.last_checked_at || Date.now() - new Date(s.last_checked_at).getTime() > 45 * 86400000,
    );
    const channelCounts = conv.reduce<Record<string, number>>(
      (m: any, r: any) => ((m[r.channel] = (m[r.channel] ?? 0) + 1), m),
      {},
    );
    const channel = Object.entries(channelCounts).map(([name, value]) => ({
      name,
      value: Number(value),
    }));
    const avg = (v: number[]) =>
      v.length ? Math.round((v.reduce((x, y) => x + y, 0) / v.length) * 10) / 10 : null;
    const recommendations: string[] = [];
    const gaps = a.filter((r: any) => r.outcome === "gap").length;
    if (gaps)
      recommendations.push(
        `Prioritise the top knowledge gaps: ${gaps} unsupported questions appeared in this window.`,
      );
    if (stale.length)
      recommendations.push(
        `Refresh ${stale.length} source${stale.length === 1 ? "" : "s"} not checked within 45 days.`,
      );
    if (
      c.filter((r: any) => r.deadline_at && new Date(r.deadline_at) < new Date() && !r.released_at)
        .length
    )
      recommendations.push("Escalate overdue media cases and confirm owners today.");
    recommendations.push(
      ...communicationSuggestions([...topics.values()], `the last ${data.days} days`),
    );
    if (!recommendations.length)
      recommendations.push(
        "No threshold breach is visible; maintain source checks and review service levels weekly.",
      );
    return {
      since,
      days: data.days,
      includeDemo: data.includeDemo,
      metrics: {
        questions: a.length,
        answerRate: a.length
          ? Math.round((a.filter((r: any) => r.outcome === "answered").length / a.length) * 100)
          : null,
        gaps,
        openCases: c.filter((r: any) => !["released", "closed", "rejected"].includes(r.status))
          .length,
        overdueCases: c.filter(
          (r: any) => r.deadline_at && new Date(r.deadline_at) < new Date() && !r.released_at,
        ).length,
        averageReleaseHours: avg(releaseHours),
        averageHandoffMinutes: avg(responseMinutes),
        waitingHandoffs: h.filter((r: any) => r.state === "waiting").length,
        staleSources: stale.length,
      },
      daily: [...daily.values()],
      topics: [...topics.values()].sort(
        (x, y) => y.total - x.total || x.topic.localeCompare(y.topic),
      ),
      channels: channel,
      alerts,
      recommendations,
    };
  });
/** Saved daily snapshots — what makes week-on-week comparison possible. */
export const getInsightHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ limit: z.number().int().min(2).max(180).default(60) }).parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    await access(context as never, "insights.view");
    const r = await (context as unknown as Ctx).supabase.rpc("staff_insight_history", {
      _limit: data.limit,
    });
    if (r.error) throw new Error("The saved history could not be loaded.");
    return JSON.parse(JSON.stringify(r.data ?? [])) as Array<{
      window_end: string;
      metrics: Record<string, number>;
    }>;
  });

/** Acknowledge or resolve an alert, with a note kept in the audit trail. */
export const setInsightAlertState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        alertId: z.string().uuid(),
        state: z.enum(["open", "acknowledged", "resolved"]),
        note: z.string().trim().max(400).nullable().default(null),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await access(context as never, "insights.view");
    const r = await (context as unknown as Ctx).supabase.rpc("set_alert_state", {
      _alert_id: data.alertId,
      _state: data.state,
      _note: data.note,
    });
    if (r.error) throw new Error("The alert could not be updated.");
    return { ok: true as const };
  });

/** Search and page all topic aggregates in the selected reporting window. */
export const getStaffInsightTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => insightsSearchSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await access(context as never, "insights.view");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const answers = await collectAll((from, to) => {
      let query = db.from("answers").select("topic,outcome").gte("created_at", since);
      if (data.demo !== "yes") query = query.eq("is_demo_seed", false);
      return query.order("created_at").order("id").range(from, to);
    });
    return topicPage(topicCounts(answers), data);
  });

export const getStaffInsightAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => insightsSearchSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await access(context as never, "insights.view");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    return loadInsightAlerts(db, data);
  });
