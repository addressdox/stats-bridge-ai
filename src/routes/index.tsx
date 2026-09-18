/** Two full-viewport doors: ask the assistant or enter the service desk. */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { AssistantPortrait } from "@/components/statbridge/assistant-portrait";
import { ThemeToggle } from "@/components/statbridge/ThemeToggle";

const deskLinks = [
  { label: "Media desk", hint: "Journalists with a deadline" },
  { label: "Track a request", hint: "Reference and private token" },
  { label: "Developers", hint: "Widget and public API" },
  { label: "Staff sign in", hint: "Review and knowledge base" },
];

const title = "Naledi by AddressDox — Ask about South Africa's official statistics";
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

function EntryGate() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();

  return (
    <main className="relative min-h-svh overflow-hidden bg-background">
      <div className="absolute right-4 top-4 z-50"><ThemeToggle /></div>
      <div className="flex min-h-svh flex-col md:flex-row">
        <motion.button
          type="button"
          aria-label="Start asking Naledi"
          onClick={() => navigate({ to: "/ask" })}
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={reduce ? {} : { scale: 1.02 }}
          whileTap={reduce ? {} : { scale: 0.98 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="entry-door entry-door-assistant group relative flex min-h-[50svh] flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden px-6 py-12 text-center md:min-h-svh"
        >
          <span aria-hidden className="entry-door-glow entry-door-glow-gold" />
          <AssistantPortrait interactive showMic size="small" />
          <h1 className="relative mt-7 text-3xl font-semibold sm:text-4xl">Ask Naledi</h1>
          <p className="relative mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            Official statistics, answered from approved Stats SA publications — with the source, the
            page and the period shown every time. No sign-up. Typing or push-to-talk.
          </p>
        </motion.button>

        <div className="mx-20 h-px bg-hairline md:my-20 md:mx-0 md:h-auto md:w-px" />

        <motion.button
          type="button"
          aria-label="Enter Naledi services"
          onClick={() => navigate({ to: "/desk" })}
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={reduce ? {} : { scale: 1.02 }}
          whileTap={reduce ? {} : { scale: 0.98 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="entry-door group relative flex min-h-[50svh] flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden px-6 py-12 text-center md:min-h-svh"
        >
          <span aria-hidden className="entry-door-glow entry-door-glow-neutral" />
          <h2 className="relative flex items-center gap-3 text-3xl font-semibold sm:text-4xl">
            Enter the desk
            <ArrowRight aria-hidden className="size-7 text-official transition-transform duration-500 group-hover:translate-x-2" />
          </h2>
          <p className="relative mt-2 text-sm text-muted-foreground sm:text-base">Media, tracking and tools</p>

          <ul className="relative mt-8 grid w-full max-w-sm gap-3 text-left sm:max-w-md">
            {deskLinks.map((link) => (
              <li
                key={link.label}
                className="entry-door-link flex items-baseline gap-3 rounded-md border border-hairline px-4 py-3"
              >
                <span className="text-sm font-medium sm:text-base">{link.label}</span>
                <span className="text-xs text-muted-foreground sm:text-sm">{link.hint}</span>
              </li>
            ))}
          </ul>
        </motion.button>

        <p className="relative px-6 pb-6 text-center text-xs text-muted-foreground md:absolute md:bottom-4 md:left-0 md:right-0 md:pb-0">
          Naledi by AddressDox. Demonstration build. Content shown here is loaded for demonstration and is not an official
          Statistics South Africa endorsement.
        </p>
      </div>
    </main>
  );
}
