/** Public Ask room: portrait-led, typed-first, evidence-backed. */
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bot, CircleAlert, PanelRightOpen, Send, SquareArrowOutUpRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AssistantPortrait, type AssistantState } from "@/components/statbridge/assistant-portrait";
import { EvidenceCanvas } from "@/components/statbridge/EvidenceCanvas";
import { RenderBlock } from "@/components/statbridge/RenderBlock";
import { VoiceInput, type VoiceStatus } from "@/components/statbridge/VoiceInput";
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
];

const uid = () => Math.random().toString(36).slice(2);

function roomState(voice: VoiceStatus, pending: boolean): AssistantState {
  if (pending) return "checking";
  if (voice === "requesting") return "connecting";
  if (voice === "listening") return "listening";
  if (voice === "ended" || voice === "denied" || voice === "error") return "ended";
  return "ready";
}

export function AskExperience({ compact = false, initialDraft = "" }: { compact?: boolean; initialDraft?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState(initialDraft);
  const [canvasOpen, setCanvasOpen] = useState(true);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("ready");
  const [micLevel, setMicLevel] = useState(0);
  const reduce = useReducedMotion();

  const ask = useMutation({
    mutationFn: (question: string) => askQuestion({ data: { question, readingLevel: "short", language: "en", channel: compact ? "widget" : "web" } }),
    onSuccess: (answer) => {
      setTurns((current) => [...current, { id: uid(), role: "assistant", answer }]);
      setCanvasOpen(true);
    },
    onError: (error: Error) => setTurns((current) => [...current, {
      id: uid(), role: "error", text: error.message || "StatBridge could not complete a checked answer just now. Please try again, or send the question to an official.",
    }]),
  });

  const escalate = useMutation({
    mutationFn: (question: string) => sendToOfficial({ data: { question, consent: false, channel: compact ? "widget" : "web" } }),
    onSuccess: (answer) => setTurns((current) => [...current, { id: uid(), role: "assistant", answer }]),
  });

  const latestWithEvidence = useMemo(() => {
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const turn = turns[index]!;
      if (turn.role === "assistant" && turn.answer.officialBlocks.length > 0) return turn.answer;
    }
    return null;
  }, [turns]);

  function submit(question: string) {
    const trimmed = question.trim();
    if (trimmed.length < 3 || ask.isPending) return;
    setTurns((current) => [...current, { id: uid(), role: "user", text: trimmed }]);
    setDraft("");
    setVoiceStatus("ready");
    ask.mutate(trimmed);
  }

  const lastQuestion = [...turns].reverse().find((turn) => turn.role === "user");
  const showCanvas = Boolean(latestWithEvidence) && canvasOpen && !compact;
  const state = roomState(voiceStatus, ask.isPending);
  const statusText = state === "ready" ? "Ready when you are" : state === "connecting" ? "Connecting…" : state === "listening" ? "Listening…" : state === "checking" ? "Checking approved sources…" : "Voice session ended";

  return (
    <div className={showCanvas ? "grid h-full min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,27rem)]" : "mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col"}>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Conversation className="min-h-0">
          <ConversationContent className={turns.length === 0 ? "min-h-full justify-center px-5 py-8" : "mx-auto w-full max-w-3xl px-5 py-8"}>
            {turns.length === 0 ? (
              <div className="flex flex-col items-center text-center">
                <AssistantPortrait state={state} level={micLevel} size="large" />
                <Shimmer as="p" className="mt-1 font-mono text-xs uppercase tracking-[0.22em]" duration={2.4}>{statusText}</Shimmer>
                <h1 className="mt-4 text-2xl font-semibold sm:text-4xl">What would you like to know?</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Ask about a published statistic, definition or release. Voice is optional and starts only when you choose it.</p>
                <div className="mt-5"><VoiceInput onTranscript={(text) => setDraft((value) => value ? `${value} ${text}` : text)} onStatusChange={setVoiceStatus} onLevel={setMicLevel} prominent /></div>
                <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
                  {STARTERS.map((starter) => <button key={starter} type="button" onClick={() => submit(starter)} className="rounded-full border border-hairline bg-surface/60 px-3.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-official/50 hover:text-foreground">{starter}</button>)}
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {turns.map((turn) => (
                  <motion.div key={turn.id} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                    {turn.role === "user" && <Message from="user"><MessageContent>{turn.text}</MessageContent></Message>}
                    {turn.role === "error" && <div className="flex items-start gap-2.5 rounded-xl border border-destructive/35 bg-destructive/10 p-4 text-sm"><CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" /><div><p>{turn.text}</p>{lastQuestion?.role === "user" && <button type="button" onClick={() => submit(lastQuestion.text)} className="mt-2 text-xs font-semibold text-destructive underline">Try again</button>}</div></div>}
                    {turn.role === "assistant" && <Message from="assistant"><MessageContent className="w-full"><AnswerTurn answer={turn.answer} compact={compact} onFollowUp={submit} onEscalate={() => escalate.mutate(turn.answer.question)} escalating={escalate.isPending} /></MessageContent></Message>}
                  </motion.div>
                ))}
                {ask.isPending && <div className="flex items-center gap-3 text-sm text-muted-foreground"><AssistantPortrait state="checking" size="small" className="!size-12" /><Shimmer>Checking approved sources…</Shimmer></div>}
              </AnimatePresence>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="shrink-0 bg-gradient-to-t from-background via-background to-transparent px-4 pb-4 pt-3 sm:px-6">
          <PromptInput onSubmit={({ text }) => submit(text)} className="mx-auto max-w-3xl rounded-2xl border-input bg-surface/90 shadow-[var(--glass-shadow)] backdrop-blur-xl">
            <PromptInputBody><PromptInputTextarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about South Africa's official statistics…" /></PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>{turns.length > 0 && <VoiceInput onTranscript={(text) => setDraft((value) => value ? `${value} ${text}` : text)} onStatusChange={setVoiceStatus} onLevel={setMicLevel} />}</PromptInputTools>
              <PromptInputSubmit disabled={draft.trim().length < 3 || ask.isPending} status={ask.isPending ? "submitted" : "ready"} />
            </PromptInputFooter>
          </PromptInput>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">Answers use approved Stats SA material. Media and sensitive requests always go to a person.</p>
        </div>
      </section>

      {latestWithEvidence && !compact && <EvidenceCanvas answer={latestWithEvidence} open={canvasOpen} onClose={() => setCanvasOpen(false)} />}
      {latestWithEvidence && !canvasOpen && !compact && <button type="button" onClick={() => setCanvasOpen(true)} className="fixed bottom-28 right-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-official/50 bg-surface px-3.5 py-2 text-xs font-semibold text-official shadow-lg"><PanelRightOpen className="size-3.5" />Show evidence</button>}
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

