/** Optional dictation. Audio is transcribed in its original language and remains editable before Ask. */
import { Mic, MicOff, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AudioVisualizer, formatElapsed } from "@/components/statbridge/AudioVisualizer";
import { useVoiceRecorder } from "@/lib/statbridge/useVoiceRecorder";

export type VoiceStatus = "ready" | "requesting" | "listening" | "ended" | "denied" | "error";

export function VoiceInput({
  onTranscript,
  onStatusChange,
  onLevel,
  language = "auto",
  prominent = false,
}: {
  onTranscript: (text: string, language?: string) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  onLevel?: (level: number) => void;
  language?: string;
  prominent?: boolean;
}) {
  const [processing, setProcessing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const recorder = useVoiceRecorder({
    onRecording: async (audio) => {
      const controller = new AbortController();
      request.current = controller;
      setProcessing(true);
      onStatusChange?.("requesting");
      try {
        const form = new FormData();
        form.set("audio", audio, "question.webm");
        form.set("language", language);
        const response = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          text?: string;
          language?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(body.error || "Voice transcription is unavailable.");
        if (body.text) {
          onTranscript(body.text, body.language);
          onStatusChange?.("ended");
        } else {
          setProblem("No clear speech was heard. Please try again or type your question.");
          onStatusChange?.("error");
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setProblem(
          error instanceof Error ? error.message : "Please try again or type your question.",
        );
        onStatusChange?.("error");
      } finally {
        if (!controller.signal.aborted) setProcessing(false);
      }
    },
    onError: (message) => {
      setProblem(message);
      onStatusChange?.("denied");
    },
  });
  useEffect(() => {
    onLevel?.(recorder.level);
  }, [recorder.level, onLevel]);
  useEffect(() => () => request.current?.abort(), []);
  return (
    <div className={`flex min-w-0 items-center gap-3 ${prominent ? "flex-col" : ""}`}>
      <button
        type="button"
        disabled={processing}
        onClick={() => {
          setProblem(null);
          if (recorder.recording) recorder.stop();
          else {
            onStatusChange?.("listening");
            void recorder.start();
          }
        }}
        aria-pressed={recorder.recording}
        className={`inline-flex shrink-0 items-center gap-2 rounded-full border font-semibold transition-all disabled:opacity-50 ${prominent ? "px-6 py-3 text-sm" : "px-3 py-1.5 text-xs"} ${recorder.recording ? "border-destructive/60 bg-destructive/10 text-destructive" : "border-official/55 bg-official/10 text-official hover:bg-official/20"}`}
      >
        {recorder.recording ? (
          <Square aria-hidden className="size-3" />
        ) : (
          <Mic aria-hidden className="size-3.5" />
        )}
        {processing ? "Transcribing…" : recorder.recording ? "End voice" : "Start voice"}
      </button>
      {recorder.recording && (
        <>
          <AudioVisualizer level={recorder.level} bars={14} tone="official" className="h-5 w-24" />
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatElapsed(recorder.elapsed)}
          </span>
          <span className="sr-only" role="status">
            Recording. Review the transcript before sending.
          </span>
        </>
      )}
      {problem && (
        <span role="status" className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MicOff aria-hidden className="size-3" />
          {problem}
        </span>
      )}
    </div>
  );
}
