/**
 * Voice call surface for the Ask room.
 *
 * The call is started by the person's own click on "Ask StatBridge", so the
 * microphone is requested on entry to this screen and never in the background.
 * Voice and typing are separate surfaces: this screen can hand over to the
 * typed room, and the typed room can hand back.
 */
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Keyboard, Mic, PhoneOff, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { AudioVisualizer, formatElapsed } from "@/components/statbridge/AudioVisualizer";
import { AssistantPortrait, type AssistantState } from "@/components/statbridge/assistant-portrait";
import type { PublicAnswer } from "@/lib/statbridge/contract";
import { askQuestion } from "@/lib/statbridge/public.functions";

type CallState = "connecting" | "listening" | "checking" | "speaking" | "ended" | "unavailable";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function spokenSummary(answer: PublicAnswer): string {
  if (answer.outcome === "escalated" && answer.caseReference) {
    return `This one goes to a communications official. Your reference is ${answer.caseReference}. Switch to typing to open your private status page.`;
  }
  if (answer.outcome === "gap") {
    return answer.gapDescription ?? "No approved source covers that yet.";
  }
  if (answer.outcome === "clarification" && answer.clarification) {
    return answer.clarification.question;
  }
  if (answer.aiExplanation) return answer.aiExplanation;
  return "I have a checked answer with its source. Switch to typing to read it with the reference.";
}

const STATE_LABEL: Record<CallState, string> = {
  connecting: "Calling…",
  listening: "Listening…",
  checking: "Checking approved sources…",
  speaking: "Speaking",
  ended: "Call ended",
  unavailable: "Voice is not available in this browser",
};

export function VoiceCall({ onTypeInstead }: { onTypeInstead: (draft?: string) => void }) {
  const reduce = useReducedMotion();
  const [state, setState] = useState<CallState>("connecting");
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);

  const teardown = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close().catch(() => undefined);
    contextRef.current = null;
    setLevel(0);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const ask = useMutation({
    mutationFn: (question: string) =>
      askQuestion({ data: { question, readingLevel: "short", language: "en", channel: "web" } }),
    onSuccess: (answer) => {
      if (endedRef.current) return;
      const text = spokenSummary(answer);
      setReply(text);
      setState("speaking");
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-ZA";
        utterance.onend = () => {
          if (!endedRef.current) setState("listening");
        };
        window.speechSynthesis.speak(utterance);
      }
    },
    onError: () => {
      if (endedRef.current) return;
      setReply("StatBridge could not complete a checked answer just now. Please try again or switch to typing.");
      setState("speaking");
    },
  });

  const meter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (endedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return true;
      }
      streamRef.current = stream;
      const Ctx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new Ctx();
      contextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          const v = (buffer[i]! - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(sum / buffer.length) * 3.2));
        frameRef.current = requestAnimationFrame(tick);
      };
      tick();
      return true;
    } catch {
      return false;
    }
  }, []);

  const listen = useCallback(() => {
    const recognition = getRecognition();
    if (!recognition) {
      setState("unavailable");
      return;
    }
    recognitionRef.current = recognition;
    recognition.lang = "en-ZA";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = Array.from({ length: event.results.length }, (_, i) => event.results[i]?.[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (!text || endedRef.current) return;
      setHeard(text);
      setState("checking");
      ask.mutate(text);
    };
    recognition.onerror = () => undefined;
    recognition.onend = () => {
      if (endedRef.current) return;
      setState((current) => (current === "listening" ? "listening" : current));
    };
    try {
      recognition.start();
      setState("listening");
    } catch {
      /* already running */
    }
  }, [ask]);

  const startCall = useCallback(() => {
    endedRef.current = false;
    setHeard("");
    setReply("");
    setElapsed(0);
    setState("connecting");
    timerRef.current = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    void meter().then((granted) => {
      if (endedRef.current) return;
      if (!granted) {
        setState("unavailable");
        return;
      }
      listen();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meter, listen]);

  const endCall = useCallback(() => {
    endedRef.current = true;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    teardown();
    setState("ended");
  }, [teardown]);

  useEffect(() => {
    startCall();
    return () => {
      endedRef.current = true;
      recognitionRef.current?.stop();
      teardown();
    };
    // run once on entry — the call was requested by the click that opened this screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // resume listening after a spoken reply when speech synthesis is unavailable
  useEffect(() => {
    if (state !== "listening" || endedRef.current) return;
    if (recognitionRef.current) return;
    listen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const portraitState: AssistantState =
    state === "connecting" ? "connecting"
      : state === "listening" ? "listening"
      : state === "checking" ? "checking"
      : state === "speaking" ? "speaking"
      : "ended";

  const live = state === "listening" || state === "speaking" || state === "checking";

  return (
    <div className="relative flex h-full flex-col items-center justify-center px-5 py-8 text-center">
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <AssistantPortrait state={portraitState} level={level} size="large" />

        <p className="mt-6 font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
          {STATE_LABEL[state]}
        </p>

        {live && (
          <div className="mt-4 flex items-center gap-3">
            <AudioVisualizer level={level} bars={28} tone="official" className="h-8 w-56" />
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{formatElapsed(elapsed)}</span>
          </div>
        )}

        {heard && (
          <p className="mt-6 max-w-xl text-sm text-muted-foreground">
            <span className="eyebrow mr-2 text-official">Heard</span>
            {heard}
          </p>
        )}
        {reply && (
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-foreground">{reply}</p>
        )}

        {state === "unavailable" && (
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            The microphone is not available here. You can still ask in writing.
          </p>
        )}
      </motion.div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        {state !== "ended" && state !== "unavailable" && (
          <button
            type="button"
            onClick={endCall}
            className="inline-flex items-center gap-2 rounded-full border border-destructive/55 bg-destructive/10 px-5 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
          >
            <PhoneOff aria-hidden className="size-4" />
            End call
          </button>
        )}
        {(state === "ended" || state === "unavailable") && state !== "unavailable" && (
          <button
            type="button"
            onClick={startCall}
            className="inline-flex items-center gap-2 rounded-full bg-official px-5 py-2.5 text-sm font-semibold text-official-foreground transition-opacity hover:opacity-90"
          >
            <RotateCcw aria-hidden className="size-4" />
            Talk again
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            endCall();
            onTypeInstead(heard || undefined);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-input bg-surface/70 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-official/50"
        >
          <Keyboard aria-hidden className="size-4" />
          Type instead
        </button>
      </div>

      {state === "ended" && (
        <Link to="/desk" className="mt-6 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Enter the desk
        </Link>
      )}

      <p className="mt-8 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Mic aria-hidden className="size-3" />
        Voice answers use approved Stats SA material. Media and sensitive requests always go to a person.
      </p>

      <Link
        to="/"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:inline-flex focus:items-center focus:gap-2"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back
      </Link>
    </div>
  );
}
