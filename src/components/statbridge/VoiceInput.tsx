/**
 * Optional push-to-talk input. The microphone never starts on its own, the
 * transcript is always shown for correction first, and the control hides
 * itself when the browser cannot support it.
 */
import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

export function VoiceInput({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getRecognition() !== null);
    return () => recognitionRef.current?.stop();
  }, []);

  if (!supported) return <span className="text-xs text-muted-foreground">Type your question</span>;

  function start() {
    const recognition = getRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    recognition.lang = "en-ZA";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = Array.from({ length: event.results.length }, (_, i) => event.results[i]?.[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onTranscript(text);
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
    recognition.start();
    setRecording(true);
  }

  function stop() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      aria-pressed={recording}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        recording
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "border-input text-muted-foreground hover:bg-secondary"
      }`}
    >
      {recording ? <Square aria-hidden className="size-3" /> : <Mic aria-hidden className="size-3.5" />}
      {recording ? "Recording — tap to stop" : "Speak"}
    </button>
  );
}
