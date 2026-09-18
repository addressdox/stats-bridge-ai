import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Empty, Loading, Panel, Pill, relativeTime } from "@/components/statbridge/desk-ui";
import { StaffShell } from "@/components/statbridge/StaffShell";
import {
  actOnHandoff,
  listColleagues,
  listHandoffs,
  readConversationDetail,
  replyAsOfficial,
} from "@/lib/statbridge/desk.functions";

const title = "Handover queue — StatBridge staff";
const description = "Accept, decline or transfer requests the assistant has passed to a Stats SA official.";

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
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const previousWaiting = useRef(0);
  const queryClient = useQueryClient();

  const fetchHandoffs = useServerFn(listHandoffs);
  const fetchDetail = useServerFn(readConversationDetail);
  const fetchColleagues = useServerFn(listColleagues);
  const act = useServerFn(actOnHandoff);
  const reply_ = useServerFn(replyAsOfficial);

  const handoffs = useQuery({
    queryKey: ["desk-handoffs", state],
    queryFn: () => fetchHandoffs({ data: { state } }),
    refetchInterval: 8000,
  });

  const selected = (handoffs.data ?? []).find((row) => row.id === openId) ?? null;

  const detail = useQuery({
    queryKey: ["desk-conversation", selected?.conversationId],
    queryFn: () => fetchDetail({ data: { conversationId: selected!.conversationId } }),
    enabled: Boolean(selected),
    refetchInterval: 5000,
  });

  const colleagues = useQuery({ queryKey: ["desk-colleagues"], queryFn: () => fetchColleagues() });

  // A new person waiting makes a short sound, once per arrival.
  useEffect(() => {
    if (state !== "waiting") return;
    const count = (handoffs.data ?? []).length;
    if (count > previousWaiting.current && previousWaiting.current !== 0) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.05;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } catch {
        // A blocked sound must never break the queue.
      }
    }
    previousWaiting.current = count;
  }, [handoffs.data, state]);

  const action = useMutation({
    mutationFn: (input: { handoffId: string; action: "accept" | "decline" | "transfer" | "close"; reason?: string; transferTo?: string }) =>
      act({ data: input }),
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
    mutationFn: (body: string) => reply_({ data: { conversationId: selected!.conversationId, body } }),
    onSuccess: async () => {
      setReply("");
      await queryClient.invalidateQueries({ queryKey: ["desk-conversation", selected?.conversationId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <StaffShell title="Handover queue">
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-border bg-background px-4 py-2 sm:-mx-6 sm:px-6">
          {STATES.map((value) => (
            <button
              key={value}
              onClick={() => setState(value)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                state === value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {value === "all" ? "All" : value}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <Panel title="Requests" description="Newest first. Updates by itself.">
            {handoffs.isLoading ? (
              <Loading />
            ) : (handoffs.data ?? []).length === 0 ? (
              <Empty>Nothing in this list.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {(handoffs.data ?? []).map((row) => (
                  <li key={row.id}>
                    <button
                      onClick={() => setOpenId(row.id)}
                      className={`w-full rounded-md px-2 py-2.5 text-left transition-colors hover:bg-secondary/60 ${
                        openId === row.id ? "bg-secondary" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {row.visitorName ?? "Someone on the public site"}
                        </span>
                        <Pill tone={row.urgency === "urgent" || row.urgency === "high" ? "warn" : "muted"}>
                          {row.urgency}
                        </Pill>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{row.summary}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {row.reason.replace(/_/g, " ")} · {relativeTime(row.requestedAt)}
                        {row.acceptedByName ? ` · with ${row.acceptedByName}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Conversation" description={selected ? selected.topic ?? "Full transcript and contact details" : "Choose a request"}>
            {!selected ? (
              <Empty>Select a request on the left to see the whole conversation.</Empty>
            ) : (
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd>{selected.visitorName ?? "Not given"}</dd>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate">{selected.visitorEmail ?? "Not given"}</dd>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{selected.visitorPhone ?? "Not given"}</dd>
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd className="capitalize">{selected.reason.replace(/_/g, " ")}</dd>
                </dl>

                <div className="flex flex-wrap gap-2">
                  {selected.state === "waiting" && (
                    <>
                      <button
                        onClick={() => action.mutate({ handoffId: selected.id, action: "accept" })}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          const reason = window.prompt("Why are you declining this?") ?? "";
                          if (reason.trim()) action.mutate({ handoffId: selected.id, action: "decline", reason });
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
                          action.mutate({ handoffId: selected.id, action: "transfer", transferTo: event.target.value });
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
                  ) : (detail.data?.turns ?? []).length === 0 ? (
                    <Empty>No messages yet.</Empty>
                  ) : (
                    (detail.data?.turns ?? []).map((turn) => (
                      <div key={turn.id} className="text-sm">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{turn.author}</p>
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
        </div>
      </div>
    </StaffShell>
  );
}
