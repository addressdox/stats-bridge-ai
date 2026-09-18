import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Empty, Loading, Panel, Pill, duration, relativeTime } from "@/components/statbridge/desk-ui";
import { StaffShell } from "@/components/statbridge/StaffShell";
import { listConversations, readConversationDetail } from "@/lib/statbridge/desk.functions";

const title = "Conversations — Naledi staff";
const description = "Every chat and voice call with the Stats SA assistant, with transcript, evidence and analysis.";

export const Route = createFileRoute("/staff/conversations")({
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
  component: ConversationsPage,
});

function ConversationsPage() {
  const [search, setSearch] = useState("");
  const [state, setState] = useState<"all" | "active" | "ended" | "handed_off" | "abandoned">("all");
  const [channel, setChannel] = useState<"all" | "chat" | "voice" | "widget" | "api">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchList = useServerFn(listConversations);
  const fetchDetail = useServerFn(readConversationDetail);

  const list = useQuery({
    queryKey: ["desk-conversations", search, state, channel],
    queryFn: () => fetchList({ data: { search, state, channel, limit: 100 } }),
    refetchInterval: 20000,
  });

  const detail = useQuery({
    queryKey: ["desk-conversation", openId],
    queryFn: () => fetchDetail({ data: { conversationId: openId! } }),
    enabled: Boolean(openId),
  });

  return (
    <StaffShell title="Conversations">
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-2 sm:-mx-6 sm:px-6">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, topic…"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
          />
          <select
            aria-label="State"
            value={state}
            onChange={(event) => setState(event.target.value as typeof state)}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
          >
            <option value="all">Any state</option>
            <option value="active">Live</option>
            <option value="ended">Ended</option>
            <option value="handed_off">Handed over</option>
            <option value="abandoned">Abandoned</option>
          </select>
          <select
            aria-label="Channel"
            value={channel}
            onChange={(event) => setChannel(event.target.value as typeof channel)}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
          >
            <option value="all">Any channel</option>
            <option value="chat">Chat</option>
            <option value="voice">Voice</option>
            <option value="widget">Widget</option>
            <option value="api">API</option>
          </select>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Panel title="All conversations" description="Newest first.">
            {list.isLoading ? (
              <Loading />
            ) : (list.data ?? []).length === 0 ? (
              <Empty>No conversations match these filters yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Person</th>
                      <th className="py-2 pr-3 font-medium">Topic</th>
                      <th className="py-2 pr-3 font-medium">Channel</th>
                      <th className="py-2 pr-3 font-medium">Length</th>
                      <th className="py-2 font-medium">Started</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(list.data ?? []).map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => setOpenId(row.id)}
                        className={`cursor-pointer transition-colors hover:bg-secondary/60 ${openId === row.id ? "bg-secondary" : ""}`}
                      >
                        <td className="py-2 pr-3">
                          <span className="block max-w-40 truncate">{row.visitorName ?? "Not given"}</span>
                          <span className="block max-w-40 truncate text-xs text-muted-foreground">
                            {row.visitorEmail ?? "—"}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <span className="block max-w-48 truncate">{row.topic ?? "—"}</span>
                          {row.resolved === false && <Pill tone="warn">unresolved</Pill>}
                        </td>
                        <td className="py-2 pr-3 text-xs capitalize">{row.channel}</td>
                        <td className="py-2 pr-3 font-mono text-xs tabular-nums">{duration(row.durationSeconds)}</td>
                        <td className="py-2 text-xs text-muted-foreground">{relativeTime(row.startedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Detail" description={openId ? "Transcript and analysis" : "Choose a conversation"}>
            {!openId ? (
              <Empty>Select a row to read the whole conversation.</Empty>
            ) : detail.isLoading ? (
              <Loading />
            ) : (
              <div className="space-y-4">
                {detail.data?.analysis && (
                  <div className="rounded-md border border-border bg-background p-3 text-sm">
                    <p>{detail.data.analysis.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Pill>{detail.data.analysis.sentiment}</Pill>
                      <Pill tone={detail.data.analysis.urgency === "urgent" ? "warn" : "muted"}>
                        {detail.data.analysis.urgency}
                      </Pill>
                      <Pill tone={detail.data.analysis.resolved ? "good" : "warn"}>
                        {detail.data.analysis.resolved ? "resolved" : "not resolved"}
                      </Pill>
                    </div>
                    {detail.data.analysis.unmet_need && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Not answered: {detail.data.analysis.unmet_need}
                      </p>
                    )}
                  </div>
                )}

                <div className="max-h-96 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-3">
                  {(detail.data?.turns ?? []).map((turn) => (
                    <div key={turn.id} className="text-sm">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {turn.author}
                        {turn.spoken ? " · spoken" : ""}
                        {turn.outcome ? ` · ${turn.outcome}` : ""}
                      </p>
                      <p className="whitespace-pre-wrap">{turn.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </StaffShell>
  );
}
