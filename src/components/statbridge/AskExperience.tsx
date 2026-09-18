/**
 * The Ask surface.
 *
 * Conversation is central. When an answer carries evidence the layout
 * becomes conversation plus an Evidence Canvas — a glass column beside the
 * transcript on a wide screen, a bottom sheet on a phone. Evidence stays
 * visible while the same topic continues and the transcript is never covered.
 */
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUp,
  Bot,
  CircleAlert,
  Loader2,
  PanelRightOpen,
  Send,
  ShieldCheck,
  SquareArrowOutUpRight,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AssistantMark } from "@/components/statbridge/AssistantMark";
import { EvidenceCanvas } from "@/components/statbridge/EvidenceCanvas";
import { RenderBlock } from "@/components/statbridge/RenderBlock";
import { VoiceInput } from "@/components/statbridge/VoiceInput";
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
  const [listening, setListening] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const ask = useMutation({
    mutationFn: (question: string) =>
      askQuestion({
        data: { question, readingLevel: "short", language: "en", channel: compact ? "widget" : "web" },
      }),
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
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [turns.length, ask.isPending, reduce]);

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
  const showCanvas = Boolean(latestWithEvidence) && canvasOpen && !compact;
  const markState = listening ? "listening" : ask.isPending ? "thinking" : "idle";

  return (
    <div
      className={
        showCanvas
          ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-start lg:gap-8"
          : "mx-auto w-full max-w-3xl"
      }
    >
      {/* Conversation */}
      <div className={`min-w-0 ${showCanvas ? "" : ""}`}>
        {turns.length === 0 && <Primer compact={compact} state={markState} level={micLevel} onPick={submit} />}

        <div className="space-y-6">
          <AnimatePresence initial={false}>
            {turns.map((turn) => (
              <motion.div
                key={turn.id}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
              >
                {turn.role === "user" && (
                  <div className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
                      {turn.text}
                    </p>
                  </div>
                )}

                {turn.role === "error" && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-destructive/35 bg-destructive/10 p-4 text-sm text-foreground">
                    <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <div>
                      <p>{turn.text}</p>
                      {lastQuestion?.role === "user" && (
                        <button
                          type="button"
                          onClick={() => submit(lastQuestion.text)}
                          className="mt-2 text-xs font-semibold text-destructive underline underline-offset-4"
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
              </motion.div>
            ))}
          </AnimatePresence>

          {ask.isPending && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <AssistantMark state="thinking" size={40} showBadge={false} />
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
          className={`sticky bottom-0 z-30 mt-6 bg-gradient-to-t from-background via-background to-transparent pt-5 ${
            latestWithEvidence && canvasOpen && !compact ? "pb-[58svh] lg:pb-0" : ""
          }`}
        >
          <div className="rounded-2xl border border-input bg-surface/80 p-2.5 backdrop-blur transition-colors focus-within:border-accent/70 focus-within:shadow-[var(--glow-teal)]">
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
              className="w-full resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-muted-foreground"
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-1">
              <VoiceInput
                onTranscript={(text) => setDraft((d) => (d ? `${d} ${text}` : text))}
                onListeningChange={setListening}
                onLevel={setMicLevel}
              />
              <button
                type="submit"
                disabled={draft.trim().length < 3 || ask.isPending}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
              >
                {ask.isPending ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <ArrowUp aria-hidden className="size-4" />
                )}
                Ask
              </button>
            </div>
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            Answers quote approved Stats SA material. Media and sensitive requests always go to a person.
          </p>
        </form>
      </div>

      {/* Evidence canvas */}
      {latestWithEvidence && !compact && (
        <EvidenceCanvas answer={latestWithEvidence} open={canvasOpen} onClose={() => setCanvasOpen(false)} />
      )}

      {latestWithEvidence && !canvasOpen && !compact && (
        <button
          type="button"
          onClick={() => setCanvasOpen(true)}
          className="fixed bottom-28 right-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-official/50 bg-surface px-3.5 py-2 text-xs font-semibold text-official shadow-lg"
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
        <div className="rounded-2xl border border-warn/45 bg-warn-surface p-5">
          <p className="eyebrow text-warn">Sent to an official</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {answer.reviewReasons.includes("media") || answer.reviewReasons.includes("sensitive")
              ? "StatBridge does not write replies to media or sensitive requests. A communications official will handle this one."
              : "This needs a person to answer it. A communications official will prepare a reply."}
          </p>
          <p className="mt-4 font-mono text-xl font-semibold tracking-tight text-official">{answer.caseReference}</p>
          {answer.statusToken && (
            <Link
              to="/case/$ref"
              params={{ ref: answer.caseReference }}
              search={{ token: answer.statusToken }}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent underline underline-offset-4"
            >
              Open your private status page
              <SquareArrowOutUpRight aria-hidden className="size-3.5" />
            </Link>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Save this link. It is the only way back to this request and it is not sent anywhere else.
          </p>
        </div>
      )}

      {answer.outcome === "clarification" && answer.clarification && (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="eyebrow text-muted-foreground">One quick check</p>
          <p className="mt-2 text-sm text-foreground">{answer.clarification.question}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {answer.clarification.choices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                onClick={() => onFollowUp(choice.value)}
                className="rounded-full border border-input px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-accent/60 hover:bg-secondary"
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {answer.outcome === "gap" && (
        <div className="rounded-2xl border border-warn/45 bg-warn-surface p-5">
          <p className="eyebrow text-warn">No approved source covers this</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{answer.gapDescription}</p>
          <p className="mt-2 text-xs text-muted-foreground">StatBridge will not fill a gap with wording of its own.</p>
        </div>
      )}

      {answer.aiExplanation && (
        <div className="rounded-2xl border border-assist/35 bg-assist-surface p-5">
          <p className="mb-2 flex items-center gap-1.5 eyebrow text-assist">
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
        <ul className="space-y-1.5 rounded-xl border border-warn/30 bg-warn-surface/60 p-4 text-sm text-foreground">
          {answer.caveats.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="text-warn">
                •
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}

      {answer.references.length > 0 && (
        <details className="rounded-xl border border-hairline bg-surface/60 p-4">
          <summary className="cursor-pointer eyebrow text-muted-foreground">
            References ({answer.references.length})
          </summary>
          <ol className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
            {answer.references.map((r, i) => (
              <li key={i}>
                <span className="font-semibold text-foreground">{r.title}</span> — {r.publisher}
                {r.publishedOn ? `, ${r.publishedOn}` : ""}
                {r.pageNumber ? `, page ${r.pageNumber}` : ""}
                {r.sectionLabel ? `, ${r.sectionLabel}` : ""} ({r.versionLabel})
                {r.url && (
                  <>
                    {" "}
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">
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
            className="rounded-full border border-hairline bg-surface/60 px-3.5 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground"
          >
            {q}
          </button>
        ))}
        {answer.outcome !== "escalated" && (
          <button
            type="button"
            onClick={onEscalate}
            disabled={escalating}
            className="rounded-full border border-official/55 bg-official/10 px-3.5 py-1.5 text-xs font-semibold text-official transition-colors hover:bg-official/20 disabled:opacity-60"
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

function Primer({
  compact,
  state,
  level,
  onPick,
}: {
  compact: boolean;
  state: "idle" | "listening" | "thinking";
  level: number;
  onPick: (q: string) => void;
}) {
  return (
    <div className="mb-10">
      {!compact && (
        <div className="flex flex-col items-center text-center">
          <AssistantMark state={state} level={level} size={132} />
          <h1 className="mt-6 text-3xl font-bold uppercase tracking-tight sm:text-[2.6rem]">
            Ask South Africa&apos;s official statistics
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            StatBridge answers from approved Statistics South Africa publications — published figures, definitions,
            methods, release dates and how to reach the organisation. No sign-up.
          </p>
        </div>
      )}

      <dl className={`mt-8 grid gap-3 ${compact ? "" : "sm:grid-cols-3"}`}>
        <div className="rounded-xl border border-official/30 bg-official-surface p-4">
          <dt className="flex items-center gap-1.5 eyebrow text-official">
            <ShieldCheck aria-hidden className="size-3.5" />
            Official
          </dt>
          <dd className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Quotations and figures from approved Stats SA documents, with the page or section shown.
          </dd>
        </div>
        <div className="rounded-xl border border-assist/35 bg-assist-surface p-4">
          <dt className="flex items-center gap-1.5 eyebrow text-assist">
            <Bot aria-hidden className="size-3.5" />
            AI-generated
          </dt>
          <dd className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            The plain-language wording around the evidence. Always labelled, never a new figure.
          </dd>
        </div>
        <div className="rounded-xl border border-warn/40 bg-warn-surface p-4">
          <dt className="eyebrow text-warn">Sent to a person</dt>
          <dd className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Media, sensitive and interpretive requests get a case reference and a private status link instead.
          </dd>
        </div>
      </dl>

      <div className="mt-7">
        <p className="eyebrow text-muted-foreground">Try one of these</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="rounded-full border border-hairline bg-surface/60 px-3.5 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
