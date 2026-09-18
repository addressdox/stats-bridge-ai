/**
 * The StatBridge presence: a ringed mark that breathes while idle, pulses
 * while listening and steadies while a checked answer is read back.
 * There is no avatar and no persona — it is a signal, not a person.
 */
import { motion, useReducedMotion } from "motion/react";
import { Mic } from "lucide-react";

type State = "idle" | "listening" | "thinking" | "speaking";

const RING_COPY: Record<State, string> = {
  idle: "StatBridge is ready",
  listening: "Listening",
  thinking: "Checking approved sources",
  speaking: "Reading the checked answer",
};

export function AssistantMark({
  state = "idle",
  size = 160,
  level = 0,
  showBadge = true,
}: {
  state?: State;
  size?: number;
  /** 0 to 1 audio level, used to swell the outer ring. */
  level?: number;
  showBadge?: boolean;
}) {
  const reduce = useReducedMotion();
  const swell = reduce ? 0 : Math.min(level, 1) * 0.16;
  const active = state === "listening" || state === "speaking";

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={RING_COPY[state]}
    >
      {/* Outer halo */}
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 26%, transparent) 0%, transparent 68%)",
        }}
        animate={reduce ? {} : { scale: active ? 1 + swell : [1, 1.06, 1], opacity: active ? 0.9 : [0.5, 0.75, 0.5] }}
        transition={{ duration: active ? 0.18 : 4.5, repeat: active ? 0 : Infinity, ease: "easeInOut" }}
      />

      {/* Rotating hairline ring */}
      <motion.span
        aria-hidden
        className="absolute rounded-full border border-dashed"
        style={{
          inset: size * 0.04,
          borderColor: "color-mix(in oklab, var(--color-official) 45%, transparent)",
        }}
        animate={reduce ? {} : { rotate: 360 }}
        transition={{ duration: 46, repeat: Infinity, ease: "linear" }}
      />

      {/* Solid ring */}
      <motion.span
        aria-hidden
        className="absolute rounded-full border-2"
        style={{
          inset: size * 0.12,
          borderColor: "color-mix(in oklab, var(--color-accent) 70%, transparent)",
          boxShadow: "var(--glow-teal)",
        }}
        animate={reduce ? {} : { scale: 1 + swell * 0.6 }}
        transition={{ type: "spring", stiffness: 240, damping: 20 }}
      />

      {/* Core */}
      <span
        className="relative grid place-items-center rounded-full bg-surface-2"
        style={{ width: size * 0.58, height: size * 0.58 }}
      >
        <svg
          viewBox="0 0 24 24"
          className="text-official"
          style={{ width: size * 0.28, height: size * 0.28 }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          aria-hidden
        >
          <path d="M4 18V11M9.5 18V6M15 18v-8.5M20.5 18v-5" strokeLinecap="round" />
        </svg>
        {state === "thinking" && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-transparent"
            style={{ borderTopColor: "var(--color-accent)" }}
            animate={reduce ? {} : { rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          />
        )}
      </span>

      {showBadge && (
        <span
          aria-hidden
          className="absolute grid place-items-center rounded-full bg-official text-background shadow-lg"
          style={{
            width: size * 0.22,
            height: size * 0.22,
            right: size * 0.11,
            bottom: size * 0.11,
          }}
        >
          <Mic style={{ width: size * 0.11, height: size * 0.11 }} />
        </span>
      )}
    </div>
  );
}
