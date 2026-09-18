/**
 * Live voice call with Naledi.
 *
 * The call is a real-time two-way conversation: she greets, listens, speaks and
 * can be interrupted. She cannot state a figure of her own — every statistic
 * comes back from the approved-source pipeline through a server tool, so the
 * evidence rule holds on the line exactly as it does in writing.
 */
import { useConversation } from "@elevenlabs/react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Keyboard, Mic, PhoneOff, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import { AudioVisualizer, formatElapsed } from "@/components/statbridge/AudioVisualizer";
import { AssistantPortrait, type AssistantState } from "@/components/statbridge/assistant-portrait";
import { readBrowserToken, useVisitorSession } from "@/lib/statbridge/useVisitor";

type CallState = "connecting" | "live" | "ended" | "unavailable";

const STATE_LABEL: Record<CallState, string> = {
  connecting: "Calling…",
  live: "Connected",
  ended: "Call ended",
  unavailable: "Voice is not available here",
};

type Spoken = { who: "you" | "naledi"; text: string };

export function VoiceCall({ onTypeInstead }: { onTypeInstead: (draft?: string) => void }) {
  const reduce = useReducedMotion();
  const { session } = useVisitorSession("voice");
  const [state, setState] = useState<CallState>("connecting");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [turns, setTurns] = useState<Spoken[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const conversation = useConversation({
    onConnect: () => setState("live"),
    onDisconnect: () => setState((current) => (current === "unavailable" ? current : "ended")),
    onError: () => {
      setProblem("The voice line could not be opened. You can still ask in writing.");
      setState("unavailable");
    },
    onMessage: (message: unknown) => {
      const payload = message as { source?: string; message?: string };
      const text = (payload.message ?? "").trim();
      if (!text) return;
      setTurns((existing) =>
        [...existing, { who: payload.source === "user" ? ("you" as const) : ("naledi" as const), text }].slice(-6),
      );
    },
  });

  const status = conversation.status;
  const isSpeaking = conversation.isSpeaking;

  const startCall = useCallback(async () => {
    setProblem(null);
    setTurns([]);
    setElapsed(0);
    setState("connecting");

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setProblem("The microphone is not available. You can still ask in writing.");
      setState("unavailable");
      return;
    }

    try {
      const response = await fetch("/api/voice/token");
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { token?: string | null };
      if (!body.token) throw new Error("no token");

      await conversation.startSession({
        conversationToken: body.token,
        connectionType: "webrtc",
        dynamicVariables: {
          conversation_id: session?.conversationId ?? "",
          browser_token: readBrowserToken(),
          known_name: session?.knownName ?? "",
        },
      });
    } catch {
      setProblem("The voice line is not available just now. You can still ask in writing.");
      setState("unavailable");
    }
  }, [conversation, session?.conversationId, session?.knownName]);

  const endCall = useCallback(() => {
    void Promise.resolve(conversation.endSession()).catch(() => undefined);
    setState("ended");
  }, [conversation]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startCall();
    return () => {
      void Promise.resolve(conversation.endSession()).catch(() => undefined);
    };
    // the call was requested by the click that opened this screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // call timer
  useEffect(() => {
    if (state !== "live") {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [state]);

  // live audio level for the portrait and visualiser
  useEffect(() => {
    if (state !== "live") {
      setLevel(0);
      return;
    }
    const tick = () => {
      const value = isSpeaking ? conversation.getOutputVolume() : conversation.getInputVolume();
      setLevel(Math.min(1, (typeof value === "number" ? value : 0) * 2.4));
      frameRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [state, isSpeaking, conversation]);

  const portraitState: AssistantState =
    state === "connecting" || status === "connecting"
      ? "connecting"
      : state === "live"
        ? isSpeaking
          ? "speaking"
          : "listening"
        : "ended";

  const lastHeard = [...turns].reverse().find((turn) => turn.who === "you")?.text ?? "";
  const lastSaid = [...turns].reverse().find((turn) => turn.who === "naledi")?.text ?? "";

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
          {state === "live" ? (isSpeaking ? "Speaking" : "Listening…") : STATE_LABEL[state]}
        </p>

        {state === "live" && (
          <div className="mt-4 flex items-center gap-3">
            <AudioVisualizer level={level} bars={28} tone="official" className="h-8 w-56" />
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{formatElapsed(elapsed)}</span>
          </div>
        )}

        {lastHeard && (
          <p className="mt-6 max-w-xl text-sm text-muted-foreground">
            <span className="eyebrow mr-2 text-official">Heard</span>
            {lastHeard}
          </p>
        )}
        {lastSaid && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-foreground">{lastSaid}</p>}

        {problem && <p className="mt-4 max-w-md text-sm text-muted-foreground">{problem}</p>}
      </motion.div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        {state === "live" || state === "connecting" ? (
          <button
            type="button"
            onClick={endCall}
            className="inline-flex items-center gap-2 rounded-full border border-destructive/55 bg-destructive/10 px-5 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
          >
            <PhoneOff aria-hidden className="size-4" />
            End call
          </button>
        ) : null}

        {state === "ended" && (
          <button
            type="button"
            onClick={() => void startCall()}
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
            onTypeInstead(lastHeard || undefined);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-input bg-surface/70 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-official/50"
        >
          <Keyboard aria-hidden className="size-4" />
          Type instead
        </button>
      </div>

      {state === "ended" && (
        <Link
          to="/desk"
          className="mt-6 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Enter the desk
        </Link>
      )}

      <p className="mt-8 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Mic aria-hidden className="size-3" />
        Spoken answers come from approved Stats SA publications. Media and sensitive requests always go to a person.
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
