import { Mic } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import assistantPortrait from "@/assets/statbridge-assistant.jpg";
import { cn } from "@/lib/utils";

export type AssistantState = "ready" | "connecting" | "listening" | "checking" | "speaking" | "ended";

const STATE_LABELS: Record<AssistantState, string> = {
  ready: "Naledi assistant is ready",
  connecting: "Connecting to voice input",
  listening: "Listening",
  checking: "Preparing a reply",
  speaking: "Naledi is speaking",
  ended: "Voice session ended",
};

export function AssistantPortrait({
  state = "ready",
  level = 0,
  size = "large",
  showMic = false,
  interactive = false,
  className,
}: {
  state?: AssistantState;
  level?: number;
  size?: "small" | "large";
  showMic?: boolean;
  interactive?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const scale = window.devicePixelRatio || 1;
    const dimension = 360;
    canvas.width = dimension * scale;
    canvas.height = dimension * scale;
    context.scale(scale, scale);
    const computed = getComputedStyle(canvas);
    const gold = computed.getPropertyValue("--official").trim();
    const live = computed.getPropertyValue("--live").trim();
    const muted = computed.getPropertyValue("--muted-foreground").trim();
    const center = dimension / 2;
    const radius = 104;
    const clamped = Math.min(1, Math.max(0, level));
    let frame = 0;
    let phase = 0;

    const draw = () => {
      context.clearRect(0, 0, dimension, dimension);
      phase += reduce ? 0 : 0.025;
      const active = state === "listening" || state === "speaking";
      const tone = active ? live : state === "ended" ? muted : gold;

      for (let index = 0; index < 72; index += 1) {
        const angle = (index / 72) * Math.PI * 2 - Math.PI / 2;
        const scan = state === "connecting" || state === "checking" ? (Math.sin(angle - phase * 3) + 1) / 2 : 0;
        const reaction = active ? clamped * (0.5 + 0.5 * Math.sin(index * 1.73 + phase * 5)) : 0;
        const breathe = state === "ready" ? (Math.sin(phase * 1.5 + index * 0.12) + 1) * 0.04 : 0;
        const length = 3 + scan * 15 + reaction * 25 + breathe * 12;
        const start = radius + 13;
        context.beginPath();
        context.moveTo(center + Math.cos(angle) * start, center + Math.sin(angle) * start);
        context.lineTo(center + Math.cos(angle) * (start + length), center + Math.sin(angle) * (start + length));
        context.strokeStyle = tone;
        context.globalAlpha = state === "ended" ? 0.25 : 0.25 + scan * 0.55 + reaction * 0.6;
        context.lineWidth = 2.2;
        context.lineCap = "round";
        context.stroke();
      }
      context.globalAlpha = 1;
      if (!reduce) frame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frame);
  }, [level, reduce, state]);

  return (
    <motion.div
      aria-label={STATE_LABELS[state]}
      className={cn(
        "assistant-portrait relative grid shrink-0 place-items-center rounded-full",
        size === "large" ? "size-[19rem] max-h-[72vw] max-w-[72vw]" : "size-44",
        interactive && "assistant-portrait-interactive",
        state === "ended" && "assistant-portrait-ended",
        className,
      )}
      role="img"
      animate={reduce ? {} : state === "ready" ? { scale: [1, 1.018, 1] } : { scale: 1 }}
      transition={{ duration: 4, repeat: state === "ready" ? Infinity : 0, ease: "easeInOut" }}
    >
      <span aria-hidden className="assistant-ring assistant-ring-outer" />
      <span aria-hidden className="assistant-ring assistant-ring-middle" />
      <canvas aria-hidden className="absolute inset-0 size-full" ref={canvasRef} />
      <span className="assistant-image-shell relative z-10 size-[58%] overflow-hidden rounded-full">
        <img
          alt="Naledi assistant, a South African public information professional"
          className="size-full object-cover object-top transition-transform duration-700"
          height={1024}
          src={assistantPortrait}
          width={1024}
        />
      </span>
      {showMic && (
        <span aria-hidden className="assistant-mic absolute bottom-[20%] right-[19%] z-20 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform duration-300">
          <Mic className="size-5" />
        </span>
      )}
    </motion.div>
  );
}
