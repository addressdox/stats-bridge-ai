/**
 * The Ask surface. Conversation is central; when an answer carries evidence
 * the layout becomes conversation plus an Evidence Canvas (two columns on
 * desktop, evidence below the answer on small screens). Evidence stays
 * visible while the same topic continues and the transcript is never covered.
 */
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowUp,
  Bot,
  CircleAlert,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Send,
  ShieldCheck,
  SquareArrowOutUpRight,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { RenderBlock } from "@/components/statbridge/RenderBlock";
import { VoiceInput } from "@/components/statbridge/VoiceInput";
import { Button } from "@/components/ui/button";
import { REVIEW_REASON_LABELS, type PublicAnswer } from "@/lib/statbridge/contract";
import { askQuestion, sendToOfficial } from "@/lib/statbridge/public.functions";

type Turn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; answer: PublicAnswer }
  | { id: string; role: "error"; text: string };

const STARTERS = [
  "What was the unemployment rate in the latest Quarterly Labour Force Survey?",
  "How does Stats SA define the expanded unemployment rate?",
  "When is the next Quarterly Labour Force Survey published?",
  "How do I request data from Stats SA?",
];

function uid() {
  return Math.random().toString(36).slice(2);
}

export function AskExperience({ compact = false }: { compact?: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [canvasOpen, setCanvasOpen] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (question: string) =>
      askQuestion({ data: { question, readingLevel: "short", language: "en", channel: compact ? "widget" : "web" } }),
    onSuccess: (answer) => {
      setTurns((t) => [...t, { id: uid(), role: "assistant", answer }]);
      setCanvasOpen(true);
    },
    onError: (error: Error) => {
      setTurns((t) => [
        ...t,
        {
          id: uid(),
          role: "error",
          text:
            error.message ||
            "StatBridge could not complete a checked answer just now. Please try again, or send the question to an official.",
        },
      ]);
    },
  });

  const escalate = useMutation({
    mutationFn: (question: string) =>
      sendToOfficial({ data: { question, consent: false, channel: compact ? "widget" : "web" } }),
    onSuccess: (answer) => setTurns((t) => [...t, { id: uid(), role: "assistant", answer }]),
  });

  const latestWithEvidence = useMemo(() => {
    for (let i = turns.length - 1; i >= 0; i -= 1) {
      const turn = turns[i]!;
      if (turn.role === "assistant" && turn.answer.officialBlocks.length > 0) return turn.answer;
    }
    return null;
  }, [turns]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, ask.isPending]);

  useEffect(() => {
    if (!ask.isPending) textareaRef.current?.focus();
  }, [ask.isPending]);

  function submit(question: string) {
    const trimmed = question.trim();
    if (trimmed.length < 3 || ask.isPending) return;
    setTurns((t) => [...t, { id: uid(), role: "user", text: trimmed }]);
    setDraft("");
    ask.mutate(trimmed);
  }

  const lastQuestion = [...turns].reverse().find((t) => t.role === "user");
  const showCanvas = Boolean(latestWithEvidence) && canvasOpen;

  return (
    <div className={showCanvas && !compact ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-6" : ""}>
      {/* Conversation */}
      <div className="min-w-0">
        {turns.length === 0 && <Primer compact={compact} onPick={submit} />}

        <div className="space-y-6">
          {turns.map((turn) => (
            <div key={turn.id}>
              {turn.role === "user" && (
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {turn.text}
                  </p>
                </div>
              )}

              {turn.role === "error" && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p>{turn.text}</p>
                    {lastQuestion?.role === "user" && (
                      <button
                        type="button"
                        onClick={() => submit(lastQuestion.text)}
                        className="mt-2 text-xs font-semibold underline underline-offset-2"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                </div>
              )}

              {turn.role === "assistant" && (
                <AnswerTurn
                  answer={turn.answer}
                  compact={compact}
                  onFollowUp={submit}
                  onEscalate={() => escalate.mutate(turn.answer.question)}
                  escalating={escalate.isPending}
                />
              )}
            </div>
          ))}

          {ask.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Checking approved Stats SA sources…
            </div>
          )}
        </div>

        <div ref={endRef} />

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
          className="sticky bottom-0 mt-6 bg-gradient-to-t from-background via-background to-transparent pt-4"
        >
          <div className="rounded-xl border border-input bg-surface p-2 shadow-sm focus-within:border-ring">
            <label htmlFor="ask-input" className="sr-only">
              Type your question
            </label>
            <textarea
              id="ask-input"
              ref={textareaRef}
              rows={compact ? 2 : 3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              placeholder="Ask about a published statistic, a definition, or how to reach Stats SA…"
              className="w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between gap-2 px-1">
              <VoiceInput onTranscript={(text) => setDraft((d) => (d ? `${d} ${text}` : text))} />
              <Button type="submit" size="sm" disabled={draft.trim().length < 3 || ask.isPending}>
                {ask.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowUp aria-hidden className="size-4" />}
                Ask
              </Button>
            </div>
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            Answers quote approved Stats SA material. Media and sensitive requests always go to a person.
          </p>
        </form>
      </div>

      {/* Evidence canvas */}
      {latestWithEvidence && (
        <aside
          aria-label="Evidence"
          className={
            compact
              ? "mt-6"
              : `mt-6 lg:mt-0 ${showCanvas ? "" : "hidden"} lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto`
          }
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck aria-hidden className="size-3.5 text-official" />
              Evidence
            </p>
            {!compact && (
              <button
                type="button"
                onClick={() => setCanvasOpen(false)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
              >
                <PanelRightClose aria-hidden className="size-3.5" />
                Hide
              </button>
            )}
          </div>
          <div className="space-y-3">
            {latestWithEvidence.officialBlocks.map((block, i) => (
              <RenderBlock key={i} block={block} />
            ))}
          </div>
        </aside>
      )}

      {latestWithEvidence && !canvasOpen && !compact && (
        <button
          type="button"
          onClick={() => setCanvasOpen(true)}
          className="fixed bottom-24 right-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs font-medium shadow-md"
        >
          <PanelRightOpen aria-hidden className="size-3.5" />
          Show evidence
        </button>
      )}
    </div>
  );
}

function AnswerTurn({
  answer,
  compact,
  onFollowUp,
  onEscalate,
  escalating,
}: {
  answer: PublicAnswer;
  compact: boolean;
  onFollowUp: (q: string) => void;
  onEscalate: () => void;
  escalating: boolean;
}) {
  return (
    <div className="space-y-3">
      {answer.outcome === "escalated" && answer.caseReference && (
        <div className="rounded-lg border border-warn/40 bg-warn-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-warn-foreground">Sent to an official</p>
          <p className="mt-2 text-sm text-warn-foreground">
            {answer.reviewReasons.includes("media") || answer.reviewReasons.includes("sensitive")
              ? "StatBridge does not write replies to media or sensitive requests. A communications official will handle this one."
              : "This needs a person to answer it. A communications official will prepare a reply."}
          </p>
          <p className="mt-3 font-mono text-lg font-semibold text-foreground">{answer.caseReference}</p>
          {answer.statusToken && (
            <Link
              to="/case/$ref"
              params={{ ref: answer.caseReference }}
              search={{ token: answer.statusToken }}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent underline underline-offset-2"
            >
              Open your private status page
              <SquareArrowOutUpRight aria-hidden className="size-3.5" />
            </Link>
          )}
          <p className="mt-3 text-xs text-warn-foreground/80">
            Save this link. It is the only way back to this request and it is not sent anywhere else.
          </p>
        </div>
      )}

      {answer.outcome === "clarification" && answer.clarification && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">One quick check</p>
          <p className="mt-2 text-sm text-foreground">{answer.clarification.question}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {answer.clarification.choices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                onClick={() => onFollowUp(choice.value)}
                className="rounded-full border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {answer.outcome === "gap" && (
        <div className="rounded-lg border border-warn/40 bg-warn-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-warn-foreground">No approved source covers this</p>
          <p className="mt-2 text-sm text-warn-foreground">{answer.gapDescription}</p>
          <p className="mt-2 text-xs text-warn-foreground/80">
            StatBridge will not fill a gap with wording of its own.
          </p>
        </div>
      )}

      {answer.aiExplanation && (
        <div className="rounded-lg border border-assist/30 bg-assist-surface p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-assist-foreground">
            <Bot aria-hidden className="size-3.5" />
            AI-generated explanation
          </p>
          <p className="text-[15px] leading-relaxed text-foreground">{answer.aiExplanation}</p>
        </div>
      )}

      {compact &&
        answer.officialBlocks.length > 0 &&
        answer.officialBlocks.map((block, i) => <RenderBlock key={i} block={block} />)}

      {answer.caveats.length > 0 && (
        <ul className="space-y-1.5 rounded-lg border border-warn/30 bg-warn-surface p-3 text-sm text-warn-foreground">
          {answer.caveats.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}

      {answer.references.length > 0 && (
        <details className="rounded-lg border border-border bg-surface p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            References ({answer.references.length})
          </summary>
          <ol className="mt-2 space-y-2 text-xs text-muted-foreground">
            {answer.references.map((r, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">{r.title}</span> — {r.publisher}
                {r.publishedOn ? `, ${r.publishedOn}` : ""}
                {r.pageNumber ? `, page ${r.pageNumber}` : ""}
                {r.sectionLabel ? `, ${r.sectionLabel}` : ""} ({r.versionLabel})
                {r.url && (
                  <>
                    {" "}
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
                      link
                    </a>
                  </>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {answer.followUps.slice(0, 3).map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onFollowUp(q)}
            className="rounded-full border border-input px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {q}
          </button>
        ))}
        {answer.outcome !== "escalated" && (
          <button
            type="button"
            onClick={onEscalate}
            disabled={escalating}
            className="rounded-full border border-warn/50 bg-warn-surface px-3 py-1.5 text-xs font-semibold text-warn-foreground transition-colors hover:brightness-95 disabled:opacity-60"
          >
            <Send aria-hidden className="mr-1 inline size-3" />
            Send this to an official
          </button>
        )}
      </div>

      {answer.reviewReasons.length > 0 && answer.outcome === "escalated" && (
        <p className="text-xs text-muted-foreground">
          Reason for review: {answer.reviewReasons.map((r) => REVIEW_REASON_LABELS[r] ?? r).join(", ")}
        </p>
      )}
    </div>
  );
}

function Primer({ compact, onPick }: { compact: boolean; onPick: (q: string) => void }) {
  return (
    <div className="mb-8">
      {!compact && (
        <>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Ask about South Africa&apos;s official statistics
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            StatBridge answers from approved Statistics South Africa publications. You can ask about published figures,
            definitions, methods, publication dates and how to reach the organisation. No sign-up is needed.
          </p>
        </>
      )}

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-official/25 bg-official-surface p-3">
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-official-foreground">
            <ShieldCheck aria-hidden className="size-3.5" />
            Official
          </dt>
          <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Quotations and figures taken from approved Stats SA documents, with the page or section shown.
          </dd>
        </div>
        <div className="rounded-lg border border-assist/30 bg-assist-surface p-3">
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-assist-foreground">
            <Bot aria-hidden className="size-3.5" />
            AI-generated
          </dt>
          <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The plain-language wording around the evidence. Always labelled, never a new figure.
          </dd>
        </div>
        <div className="rounded-lg border border-warn/40 bg-warn-surface p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-warn-foreground">Sent to a person</dt>
          <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Media, sensitive and interpretive requests get a case reference and a private status link instead.
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Try one of these</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="rounded-full border border-input bg-surface px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
