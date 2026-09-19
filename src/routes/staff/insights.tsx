import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Download, Lightbulb } from "lucide-react";
import { useEffect } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CollectionPagination,
  CollectionToolbar,
  collectionSelectClass,
} from "@/components/statbridge/collection-controls";
import { Empty, Loading, Panel, Pill, StatCard } from "@/components/statbridge/desk-ui";
import { StaffShell } from "@/components/statbridge/StaffShell";
import { Button } from "@/components/ui/button";
import {
  getStaffInsights,
  getStaffInsightTopics,
  getStaffInsightAlerts,
} from "@/lib/statbridge/staff-insights.functions";
import {
  filterTopics,
  insightsSearchSchema,
  type InsightsSearch,
} from "@/lib/staff/insights-record";
import { useStaff } from "@/lib/staff/useStaff";

export const Route = createFileRoute("/staff/insights")({
  validateSearch: (search) => insightsSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Decision intelligence — Naledi staff" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InsightsPage,
});
function InsightsPage() {
  const { hasPermission } = useStaff();
  const fetchInsights = useServerFn(getStaffInsights);
  const fetchTopics = useServerFn(getStaffInsightTopics);
  const fetchAlerts = useServerFn(getStaffInsightAlerts);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const update = (patch: Partial<InsightsSearch>) =>
    void navigate({ search: (current) => ({ ...current, ...patch }) });
  const query = useQuery({
    queryKey: ["staff-insights", search.days, search.demo],
    queryFn: () =>
      fetchInsights({ data: { days: search.days, includeDemo: search.demo === "yes" } }),
  });
  const topics = useQuery({
    queryKey: [
      "staff-insight-topics",
      search.days,
      search.demo,
      search.q,
      search.outcome,
      search.sort,
      search.page,
      search.size,
    ],
    queryFn: () => fetchTopics({ data: search }),
  });
  const alerts = useQuery({
    queryKey: [
      "staff-insight-alerts",
      search.alertQ,
      search.severity,
      search.alertState,
      search.alertPage,
      search.size,
    ],
    queryFn: () => fetchAlerts({ data: search }),
  });
  useEffect(() => {
    if (topics.data && topics.data.page !== search.page)
      void navigate({
        search: (previous) => ({ ...previous, page: topics.data.page }),
        replace: true,
      });
  }, [topics.data, search.page, navigate]);
  useEffect(() => {
    if (alerts.data && alerts.data.page !== search.alertPage)
      void navigate({
        search: (previous) => ({ ...previous, alertPage: alerts.data.page }),
        replace: true,
      });
  }, [alerts.data, search.alertPage, navigate]);
  const data = query.data;
  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Topic", "Questions", "Answered", "Escalated", "Gaps"],
      ...filterTopics(data.topics, search).map((topic) => [
        topic.topic,
        topic.total,
        topic.answered,
        topic.escalated,
        topic.gaps,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    anchor.download = `naledi-decision-intelligence-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }
  return (
    <StaffShell title="Decision intelligence">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="max-w-3xl text-sm text-muted-foreground">
            Operational demand, service levels, knowledge risk and recommended actions from recorded
            Naledi activity. Charts and totals cover the full reporting window.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Reporting window
              <select
                className={collectionSelectClass}
                value={search.days}
                onChange={(event) =>
                  update({ days: Number(event.target.value) as InsightsSearch["days"], page: 1 })
                }
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>12 months</option>
              </select>
            </label>
            <label className="flex min-h-9 items-center gap-2 rounded border border-border px-3 text-xs">
              <input
                type="checkbox"
                checked={search.demo === "yes"}
                onChange={(event) => update({ demo: event.target.checked ? "yes" : "no", page: 1 })}
              />
              Include demo
            </label>
          </div>
        </div>
        {query.isPending ? (
          <Loading label="Building decision intelligence…" />
        ) : query.isError ? (
          <p
            role="alert"
            className="rounded border border-destructive/30 p-3 text-sm text-destructive"
          >
            {(query.error as Error).message}
          </p>
        ) : (
          data && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Questions" value={data.metrics.questions} />
                <StatCard
                  label="Assistant answer rate"
                  value={data.metrics.answerRate === null ? "—" : `${data.metrics.answerRate}%`}
                />
                <StatCard
                  label="Coverage gaps"
                  value={data.metrics.gaps}
                  tone={data.metrics.gaps ? "warn" : "good"}
                />
                <StatCard
                  label="Open / overdue cases"
                  value={`${data.metrics.openCases} / ${data.metrics.overdueCases}`}
                  tone={data.metrics.overdueCases ? "warn" : "default"}
                />
                <StatCard
                  label="Stale sources"
                  value={data.metrics.staleSources}
                  tone={data.metrics.staleSources ? "warn" : "good"}
                />
                <StatCard
                  label="Avg release time"
                  value={
                    data.metrics.averageReleaseHours === null
                      ? "—"
                      : `${data.metrics.averageReleaseHours} h`
                  }
                />
                <StatCard
                  label="Avg handover pickup"
                  value={
                    data.metrics.averageHandoffMinutes === null
                      ? "—"
                      : `${data.metrics.averageHandoffMinutes} min`
                  }
                />
                <StatCard
                  label="Waiting handovers"
                  value={data.metrics.waitingHandoffs}
                  tone={data.metrics.waitingHandoffs ? "warn" : "good"}
                />
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                <Panel
                  title="Demand and outcomes"
                  description="Daily recorded questions and routing outcomes."
                >
                  <div className="h-72">
                    <ResponsiveContainer>
                      <LineChart data={data.daily}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={11} />
                        <YAxis allowDecimals={false} fontSize={11} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="questions" stroke="var(--color-chart-1)" />
                        <Line type="monotone" dataKey="answered" stroke="var(--color-chart-2)" />
                        <Line type="monotone" dataKey="gaps" stroke="var(--color-destructive)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
                <Panel
                  title="Channel demand"
                  description="Where conversations entered the service."
                >
                  {!data.channels.length ? (
                    <Empty>No conversations in this window.</Empty>
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer>
                        <BarChart data={data.channels}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="value" fill="var(--color-chart-1)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Panel>
              </div>
              <Panel
                title="Decision recommendations"
                description="Prioritised from observed gaps, overdue work and source freshness."
              >
                <ul className="space-y-2">
                  {data.recommendations.map((recommendation: string) => (
                    <li
                      key={recommendation}
                      className="flex gap-2 rounded border border-border p-3 text-sm"
                    >
                      <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                      {recommendation}
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          )
        )}
        <Panel
          title="Topics requiring attention"
          description="Search all topics in the reporting window. Filters apply to this table and its export."
          action={
            hasPermission("insights.export") && (
              <Button variant="outline" onClick={exportCsv} disabled={!data || query.isFetching}>
                <Download aria-hidden />
                Export matching topics
              </Button>
            )
          }
        >
          <div className="space-y-4">
            <CollectionToolbar
              search={search.q}
              onSearch={(q) => update({ q, page: 1 })}
              searchLabel="Search insight topics"
              placeholder="Search topics…"
              onReset={() => update({ q: "", outcome: "all", sort: "total", page: 1 })}
            >
              <label className="grid gap-1 text-xs text-muted-foreground">
                Topic outcome
                <select
                  className={collectionSelectClass}
                  value={search.outcome}
                  onChange={(event) =>
                    update({ outcome: event.target.value as InsightsSearch["outcome"], page: 1 })
                  }
                >
                  <option value="all">All outcomes</option>
                  <option value="gaps">Has coverage gaps</option>
                  <option value="escalated">Has escalations</option>
                  <option value="answered">Has answered questions</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Topic order
                <select
                  className={collectionSelectClass}
                  value={search.sort}
                  onChange={(event) =>
                    update({ sort: event.target.value as InsightsSearch["sort"], page: 1 })
                  }
                >
                  <option value="total">Most questions first</option>
                  <option value="gaps">Most gaps first</option>
                  <option value="escalated">Most escalations first</option>
                  <option value="topic">Topic A–Z</option>
                </select>
              </label>
            </CollectionToolbar>
            {topics.isPending ? (
              <Loading label="Loading topics…" />
            ) : topics.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {(topics.error as Error).message}
              </p>
            ) : !topics.data.rows.length ? (
              <Empty>No topics match these filters.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <caption className="sr-only">Topics and recorded question outcomes</caption>
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th scope="col" className="px-2 py-3">
                        Topic
                      </th>
                      <th scope="col" className="px-3 py-3 text-right">
                        Questions
                      </th>
                      <th scope="col" className="px-3 py-3 text-right">
                        Answered
                      </th>
                      <th scope="col" className="px-3 py-3 text-right">
                        Escalated
                      </th>
                      <th scope="col" className="px-3 py-3 text-right">
                        Gaps
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topics.data.rows.map((topic) => (
                      <tr
                        key={topic.topic}
                        className="border-b border-border/60 hover:bg-secondary/20"
                      >
                        <th scope="row" className="px-2 py-3 font-medium">
                          {topic.topic}
                        </th>
                        <td className="px-3 py-3 text-right tabular-nums">{topic.total}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{topic.answered}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{topic.escalated}</td>
                        <td
                          className={`px-3 py-3 text-right tabular-nums ${topic.gaps ? "font-semibold text-destructive" : ""}`}
                        >
                          {topic.gaps}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!topics.isError && (
              <CollectionPagination
                page={topics.data?.page ?? search.page}
                pageSize={search.size}
                total={topics.data?.total ?? 0}
                onPageChange={(page) => update({ page })}
                onPageSizeChange={(size) =>
                  update({ size: size as InsightsSearch["size"], page: 1, alertPage: 1 })
                }
                label="Topics"
                busy={topics.isFetching}
              />
            )}
          </div>
        </Panel>
        <Panel
          title="Operational alerts"
          description="Newest alerts first. Alert records are independent of the reporting window."
        >
          <div className="space-y-4">
            <CollectionToolbar
              search={search.alertQ}
              onSearch={(alertQ) => update({ alertQ, alertPage: 1 })}
              searchLabel="Search operational alerts"
              placeholder="Search alert title, description or metric…"
              onReset={() =>
                update({ alertQ: "", severity: "all", alertState: "unresolved", alertPage: 1 })
              }
            >
              <label className="grid gap-1 text-xs text-muted-foreground">
                Alert severity
                <select
                  className={collectionSelectClass}
                  value={search.severity}
                  onChange={(event) =>
                    update({
                      severity: event.target.value as InsightsSearch["severity"],
                      alertPage: 1,
                    })
                  }
                >
                  <option value="all">All severities</option>
                  <option value="information">Information</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Alert status
                <select
                  className={collectionSelectClass}
                  value={search.alertState}
                  onChange={(event) =>
                    update({
                      alertState: event.target.value as InsightsSearch["alertState"],
                      alertPage: 1,
                    })
                  }
                >
                  <option value="unresolved">Unresolved</option>
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
            </CollectionToolbar>
            {alerts.isPending ? (
              <Loading label="Loading alerts…" />
            ) : alerts.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {(alerts.error as Error).message}
              </p>
            ) : !alerts.data.rows.length ? (
              <Empty>No alerts match these filters.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <caption className="sr-only">Operational alerts, most recent first</caption>
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th scope="col" className="px-2 py-3">
                        Alert
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Severity
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Status
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.data.rows.map((alert) => (
                      <tr
                        key={alert.id}
                        className="border-b border-border/60 align-top hover:bg-secondary/20"
                      >
                        <td className="max-w-lg px-2 py-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle
                              aria-hidden
                              className="mt-0.5 size-4 shrink-0 text-warn"
                            />
                            <div>
                              <p className="font-medium">{alert.title}</p>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {alert.description}
                              </p>
                              {alert.metric_name && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {alert.metric_name}: {alert.metric_value ?? "—"}
                                  {alert.threshold_value !== null
                                    ? ` · Threshold: ${alert.threshold_value}`
                                    : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Pill
                            tone={
                              alert.severity === "critical"
                                ? "bad"
                                : alert.severity === "warning"
                                  ? "warn"
                                  : "muted"
                            }
                          >
                            {alert.severity}
                          </Pill>
                        </td>
                        <td className="px-3 py-3">
                          <Pill tone={alert.state === "resolved" ? "good" : "muted"}>
                            {alert.state}
                          </Pill>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                          {new Date(alert.created_at).toLocaleString("en-ZA", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!alerts.isError && (
              <CollectionPagination
                page={alerts.data?.page ?? search.alertPage}
                pageSize={search.size}
                total={alerts.data?.total ?? 0}
                onPageChange={(alertPage) => update({ alertPage })}
                onPageSizeChange={(size) =>
                  update({ size: size as InsightsSearch["size"], page: 1, alertPage: 1 })
                }
                label="Alerts"
                busy={alerts.isFetching}
              />
            )}
          </div>
        </Panel>
      </div>
    </StaffShell>
  );
}
