/**
 * The entry gate. Two doors, full bleed, nothing else: ask the assistant,
 * or go to the desk (media, tracking, developers, staff).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { AssistantMark } from "@/components/statbridge/AssistantMark";

const title = "StatBridge — Ask about South Africa's official statistics";
const description =
  "Ask questions about published Statistics South Africa figures, definitions and publications. Every answer quotes approved sources; media and sensitive requests go to a communications official.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EntryGate,
});

const DESK = [
  { to: "/media", label: "Media desk", note: "Journalists with a deadline" },
  { to: "/case", label: "Track a request", note: "Reference and private token" },
  { to: "/developers", label: "Developers", note: "Widget and public API" },
  { to: "/staff/sign-in", label: "Staff sign in", note: "Review and knowledge base" },
] as const;

function EntryGate() {
  const reduce = useReducedMotion();

  return (
    <main className="relative min-h-svh stage-glow">
      <div className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
        {/* Door one: the assistant */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center justify-center gap-6 px-6 py-20 text-center lg:border-r lg:border-hairline"
        >
          <Link to="/ask" aria-label="Ask StatBridge" className="group rounded-full">
            <div className="transition-transform duration-300 group-hover:scale-[1.04]">
              <AssistantMark size={168} />
            </div>
          </Link>
          <div>
            <h1 className="text-4xl font-bold uppercase tracking-tight sm:text-5xl">Ask StatBridge</h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Official statistics, answered from approved Stats SA publications — with the source, the page and the
              period shown every time.
            </p>
          </div>
          <Link
            to="/ask"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--glow-teal)] transition-transform hover:scale-[1.03]"
          >
            Start asking
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden className="size-3.5 text-official" />
            No sign-up. Typing or push-to-talk.
          </p>
        </motion.section>

        {/* Door two: the desk */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
          className="flex flex-col justify-center gap-6 border-t border-hairline bg-surface/30 px-6 py-20 lg:border-t-0"
        >
          <div className="mx-auto w-full max-w-sm">
            <p className="eyebrow text-official">Enter the desk</p>
            <h2 className="mt-2 text-3xl font-bold uppercase tracking-tight">Media, tracking and tools</h2>
            <ul className="mt-6 space-y-2">
              {DESK.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-hairline bg-surface/60 px-4 py-3.5 transition-colors hover:border-accent/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.note}</span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                    />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
              Demonstration build. Content shown here is loaded for demonstration and is not an official Statistics
              South Africa endorsement.
            </p>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
