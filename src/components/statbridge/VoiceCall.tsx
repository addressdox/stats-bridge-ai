/**
 * Live voice call with Kaya.
 *
 * The call is a real-time two-way conversation: she greets, listens, speaks and
 * can be interrupted. She cannot state a figure of her own — every statistic
 * comes back from the approved-source pipeline through a server tool, so the
 * evidence rule holds on the line exactly as it does in writing.
 */
import { useLiveVoiceConversation } from "@/lib/statbridge/useLiveVoiceConversation";
import type { LiveVoiceCredentials } from "@/lib/statbridge/live-voice-client";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Mic, PhoneOff, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import { AudioVisualizer, formatElapsed } from "@/components/statbridge/AudioVisualizer";
import { AssistantPortrait, type AssistantState } from "@/components/statbridge/assistant-portrait";
import { useVisitorSession } from "@/lib/statbridge/useVisitor";
import { EvidenceCanvas } from "./EvidenceCanvas";
import { getVoiceEvidence } from "@/lib/statbridge/voice.functions";
import type { PublicAnswer } from "@/lib/statbridge/contract";

type CallState = "connecting" | "live" | "ended" | "unavailable";

const STATE_LABEL: Record<CallState, string> = {
  connecting: "Calling…",
  live: "Connected",
  ended: "Call ended",
  unavailable: "Voice is not available here",
};

type Spoken = { who: "you" | "kaya"; text: string; id: string };

export function VoiceCall() {
  return <VoiceCallRoom />;
}

