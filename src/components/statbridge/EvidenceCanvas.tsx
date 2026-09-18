/**
 * The Evidence Canvas.
 *
 * On a wide screen it is a glass column beside the conversation. On a phone
 * it rises as a bottom sheet that stops well short of the top, so the
 * transcript stays visible and the keyboard is never covered. It can be
 * closed, reopened and expanded; closing it never loses the conversation.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Maximize2, Minimize2, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

import { RenderBlock } from "@/components/statbridge/RenderBlock";
import type { PublicAnswer } from "@/lib/statbridge/contract";

export function EvidenceCanvas({
  answer,
  open,
  onClose,
}: {
  answer: PublicAnswer;
  open: boolean;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const reduce = useReducedMotion();

  const header = (
    <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
      <p className="flex min-w-0 items-center gap-2 eyebrow text-official">
        <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">Official evidence</span>
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:inline-flex"
        >
          {expanded ? <Minimize2 aria-hidden className="size-4" /> : <Maximize2 aria-hidden className="size-4" />}
          <span className="sr-only">{expanded ? "Shrink the evidence canvas" : "Expand the evidence canvas"}</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X aria-hidden className="size-4 lg:block" />
          <span className="sr-only">Close the evidence canvas</span>
        </button>
      </div>
    </div>
  );

  const body = (
    <div className="space-y-3 overflow-y-auto overscroll-contain p-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Everything below is taken from an approved Stats SA document. The figures are inserted by StatBridge from
        verified records, not written by the model.
      </p>
      {answer.officialBlocks.map((block, i) => (
        <motion.div
          key={i}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : i * 0.05, duration: 0.3, ease: "easeOut" }}
        >
          <RenderBlock block={block} />
        </motion.div>
      ))}
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Wide screens: a glass column that shares the stage. */}
          <motion.aside
            key="canvas-desktop"
            aria-label="Evidence"
            initial={reduce ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className={`hidden lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100vh-3rem)] lg:flex-col lg:self-start lg:overflow-hidden glass-panel ${
              expanded ? "lg:w-[34rem]" : ""
            }`}
          >
            {header}
            {body}
          </motion.aside>

          {/* Phones: a sheet that rises but never covers the transcript. */}
          <motion.aside
            key="canvas-mobile"
            aria-label="Evidence"
            initial={reduce ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-40 flex max-h-[58svh] flex-col glass-panel rounded-b-none lg:hidden"
          >
            <button
              type="button"
              onClick={onClose}
              className="mx-auto mt-2 flex items-center gap-1 rounded-full px-3 py-1 text-[11px] text-muted-foreground"
            >
              <ChevronDown aria-hidden className="size-3.5" />
              Hide evidence
            </button>
            {header}
            {body}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
