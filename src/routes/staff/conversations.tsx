import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import {
  Empty,
  Loading,
  Panel,
  Pill,
  duration,
  relativeTime,
} from "@/components/statbridge/desk-ui";
import {
  CollectionPagination,
  CollectionToolbar,
  collectionSelectClass,
} from "@/components/statbridge/collection-controls";
import { StaffShell } from "@/components/statbridge/StaffShell";
import { listConversationPage, readConversationDetail } from "@/lib/statbridge/desk.functions";

const title = "Conversations — Naledi staff";
const description =
  "Every chat and voice call with the Stats SA assistant, with transcript, evidence and analysis.";

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [state, setState] = useState<"all" | "active" | "ended" | "handed_off" | "abandoned">(
    "all",
  );
  const [channel, setChannel] = useState<"all" | "chat" | "voice" | "widget" | "api">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchList = useServerFn(listConversationPage);
  const fetchDetail = useServerFn(readConversationDetail);

  const list = useQuery({
    queryKey: ["desk-conversations", search, state, channel, page, pageSize, sort],
    queryFn: () => fetchList({ data: { search, state, channel, page, pageSize, sort } }),
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (list.data && list.data.page !== page) setPage(list.data.page);
  }, [list.data, page]);

  const detail = useQuery({
    queryKey: ["desk-conversation", openId],
    queryFn: () => fetchDetail({ data: { conversationId: openId! } }),
    enabled: Boolean(openId),
  });

  return (
    <StaffShell title="Conversations">
      <div className="space-y-4">
        <CollectionToolbar
          search={search}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchLabel="Search conversations"
          placeholder="Search name, email, topic or summary…"
          onReset={() => {
            setSearch("");
            setState("all");
            setChannel("all");
            setSort("newest");
            setPage(1);
          }}
        >
          <label className="grid gap-1 text-xs text-muted-foreground">
            State
            <select
              aria-label="Conversation state"
              value={state}
              onChange={(event) => {
                setState(event.target.value as typeof state);
                setPage(1);
              }}
              className={collectionSelectClass}
            >
              <option value="all">Any state</option>
              <option value="active">Live</option>
              <option value="ended">Ended</option>
              <option value="handed_off">Handed over</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Channel
            <select
              aria-label="Conversation channel"
              value={channel}
              onChange={(event) => {
                setChannel(event.target.value as typeof channel);
                setPage(1);
              }}
              className={collectionSelectClass}
            >
              <option value="all">Any channel</option>
              <option value="chat">Chat</option>
              <option value="voice">Voice</option>
              <option value="widget">Widget</option>
              <option value="api">API</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Order
            <select
              aria-label="Conversation order"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as typeof sort);
                setPage(1);
              }}
              className={collectionSelectClass}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </CollectionToolbar>

        <div className="space-y-4">
          <Panel
            title="All conversations"
            description="Search the full conversation history. Open a conversation to read its transcript and analysis."
          >
            {list.isLoading ? (
              <Loading />
            ) : list.isError ? (
              <p role="alert" className="py-4 text-sm text-destructive">
                {list.error.message}
              </p>
            ) : (list.data?.rows ?? []).length === 0 ? (
              <Empty>No conversations match these filters yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="w-full min-w-[660px] text-left text-sm"
                  aria-label="Conversations"
                >
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Person
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Topic
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Channel / state
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Length
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Started
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(list.data?.rows ?? []).map((row) => (
                      <tr
                        key={row.id}
                        className={`transition-colors hover:bg-secondary/60 ${openId === row.id ? "bg-secondary" : ""}`}
                      >
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            onClick={() => setOpenId(row.id)}
                            aria-label={`Open conversation with ${row.visitorName ?? "visitor"} started ${new Date(row.startedAt).toLocaleString("en-ZA")}`}
                            className="block max-w-48 truncate font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {row.visitorName ?? "Not given"}
                          </button>
                          <span className="block max-w-40 truncate text-xs text-muted-foreground">
                            {row.visitorEmail ?? "—"}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <span className="block max-w-48 truncate">{row.topic ?? "—"}</span>
                          {row.resolved === false && <Pill tone="warn">unresolved</Pill>}
                        </td>
                        <td className="py-2 pr-3 text-xs capitalize">
                          {row.channel}
                          <span className="mt-1 block">
                            <Pill tone={row.state === "active" ? "good" : "muted"}>
                              {row.state.replace(/_/g, " ")}
                            </Pill>
                          </span>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs tabular-nums">
                          {duration(row.durationSeconds)}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {relativeTime(row.startedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <CollectionPagination
              label="Conversations"
              page={list.data?.page ?? page}
              pageSize={pageSize}
              total={list.data?.total ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value as 10 | 25 | 50);
                setPage(1);
              }}
              busy={list.isFetching}
            />
          </Panel>

          {openId && (
            <Panel
              title="Conversation detail"
              description="Transcript and analysis"
              action={
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs"
                >
                  Close detail
                </button>
              }
            >
              {!openId ? (
                <Empty>Select a row to read the whole conversation.</Empty>
              ) : detail.isLoading ? (
                <Loading />
              ) : detail.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {detail.error.message}
                </p>
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
          )}
        </div>
      </div>
    </StaffShell>
  );
}