function VoiceCallRoom() {
  const reduce = useReducedMotion();
  const { session } = useVisitorSession("voice");
  const [state, setState] = useState<CallState>("connecting");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [turns, setTurns] = useState<Spoken[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [answer, setAnswer] = useState<PublicAnswer | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(true);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const evidenceRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const requestedRef = useRef(true);
  const attemptRef = useRef(0);
  const tokenRequestRef = useRef<AbortController | null>(null);
  const openingRef = useRef<Promise<void> | null>(null);
  const closingRef = useRef<Promise<void>>(Promise.resolve());
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const conversation = useLiveVoiceConversation({
    onConnect: () => {
      if (mountedRef.current && requestedRef.current) setState("live");
      else void Promise.resolve(conversationRef.current.endSession()).catch(() => undefined);
    },
    onDisconnect: () => {
      if (mountedRef.current)
        setState((current) => (current === "unavailable" ? current : "ended"));
    },
    onError: (message) => {
      if (!mountedRef.current || !requestedRef.current) return;
      setProblem(message || "The voice line could not be opened. Please try again.");
      setState("unavailable");
    },
    onMessage: (payload) => {
      if (!mountedRef.current || !requestedRef.current) return;
      const text = (payload.message ?? "").trim();
      if (!text) return;
      setTurns((existing) => {
        const next: Spoken = {
          id: payload.id,
          who: payload.source === "user" ? "you" : "kaya",
          text,
        };
        return existing.some((turn) => turn.id === payload.id)
          ? existing.map((turn) => (turn.id === payload.id ? next : turn))
          : [...existing, next].slice(-6);
      });
    },
  });

  const status = conversation.status;
  const isSpeaking = conversation.isSpeaking;
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  const closeSession = useCallback(() => {
    const closing = Promise.resolve()
      .then(() => conversationRef.current.endSession())
      .catch(() => undefined);
    closingRef.current = closing;
    return closing;
  }, []);

  useEffect(() => {
    if (state !== "live" || !session) return;
    let cancelled = false;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const checked = await getVoiceEvidence({
          data: { conversationId: session.conversationId, browserToken: session.browserToken },
        });
        if (!cancelled && checked && evidenceRef.current !== checked.answerRef) {
          evidenceRef.current = checked.answerRef;
          setAnswer(checked);
          setCanvasOpen(true);
        }
        if (!cancelled && !checked && evidenceRef.current) {
          evidenceRef.current = null;
          setAnswer(null);
        }
      } catch {
        /* The audio line can continue while an evidence refresh retries. */
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 1800);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state, session]);

  const startCall = useCallback(async () => {
    const attempt = ++attemptRef.current;
    tokenRequestRef.current?.abort();
    requestedRef.current = true;
    setProblem(null);
    setTurns([]);
    setAnswer(null);
    evidenceRef.current = null;
    setElapsed(0);
    setState("connecting");

    const previousOpening = openingRef.current;
    const current = () =>
      mountedRef.current && requestedRef.current && attemptRef.current === attempt;
    const opening = (async () => {
      // A retry waits for the previous opening/closing call so its cleanup cannot end the new call.
      await previousOpening;
      await closingRef.current;
      if (!current()) return;
      const visitor = sessionRef.current;
      if (!visitor?.conversationId || !visitor.browserToken) {
        setProblem("The voice session is not ready yet. Please try again.");
        setState("unavailable");
        return;
      }
      try {
        const permission = await navigator.mediaDevices.getUserMedia({ audio: true });
        permission.getTracks().forEach((track) => track.stop());
      } catch {
        if (!current()) return;
        setProblem("The microphone is not available. Check microphone permission and try again.");
        setState("unavailable");
        return;
      }
      if (!current()) return;
      const controller = new AbortController();
      tokenRequestRef.current = controller;
      try {
        const response = await fetch("/api/voice/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: visitor.conversationId,
            browserToken: visitor.browserToken,
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as LiveVoiceCredentials;
        if (!body.token || !body.model) throw new Error("no voice token");
        if (!current()) return;
        await conversationRef.current.startSession({
          token: body.token,
          model: body.model,
          config: body.config,
          conversationId: visitor.conversationId,
          browserToken: visitor.browserToken,
        });
        if (!current()) await closeSession();
      } catch {
        if (!current()) return;
        setProblem("The voice line is not available just now. Please try again.");
        setState("unavailable");
      }
    })();
    openingRef.current = opening;
    await opening;
    if (openingRef.current === opening) openingRef.current = null;
  }, [closeSession]);

  const endCall = useCallback(() => {
    startedRef.current = true;
    requestedRef.current = false;
    attemptRef.current += 1;
    tokenRequestRef.current?.abort();
    void closeSession();
    setState("ended");
  }, [closeSession]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestedRef.current = false;
      startedRef.current = false;
      attemptRef.current += 1;
      tokenRequestRef.current?.abort();
      void closeSession();
    };
  }, [closeSession]);

  useEffect(() => {
    if (startedRef.current) return;
    // Every spoken tool needs a genuine conversation, never an unowned placeholder.
    if (!session) {
      const waited = setTimeout(() => {
        if (startedRef.current || !mountedRef.current) return;
        setProblem("The voice session is not ready yet. Please try again.");
        setState("unavailable");
      }, 8000);
      return () => clearTimeout(waited);
    }
    startedRef.current = true;
    void startCall();
    return undefined;
  }, [session, startCall]);

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
  const speakingRef = useRef(isSpeaking);
  speakingRef.current = isSpeaking;

  useEffect(() => {
    if (state !== "live") {
      setLevel(0);
      return;
    }
    const meter = setInterval(() => {
      const live = conversationRef.current;
      const value = speakingRef.current ? live.getOutputVolume() : live.getInputVolume();
      setLevel(Math.min(1, (typeof value === "number" ? value : 0) * 2.4));
    }, 80);
    return () => clearInterval(meter);
  }, [state]);

  const portraitState: AssistantState =
    state === "connecting" || status === "connecting"
      ? "connecting"
      : state === "live"
        ? isSpeaking
          ? "speaking"
          : "listening"
        : "ended";

  const lastHeard = [...turns].reverse().find((turn) => turn.who === "you")?.text ?? "";
  const lastSaid = [...turns].reverse().find((turn) => turn.who === "kaya")?.text ?? "";

  return (
    <div
      className={
        answer && canvasOpen
          ? "grid h-full overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(22rem,27rem)]"
          : "h-full overflow-y-auto"
      }
    >
      <div className="relative flex h-full flex-col items-center justify-center px-5 py-8 text-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <AssistantPortrait state={portraitState} level={level} size="large" />

          <p
            role="status"
            className="mt-6 font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground"
          >
            {state === "live" ? (isSpeaking ? "Speaking" : "Listening…") : STATE_LABEL[state]}
          </p>

          {state === "live" && (
            <div className="mt-4 flex items-center gap-3">
              <AudioVisualizer level={level} bars={28} tone="official" className="h-8 w-56" />
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatElapsed(elapsed)}
              </span>
            </div>
          )}

          {lastHeard && (
            <p className="mt-6 max-w-xl text-sm text-muted-foreground">
              <span className="eyebrow mr-2 text-official">Heard</span>
              {lastHeard}
            </p>
          )}
          {lastSaid && (
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-foreground">{lastSaid}</p>
          )}

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

          {(state === "ended" || state === "unavailable") && (
            <button
              type="button"
              onClick={() => void startCall()}
              className="inline-flex items-center gap-2 rounded-full bg-official px-5 py-2.5 text-sm font-semibold text-official-foreground transition-opacity hover:opacity-90"
            >
              <RotateCcw aria-hidden className="size-4" />
              {state === "ended" ? "Talk again" : "Try again"}
            </button>
          )}
        </div>
        {answer && !canvasOpen && (
          <button
            type="button"
            onClick={() => setCanvasOpen(true)}
            className="mt-3 text-xs text-official underline underline-offset-4"
          >
            Show official evidence
          </button>
        )}

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
          Spoken answers come from approved Stats SA publications. Media and sensitive requests
          always go to a person.
        </p>

        <Link
          to="/"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:inline-flex focus:items-center focus:gap-2"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Link>
      </div>
      {answer && (
        <EvidenceCanvas answer={answer} open={canvasOpen} onClose={() => setCanvasOpen(false)} />
      )}
    </div>
  );
}
