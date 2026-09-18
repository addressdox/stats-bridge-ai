import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { Empty, Loading, Panel, Pill, StatCard, duration, relativeTime } from "@/components/statbridge/desk-ui";
import { StaffShell } from "@/components/statbridge/StaffShell";
import { getDeskOverview, getKnowledgeHealth, listHandoffs } from "@/lib/statbridge/desk.functions";

const title = "Operations overview — StatBridge staff";
const description = "Live conversations, waiting handovers and today's answering performance at Stats SA.";

export const Route = createFileRoute("/staff/overview")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const fetchOverview = useServerFn(getDeskOverview);
  const fetchHandoffs = useServerFn(listHandoffs);
  const fetchHealth = useServerFn(getKnowledgeHealth);

  const overview = useQuery({ queryKey: ["desk-overview"], queryFn: () => fetchOverview(), refetchInterval: 15000 });
  const waiting = useQuery({
    queryKey: ["desk-handoffs", "waiting"],
    queryFn: () => fetchHandoffs({ data: { state: "waiting" } }),
    refetchInterval: 10000,
  });
  const health = useQuery({ queryKey: ["knowledge-health"], queryFn: () => fetchHealth() });

  return (
    <StaffShell title="Operations overview">
      <div className="space-y-6">
        {overview.isLoading ? (
          <Loading label="Reading today's figures…" />
        ) : overview.data ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Live conversations" value={overview.data.liveConversations} />
            <StatCard
              label="Waiting for a person"
              value={overview.data.waitingHandoffs}
              tone={overview.data.waitingHandoffs > 0 ? "warn" : "default"}
            />
            <StatCard label="Conversations (24 h)" value={overview.data.conversationsToday} />
            <StatCard
              label="Resolved by the assistant"
              value={overview.data.resolutionRate === null ? "—" : `${overview.data.resolutionRate}%`}
              hint="of conversations analysed in the last 24 hours"
            />
            <StatCard label="Average length" value={duration(overview.data.averageSeconds)} />
            <StatCard label="Open cases" value={overview.data.openCases} />
            <StatCard
              label="Coverage gaps (24 h)"
              value={overview.data.coverageGaps}
              tone={overview.data.coverageGaps > 0 ? "warn" : "default"}
              hint="questions no approved publication covers"
            />
            <StatCard label="People on record" value={overview.data.visitors} />
          </div>
        ) : (
          <Empty>Nothing to show yet.</Empty>
        )}

        <Panel
          title="Waiting for a person"
          description="Requests the assistant could not finish, newest first."
          action={
            <Link to="/staff/handoffs" className="text-xs font-medium text-accent underline underline-offset-2">
              Open the queue
            </Link>
          }
        >
          {waiting.isLoading ? (
            <Loading />
          ) : (waiting.data ?? []).length === 0 ? (
            <Empty>Nobody is waiting. The assistant is handling everything on its own.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {(waiting.data ?? []).slice(0, 6).map((row) => (
                <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.visitorName ?? "Someone on the public site"}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.summary}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={row.urgency === "urgent" || row.urgency === "high" ? "warn" : "muted"}>{row.urgency}</Pill>
                    <span className="text-xs text-muted-foreground">{relativeTime(row.requestedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Knowledge health" description="What the assistant can currently draw on.">
          {health.isLoading ? (
            <Loading />
          ) : health.data ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Approved versions" value={health.data.approvedVersions} />
              <StatCard
                label="Awaiting approval"
                value={health.data.pendingVersions}
                tone={health.data.pendingVersions > 0 ? "warn" : "default"}
              />
              <StatCard label="Extracts" value={health.data.passages} />
              <StatCard label="Verified figures" value={health.data.observations} />
              <StatCard label="Meaning index entries" value={health.data.embeddings} />
            </div>
          ) : (
            <Empty>No knowledge figures available.</Empty>
          )}
        </Panel>
      </div>
    </StaffShell>
  );
}
