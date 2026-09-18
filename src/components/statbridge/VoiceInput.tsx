/**
 * Optional push-to-talk input.
 *
 * The microphone never starts on its own. While it is open the recording
 * state is visible and the live level is metered. What was heard is placed
 * in the question box for correction — names, dates and figures are often
 * misheard — and only the corrected text is ever sent through Ask.
 * The control hides itself when the browser cannot support it.
 */
import { Mic, MicOff, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AudioVisualizer, formatElapsed } from "@/components/statbridge/AudioVisualizer";

export type VoiceStatus = "ready" | "requesting" | "listening" | "ended" | "denied" | "error";

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

export function VoiceInput({
  onTranscript,
  onStatusChange,
  onLevel,
  language = "en-ZA",
  prominent = false,
}: {
  onTranscript: (text: string) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  onLevel?: (level: number) => void;
  language?: string;
  prominent?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [denied, setDenied] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const teardown = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void contextRef.current?.close().catch(() => undefined);
    contextRef.current = null;
    setLevel(0);
    setElapsed(0);
    onLevel?.(0);
  }, [onLevel]);

  useEffect(() => {
    setSupported(getRecognition() !== null);
    return () => {
      recognitionRef.current?.stop();
      teardown();
    };
  }, [teardown]);

  if (!supported) {
    return prominent ? <span className="text-xs text-muted-foreground">Voice input is unavailable. You can type below.</span> : null;
  }

  async function meter() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        const rms = Math.sqrt(sum / buffer.length);
        const next = Math.min(1, rms * 3.2);
        setLevel(next);
        onLevel?.(next);
        frameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setDenied(true);
      onStatusChange?.("denied");
    }
  }

  function start() {
    const recognition = getRecognition();
    if (!recognition) return;
    setDenied(false);
    onStatusChange?.("requesting");
    recognitionRef.current = recognition;
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = Array.from({ length: event.results.length }, (_, i) => event.results[i]?.[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onTranscript(text);
    };
    recognition.onerror = () => {
      setRecording(false);
      onStatusChange?.("error");
      teardown();
    };
    recognition.onend = () => {
      setRecording(false);
      onStatusChange?.("ended");
      teardown();
    };
    recognition.start();
    setRecording(true);
    onStatusChange?.("listening");
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    void meter();
  }

  function stop() {
    recognitionRef.current?.stop();
    setRecording(false);
    onStatusChange?.("ended");
    teardown();
  }

  return (
    <div className={`flex min-w-0 items-center gap-3 ${prominent ? "flex-col" : ""}`}>
      <button
        type="button"
        onClick={recording ? stop : start}
        aria-pressed={recording}
        className={`inline-flex shrink-0 items-center gap-2 rounded-full border font-semibold transition-all ${prominent ? "px-6 py-3 text-sm" : "px-3 py-1.5 text-xs"} ${
          recording
            ? "border-destructive/60 bg-destructive/10 text-destructive"
            : "border-official/55 bg-official/10 text-official hover:bg-official/20"
        }`}
      >
        {recording ? <Square aria-hidden className="size-3" /> : <Mic aria-hidden className="size-3.5" />}
        {recording ? "End voice" : "Start voice"}
      </button>

      {recording && (
        <>
          <AudioVisualizer level={level} bars={14} tone="official" className="h-5 w-24" />
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{formatElapsed(elapsed)}</span>
          <span className="sr-only" role="status">
            Recording. What is heard will appear in the question box for you to correct before sending.
          </span>
        </>
      )}

      {denied && !recording && (
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MicOff aria-hidden className="size-3" />
          The microphone is not available. Type your question instead.
        </span>
      )}
    </div>
  );
}
