/**
 * A bar meter driven by a live audio level. It shows only what the
 * microphone or the playback is actually doing — it never animates on its
 * own, so a flat meter honestly means silence.
 */
import { useReducedMotion } from "motion/react";

export function AudioVisualizer({
  level,
  bars = 18,
  className = "",
  tone = "accent",
}: {
  /** 0 to 1. */
  level: number;
  bars?: number;
  className?: string;
  tone?: "accent" | "official";
}) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, level));
  const colour = tone === "official" ? "var(--color-official)" : "var(--color-accent)";

  return (
    <div className={`flex items-end gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: bars }, (_, i) => {
        // Centre bars react most, edges least — a simple bell shape.
        const distance = Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
        const weight = 1 - distance * 0.72;
        const height = 12 + clamped * weight * 88;
        return (
          <span
            key={i}
            className="w-[3px] rounded-full"
            style={{
              height: `${Math.max(8, height)}%`,
              backgroundColor: colour,
              opacity: 0.35 + clamped * weight * 0.65,
              transition: reduce ? "none" : "height 90ms linear, opacity 90ms linear",
            }}
          />
        );
      })}
    </div>
  );
}

export function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
