import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Empty, Loading, Panel, Pill, relativeTime } from "@/components/statbridge/desk-ui";
import {
  CollectionPagination,
  CollectionToolbar,
  collectionSelectClass,
} from "@/components/statbridge/collection-controls";
import { StaffShell } from "@/components/statbridge/StaffShell";
import {
  actOnHandoff,
  listColleagues,
  listHandoffPage,
  readConversationDetail,
  replyAsOfficial,
} from "@/lib/statbridge/desk.functions";

const title = "Handover queue — Naledi staff";
const description =
  "Accept, decline or transfer requests the assistant has passed to a Stats SA official.";

export const Route = createFileRoute("/staff/handoffs")({
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
  component: HandoffsPage,
});

const STATES = ["waiting", "accepted", "transferred", "declined", "closed", "all"] as const;
type StateFilter = (typeof STATES)[number];

function HandoffsPage() {
  const [state, setState] = useState<StateFilter>("waiting");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10);
  const [urgency, setUrgency] = useState<"all" | "low" | "normal" | "high" | "urgent">("all");
  const [channel, setChannel] = useState<"all" | "chat" | "voice" | "widget" | "api">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const previousWaiting = useRef<number | null>(null);
  const queryClient = useQueryClient();

  const fetchHandoffs = useServerFn(listHandoffPage);
  const fetchDetail = useServerFn(readConversationDetail);
  const fetchColleagues = useServerFn(listColleagues);
  const act = useServerFn(actOnHandoff);
  const reply_ = useServerFn(replyAsOfficial);

  const handoffs = useQuery({
    queryKey: ["desk-handoffs", state, search, page, pageSize, urgency, channel, sort],
    queryFn: () =>
      fetchHandoffs({ data: { state, search, page, pageSize, urgency, channel, sort } }),
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (handoffs.data && handoffs.data.page !== page) setPage(handoffs.data.page);
  }, [handoffs.data, page]);

  const selected = (handoffs.data?.rows ?? []).find((row) => row.id === openId) ?? null;

  const detail = useQuery({
    queryKey: ["desk-conversation", selected?.conversationId],
    queryFn: () => fetchDetail({ data: { conversationId: selected!.conversationId } }),
    enabled: Boolean(selected),
    refetchInterval: 5000,
  });

  const colleagues = useQuery({ queryKey: ["desk-colleagues"], queryFn: () => fetchColleagues() });

  // A new person waiting makes a short sound, once per arrival.
  useEffect(() => {
    if (!handoffs.data) return;
    const count = handoffs.data.waitingTotal;
    if (
      state === "waiting" &&
      previousWaiting.current !== null &&
      count > previousWaiting.current
    ) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.05;
        osc.connect(gain).connect(ctx.destination);
        osc.onended = () => {
          void ctx.close();
        };
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } catch {
        // A blocked sound must never break the queue.
      }
    }
    previousWaiting.current = count;
  }, [handoffs.data, state]);

  const action = useMutation({
    mutationFn: (input: {
      handoffId: string;
      action: "accept" | "decline" | "transfer" | "close";
      reason?: string;
      transferTo?: string;
    }) => act({ data: input }),
    onSuccess: async (_result, input) => {
      toast.success(
        input.action === "accept"
          ? "You have joined the conversation."
          : input.action === "decline"
            ? "Declined."
            : input.action === "transfer"
              ? "Transferred to your colleague."
              : "Closed.",
      );
      await queryClient.invalidateQueries({ queryKey: ["desk-handoffs"] });
      await queryClient.invalidateQueries({ queryKey: ["desk-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const send = useMutation({
    mutationFn: (body: string) =>
      reply_({ data: { conversationId: selected!.conversationId, body } }),
    onSuccess: async () => {
      setReply("");
      await queryClient.invalidateQueries({
        queryKey: ["desk-conversation", selected?.conversationId],
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <StaffShell title="Handover queue">
      <div className="space-y-4">
        <CollectionToolbar
          search={search}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchLabel="Search handovers"
          placeholder="Search person, contact, summary or topic…"
          onReset={() => {
            setSearch("");
            setState("waiting");
            setUrgency("all");
            setChannel("all");
            setSort("newest");
            setPage(1);
          }}
        >
          <label className="grid gap-1 text-xs text-muted-foreground">
            State
            <select
              aria-label="Handover state"
              value={state}
              onChange={(event) => {
                setState(event.target.value as StateFilter);
                setPage(1);
              }}
              className={collectionSelectClass}
            >
              {STATES.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "Any state" : value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Urgency
            <select
              aria-label="Handover urgency"
              value={urgency}
              onChange={(event) => {
                setUrgency(event.target.value as typeof urgency);
                setPage(1);
              }}
              className={collectionSelectClass}
            >
              <option value="all">Any urgency</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Channel
            <select
              aria-label="Handover channel"
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
              aria-label="Handover order"
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
            title="Requests"
            description="Updates automatically. Open a request to view its transcript and manage the handover."
          >
            {handoffs.isLoading ? (
              <Loading />
            ) : handoffs.isError ? (
              <p role="alert" className="py-4 text-sm text-destructive">
                {handoffs.error.message}
              </p>
            ) : (handoffs.data?.rows ?? []).length === 0 ? (
              <Empty>No handovers match these filters.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="w-full min-w-[760px] text-left text-sm"
                  aria-label="Handover requests"
                >
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Person / topic
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        State
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Urgency
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Channel
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Assigned official
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Requested
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(handoffs.data?.rows ?? []).map((row) => (
                      <tr
                        key={row.id}
                        className={openId === row.id ? "bg-secondary" : "hover:bg-secondary/40"}
                      >
                        <td className="py-3 pr-3">
                          <button
                            type="button"
                            onClick={() => setOpenId(row.id)}
                            className="text-left font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {row.visitorName ?? "Someone on the public site"}
                          </button>
                          <p className="mt-1 max-w-80 line-clamp-2 text-xs text-muted-foreground">
                            {row.summary}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {row.reason.replace(/_/g, " ")}
                          </p>
                        </td>
                        <td className="py-3 pr-3 capitalize">
                          <Pill
                            tone={
                              row.state === "waiting"
                                ? "warn"
                                : row.state === "accepted"
                                  ? "good"
                                  : "muted"
                            }
                          >
                            {row.state}
                          </Pill>
                        </td>
                        <td className="py-3 pr-3">
                          <Pill
                            tone={
                              row.urgency === "urgent" || row.urgency === "high" ? "warn" : "muted"
                            }
                          >
                            {row.urgency}
                          </Pill>
                        </td>
                        <td className="py-3 pr-3 text-xs capitalize">{row.channel}</td>
                        <td className="py-3 pr-3 text-xs">{row.acceptedByName ?? "Unassigned"}</td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {relativeTime(row.requestedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <CollectionPagination
              label="Handovers"
              page={handoffs.data?.page ?? page}
              pageSize={pageSize}
              total={handoffs.data?.total ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value as 10 | 25 | 50);
                setPage(1);
              }}
              busy={handoffs.isFetching}
            />
          </Panel>

          {selected && (
            <Panel
              title="Conversation"
              description={selected.topic ?? "Full transcript and contact details"}
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
              {!selected ? (
                <Empty>Select a request above to see the whole conversation.</Empty>
              ) : (
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Name</dt>
                    <dd>{selected.visitorName ?? "Not given"}</dd>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="truncate">{selected.visitorEmail ?? "Not given"}</dd>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd>
                      {(selected.callerPhone ?? selected.visitorPhone) ? (
                        <a
                          className="underline underline-offset-2"
                          href={`tel:${(selected.callerPhone ?? selected.visitorPhone ?? "").replace(/\s+/g, "")}`}
                        >
                          {selected.callerPhone ?? selected.visitorPhone}
                        </a>
                      ) : (
                        "Not given"
                      )}
                    </dd>
                    <dt className="text-muted-foreground">Came in by</dt>
                    <dd className="capitalize">
                      {selected.channel === "voice" ? "Voice call" : selected.channel}
                    </dd>
                    {selected.offeredPhone && (
                      <>
                        <dt className="text-muted-foreground">Desk number given</dt>
                        <dd>{selected.offeredPhone}</dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">Reason</dt>
                    <dd className="capitalize">{selected.reason.replace(/_/g, " ")}</dd>
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    {selected.state === "waiting" && (
                      <>
                        <button
                          onClick={() =>
                            action.mutate({ handoffId: selected.id, action: "accept" })
                          }
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => {
                            const reason = window.prompt("Why are you declining this?") ?? "";
                            if (reason.trim())
                              action.mutate({ handoffId: selected.id, action: "decline", reason });
                          }}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {(colleagues.data ?? []).length > 0 && selected.state !== "closed" && (
                      <select
                        aria-label="Transfer to a colleague"
                        defaultValue=""
                        onChange={(event) => {
                          if (event.target.value)
                            action.mutate({
                              handoffId: selected.id,
                              action: "transfer",
                              transferTo: event.target.value,
                            });
                        }}
                        className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
                      >
                        <option value="">Transfer to…</option>
                        {(colleagues.data ?? []).map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.full_name}
                          </option>
                        ))}
                      </select>
                    )}
                    {selected.state !== "closed" && (
                      <button
                        onClick={() => action.mutate({ handoffId: selected.id, action: "close" })}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
                      >
                        Close
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-3">
                    {detail.isLoading ? (
                      <Loading label="Loading the transcript…" />
                    ) : detail.isError ? (
                      <p role="alert" className="text-sm text-destructive">
                        {detail.error.message}
                      </p>
                    ) : (detail.data?.turns ?? []).length === 0 ? (
                      <Empty>No messages yet.</Empty>
                    ) : (
                      (detail.data?.turns ?? []).map((turn) => (
                        <div key={turn.id} className="text-sm">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {turn.author}
                          </p>
                          <p className="whitespace-pre-wrap">{turn.body}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {selected.state === "accepted" && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (reply.trim()) send.mutate(reply.trim());
                      }}
                      className="flex gap-2"
                    >
                      <input
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        placeholder="Reply to this person…"
                        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={send.isPending || !reply.trim()}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                      >
                        <Send aria-hidden className="size-3.5" />
                        Send
                      </button>
                    </form>
                  )}
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </StaffShell>
  );
}
