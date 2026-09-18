/** Visitor-side contact capture and the "speak to a person" thread. */
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Headset, Loader2, Send, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";

import {
  askForHuman,
  readConversation,
  saveContactDetails,
  sendToOfficialThread,
} from "@/lib/statbridge/conversation.functions";
import type { VisitorSession } from "@/lib/statbridge/useVisitor";

/** Name, email and phone — asked once, kept on the server. */
export function ContactCard({
  session,
  onSaved,
}: {
  session: VisitorSession;
  onSaved: (name: string | null) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      saveContactDetails({
        data: {
          browserToken: session.browserToken,
          contact: {
            fullName: fullName.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            organisation: organisation.trim() || null,
            consent,
          },
        },
      }),
    onSuccess: (result) => {
      setDone(true);
      onSaved(result.knownName ?? (fullName.trim() || null));
    },
  });

  const ready = fullName.trim().length > 1 && (email.trim().length > 4 || phone.trim().length > 5) && consent;

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-official/40 bg-official/10 px-4 py-3 text-sm text-foreground">
        <CheckCircle2 aria-hidden className="size-4 text-official" />
        Thank you{fullName.trim() ? `, ${fullName.trim().split(" ")[0]}` : ""}. Your details are on file for this request.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface/70 p-5">
      <p className="flex items-center gap-1.5 eyebrow text-muted-foreground">
        <UserRound aria-hidden className="size-3.5" />
        Who are we speaking with?
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        A name and one way to reach you lets an official follow up and lets us recognise you next time.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Full name"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          inputMode="email"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Phone number"
          inputMode="tel"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          value={organisation}
          onChange={(event) => setOrganisation(event.target.value)}
          placeholder="Organisation (optional)"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 size-3.5 accent-[var(--official)]"
        />
        <span>
          I agree that StatBridge may keep these details to handle my request. They are never sold or shared, and they
          are removed on request.
        </span>
      </label>
      <button
        type="button"
        disabled={!ready || save.isPending}
        onClick={() => save.mutate()}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-official px-4 py-2 text-sm font-semibold text-official-foreground disabled:opacity-50"
      >
        {save.isPending ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <ShieldCheck aria-hidden className="size-3.5" />}
        Save my details
      </button>
    </div>
  );
}

/** Asks for a person and then shows the live thread with the official. */
export function TalkToPerson({
  session,
  summary,
  topic,
  compact = false,
}: {
  session: VisitorSession;
  summary: string;
  topic?: string | null;
  compact?: boolean;
}) {
  const [requested, setRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [deskPhone, setDeskPhone] = useState<{ number: string; label: string; hours: string } | null>(null);

  const request = useMutation({
    mutationFn: () =>
      askForHuman({
        data: {
          conversationId: session.conversationId,
          browserToken: session.browserToken,
          reason: "visitor_request",
          urgency: "normal",
          summary: summary.slice(0, 2000) || "A visitor asked to speak with a person.",
          topic: topic ?? null,
        },
      }),
    onSuccess: (result) => {
      setRequested(true);
      if (result.officerPhone) {
        setDeskPhone({
          number: result.officerPhone,
          label: result.officerPhoneLabel ?? "Stats SA communications desk",
          hours: result.officeHours,
        });
      }
    },
  });

  const thread = useQuery({
    queryKey: ["visitor-thread", session.conversationId],
    enabled: requested,
    refetchInterval: 4000,
    queryFn: () =>
      readConversation({ data: { conversationId: session.conversationId, browserToken: session.browserToken } }),
  });

  const reply = useMutation({
    mutationFn: (body: string) =>
      sendToOfficialThread({
        data: { conversationId: session.conversationId, browserToken: session.browserToken, body },
      }),
    onSuccess: () => {
      setMessage("");
      void thread.refetch();
    },
  });

  if (!requested) {
    return (
      <button
        type="button"
        onClick={() => request.mutate()}
        disabled={request.isPending}
        className="rounded-full border border-hairline bg-surface/60 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-official/50 hover:text-foreground disabled:opacity-60"
      >
        <Headset aria-hidden className="mr-1 inline size-3" />
        Speak to a person
      </button>
    );
  }

  const handoffState = thread.data?.handoff?.state ?? "waiting";
  const joined = handoffState === "accepted";

  return (
    <div className={`rounded-2xl border border-official/40 bg-official/5 p-4 ${compact ? "text-xs" : "text-sm"}`}>
      <p className="flex items-center gap-1.5 eyebrow text-official">
        <Headset aria-hidden className="size-3.5" />
        {joined ? "An official has joined" : "Waiting for an official"}
      </p>
      {deskPhone && (
        <p className="mt-2 rounded-lg border border-hairline bg-surface/70 px-3 py-2 text-xs">
          Prefer to call? {deskPhone.label}:{" "}
          <a className="font-semibold text-official underline underline-offset-2" href={`tel:${deskPhone.number.replace(/\s+/g, "")}`}>
            {deskPhone.number}
          </a>{" "}
          · {deskPhone.hours}
        </p>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">
        {joined
          ? "You are now speaking with a member of the communications team."
          : "Your request is in the queue. You can keep this page open, or leave your details above and we will come back to you."}
      </p>

      {joined && (
        <>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {(thread.data?.turns ?? [])
              .filter((turn) => turn.author === "official" || turn.author === "visitor")
              .map((turn) => (
                <div
                  key={turn.id}
                  className={
                    turn.author === "visitor"
                      ? "ml-auto w-fit max-w-[85%] rounded-xl bg-secondary px-3 py-1.5"
                      : "w-fit max-w-[85%] rounded-xl border border-hairline bg-surface px-3 py-1.5"
                  }
                >
                  {turn.body}
                </div>
              ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (message.trim().length > 0) reply.mutate(message.trim());
            }}
          >
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write to the official…"
              className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={reply.isPending || message.trim().length === 0}
              className="rounded-lg bg-official px-3 py-2 text-official-foreground disabled:opacity-50"
            >
              <Send aria-hidden className="size-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
