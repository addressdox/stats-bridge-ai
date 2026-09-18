/** Automatic speech turns use the same governed answer pipeline and evidence as the written desk. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Mic, PanelRightOpen, PhoneOff, RotateCcw } from "lucide-react";
import { AssistantPortrait, type AssistantState } from "./assistant-portrait";
import { AudioVisualizer, formatElapsed } from "./AudioVisualizer";
import { EvidenceCanvas } from "./EvidenceCanvas";
import { ContactCard, TalkToPerson } from "./VisitorPanel";
import type { PublicAnswer } from "@/lib/statbridge/contract";
import { officialLanguageName, SOUTH_AFRICAN_LANGUAGES } from "@/lib/statbridge/languages";
import { askQuestion } from "@/lib/statbridge/public.functions";
import { useVisitorSession } from "@/lib/statbridge/useVisitor";
import { useVoiceRecorder } from "@/lib/statbridge/useVoiceRecorder";
import { spokenAnswer, VOICE_PREVIEW_LANGUAGES } from "@/lib/statbridge/voice";

type Stage =
  "connecting" | "listening" | "checking" | "speaking" | "review" | "ended" | "unavailable";

export function MultilingualVoiceCall({
  onTypeInstead,
  onLiveCall,
}: {
  onTypeInstead: (draft?: string) => void;
  onLiveCall: () => void;
}) {
  const { session } = useVisitorSession("voice");
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [stage, setStage] = useState<Stage>("connecting");
  const [heard, setHeard] = useState("");
  const [said, setSaid] = useState("");
  const [language, setLanguage] = useState("auto");
  const languageRef = useRef(language);
  languageRef.current = language;
  const [hint, setHint] = useState("auto");
  const hintRef = useRef(hint);
  hintRef.current = hint;
  const [problem, setProblem] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [answer, setAnswer] = useState<PublicAnswer | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [contactSaved, setContactSaved] = useState(false);
  const active = useRef(true);
  const generation = useRef(0);
  const parentAnswerRef = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const resume = useRef<() => void>(() => undefined);
  const query = useRef<(text: string, detectedLanguage: string) => Promise<void>>(
    async () => undefined,
  );

  const stopPlayback = useCallback(() => {
    if (audio.current) {
      audio.current.onended = null;
      audio.current.onerror = null;
      audio.current.pause();
      audio.current = null;
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
  }, []);

  const recorder = useVoiceRecorder({
    automatic: true,
    onRecording: async (blob) => {
      if (!active.current) return;
      const turn = ++generation.current;
      const controller = new AbortController();
      request.current = controller;
      setStage("checking");
      setProblem(null);
      try {
        const form = new FormData();
        form.set("audio", blob, "question.webm");
        form.set("language", hintRef.current);
        const response = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
        const transcript = (await response.json()) as {
          text?: string;
          language?: string;
          uncertain?: boolean;
          error?: string;
        };
        if (!active.current || turn !== generation.current) return;
        if (!response.ok)
          throw new Error(transcript.error || "The recording could not be understood.");
        if (!transcript.text) {
          setProblem("No clear speech was heard. Please try again or type your question.");
          resume.current();
          return;
        }
        setHeard(transcript.text);
        setLanguage(transcript.language || "auto");
        if (transcript.uncertain) {
          setStage("review");
          setProblem("Please check what was heard before sending.");
          return;
        }
        await query.current(transcript.text, transcript.language || "auto");
      } catch (error) {
        if (controller.signal.aborted || !active.current || turn !== generation.current) return;
        setProblem(error instanceof Error ? error.message : "Please retry or type your question.");
        setStage("review");
      }
    },
    onSilence: () => {
      if (active.current) resume.current();
    },
    onError: (message) => {
      setProblem(message);
      setStage("unavailable");
    },
  });

  const { start: startRecording, cancel: cancelRecording } = recorder;
  const listen = useCallback(() => {
    if (!active.current) return;
    stopPlayback();
    setStage("listening");
    void startRecording();
  }, [startRecording, stopPlayback]);
  resume.current = listen;

  query.current = async (text, detectedLanguage) => {
    const turn = ++generation.current;
    setStage("checking");
    setProblem(null);
    cancelRecording();
    stopPlayback();
    try {
      const visitor = sessionRef.current;
      const result = await askQuestion({
        data: {
          question: text,
          language: detectedLanguage,
          readingLevel: "short",
          channel: "web",
          conversationId: visitor?.conversationId ?? null,
          browserToken: visitor?.browserToken ?? null,
          parentAnswerRef: parentAnswerRef.current,
        },
      });
      if (!active.current || turn !== generation.current) return;
      parentAnswerRef.current = result.answerRef;
      setAnswer(result);
      setCanvasOpen(true);
      const detected = result.language || detectedLanguage;
      setLanguage(detected);
      setPreview(VOICE_PREVIEW_LANGUAGES.includes(detected));
      const line = spokenAnswer(result);
      setSaid(line);
      if (!line) {
        resume.current();
        return;
      }
      const controller = new AbortController();
      request.current = controller;
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: line, language: detected }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      if (!active.current || turn !== generation.current) return;
      setPreview(response.headers.get("X-Speech-Preview") === "true");
      const url = URL.createObjectURL(blob);
      audioUrl.current = url;
      const player = new Audio(url);
      audio.current = player;
      player.onended = () => {
        if (active.current && turn === generation.current) resume.current();
      };
      player.onerror = () => {
        if (active.current && turn === generation.current) {
          setProblem("Audio could not play. The answer is shown below.");
          resume.current();
        }
      };
      setStage("speaking");
      await player.play();
    } catch (error) {
      if (!active.current || turn !== generation.current) return;
      setProblem(
        error instanceof Error
          ? error.message
          : "The checked answer could not be completed. Please retry or type your question.",
      );
      setStage("review");
    }
  };

  const stop = useCallback(() => {
    active.current = false;
    generation.current += 1;
    request.current?.abort();
    cancelRecording();
    stopPlayback();
    setStage("ended");
  }, [cancelRecording, stopPlayback]);

  useEffect(() => {
    active.current = true;
    const start = setTimeout(() => resume.current(), 0);
    return () => {
      clearTimeout(start);
      active.current = false;
      generation.current += 1;
      request.current?.abort();
      stopPlayback();
    };
  }, [stopPlayback]);
  const callActive = stage !== "ended" && stage !== "unavailable";
  useEffect(() => {
    if (!callActive) return;
    const timer = setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [callActive]);

  const portrait: AssistantState =
    stage === "review" ? "ready" : stage === "unavailable" ? "ended" : stage;
  const showCanvas = Boolean(answer?.officialBlocks.length) && canvasOpen;
  return (
    <div
      className={
        showCanvas
          ? "grid h-full overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(22rem,27rem)]"
          : "h-full overflow-y-auto"
      }
    >
      <section
        className={`relative flex min-h-full min-w-0 flex-col items-center px-5 py-8 text-center ${heard ? "justify-start" : "justify-center"}`}
      >
        <AssistantPortrait state={portrait} level={recorder.level} size="large" />
        <p
          role="status"
          className="mt-6 font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground"
        >
          {stage === "listening"
            ? "Listening…"
            : stage === "checking"
              ? "Checking…"
              : stage === "speaking"
                ? "Speaking"
                : stage === "review"
                  ? "Check your question"
                  : stage === "ended"
                    ? "Call ended"
                    : stage === "unavailable"
                      ? "Microphone unavailable"
                      : "Connecting…"}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <AudioVisualizer level={recorder.level} bars={28} tone="official" className="h-8 w-56" />
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatElapsed(elapsed)}
          </span>
        </div>
        <label className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          Language
          <select
            aria-label="Spoken language"
            value={hint}
            onChange={(event) => setHint(event.target.value)}
            className="max-w-56 rounded-md border border-input bg-surface px-2 py-1 text-foreground"
          >
            <option value="auto">Detect automatically</option>
            {SOUTH_AFRICAN_LANGUAGES.filter((item) => item.spoken).map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {language !== "auto" && (
          <p className="mt-2 text-xs text-official">{officialLanguageName(language)}</p>
        )}
        {heard && (
          <div className="mt-5 w-full max-w-xl">
            <label className="eyebrow text-official" htmlFor="voice-transcript">
              Heard — correct if needed
            </label>
            <textarea
              id="voice-transcript"
              aria-label="What was heard"
              value={heard}
              onFocus={() => {
                generation.current += 1;
                request.current?.abort();
                cancelRecording();
                stopPlayback();
                setStage("review");
              }}
              onChange={(event) => setHeard(event.target.value)}
              rows={2}
              className="mt-2 w-full resize-none rounded-lg border border-input bg-surface/70 px-3 py-2 text-sm text-foreground"
            />
            {stage === "review" && (
              <button
                type="button"
                disabled={heard.trim().length < 3}
                onClick={() =>
                  void query.current(heard.trim(), hint !== "auto" ? hint : languageRef.current)
                }
                className="mt-2 rounded-full bg-official px-4 py-2 text-xs font-semibold text-official-foreground disabled:opacity-50"
              >
                Send this question
              </button>
            )}
          </div>
        )}
        {said && (
          <p
            className="mt-3 max-w-xl text-[15px] leading-relaxed text-foreground"
            lang={language === "auto" ? undefined : language}
          >
            {said}
          </p>
        )}
        {preview && (
          <p className="mt-2 max-w-xl text-xs text-muted-foreground">
            Speech preview: pronunciation may vary. Check the written answer and official evidence.
          </p>
        )}
        {problem && (
          <p role="alert" className="mt-4 max-w-xl text-sm text-muted-foreground">
            {problem}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {stage !== "ended" && (
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-full border border-destructive/55 bg-destructive/10 px-5 py-2.5 text-sm font-semibold text-destructive"
            >
              <PhoneOff aria-hidden className="size-4" />
              End call
            </button>
          )}
          {(stage === "speaking" ||
            stage === "review" ||
            stage === "unavailable" ||
            stage === "ended") && (
            <button
              type="button"
              onClick={() => {
                generation.current += 1;
                request.current?.abort();
                active.current = true;
                setProblem(null);
                listen();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-official px-5 py-2.5 text-sm font-semibold text-official-foreground"
            >
              {stage === "ended" ? (
                <RotateCcw aria-hidden className="size-4" />
              ) : (
                <Mic aria-hidden className="size-4" />
              )}
              {stage === "ended" ? "Talk again" : "Speak now"}
            </button>
          )}
          {stage === "listening" && (
            <button
              type="button"
              onClick={recorder.stop}
              className="rounded-full border border-input px-4 py-2.5 text-sm font-semibold"
            >
              Send spoken question
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              stop();
              onTypeInstead(heard || undefined);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-input bg-surface/70 px-5 py-2.5 text-sm font-semibold"
          >
            <Keyboard aria-hidden className="size-4" />
            Type instead
          </button>
          {answer?.officialBlocks.length && !canvasOpen ? (
            <button
              type="button"
              onClick={() => setCanvasOpen(true)}
              className="inline-flex items-center gap-2 text-xs text-official"
            >
              <PanelRightOpen aria-hidden className="size-4" />
              Show evidence
            </button>
          ) : null}
        </div>
        {session && heard && (
          <div className="mt-5 w-full max-w-xl text-left">
            {!session.hasContact && !contactSaved && (
              <ContactCard session={session} onSaved={() => setContactSaved(true)} />
            )}
            <TalkToPerson session={session} summary={heard} />
          </div>
        )}
        <p className="mt-6 max-w-xl text-[11px] text-muted-foreground">
          Speak in your preferred language and pause for a reply. Answers use approved Stats SA
          publications. Media and sensitive requests go to an official. South African Sign Language
          requires signed assistance, not audio.
        </p>
        <button
          type="button"
          onClick={() => {
            stop();
            onLiveCall();
          }}
          className="mt-3 text-xs text-muted-foreground underline underline-offset-4"
        >
          Use the English / Afrikaans live line
        </button>
      </section>
      {answer && (
        <EvidenceCanvas answer={answer} open={showCanvas} onClose={() => setCanvasOpen(false)} />
      )}
    </div>
  );
}
