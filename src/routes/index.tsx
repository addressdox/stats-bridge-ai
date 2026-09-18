@@
-import { createFileRoute, Link } from "@tanstack/react-router";
+import { createFileRoute, useNavigate } from "@tanstack/react-router";
 import { motion, useReducedMotion } from "motion/react";
-import { ArrowRight, ShieldCheck } from "lucide-react";
+import { ArrowRight } from "lucide-react";
 
-import { AssistantMark } from "@/components/statbridge/AssistantMark";
+import { AssistantPortrait } from "@/components/statbridge/assistant-portrait";
 import { ThemeToggle } from "@/components/statbridge/ThemeToggle";
@@
-const DESK = [
-  { to: "/media", label: "Media desk", note: "Journalists with a deadline" },
-  { to: "/case", label: "Track a request", note: "Reference and private token" },
-  { to: "/developers", label: "Developers", note: "Widget and public API" },
-  { to: "/staff/sign-in", label: "Staff sign in", note: "Review and knowledge base" },
-] as const;
-
 function EntryGate() {
   const reduce = useReducedMotion();
+  const navigate = useNavigate();
 
   return (
-    <main className="relative min-h-svh stage-glow">
+    <main className="relative min-h-svh overflow-hidden bg-background">
       <div className="absolute right-4 top-4 z-50">
         <ThemeToggle />
       </div>
-      <div className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
-        {/* Door one: the assistant */}
-        <motion.section
+      <div className="flex min-h-svh flex-col md:flex-row">
+        <motion.button
+          type="button"
+          aria-label="Start asking StatBridge"
+          onClick={() => navigate({ to: "/ask" })}
           initial={reduce ? false : { opacity: 0, y: 18 }}
           animate={{ opacity: 1, y: 0 }}
-          transition={{ duration: 0.5, ease: "easeOut" }}
-          className="flex flex-col items-center justify-center gap-6 px-6 py-20 text-center lg:border-r lg:border-hairline"
+          whileHover={reduce ? {} : { scale: 1.02 }}
+          whileTap={reduce ? {} : { scale: 0.98 }}
+          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
+          className="entry-door entry-door-assistant group relative flex min-h-[50svh] flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden px-6 py-12 text-center md:min-h-svh"
         >
-          <Link to="/ask" aria-label="Ask StatBridge" className="group rounded-full">
-            <div className="transition-transform duration-300 group-hover:scale-[1.04]">
-              <AssistantMark size={168} />
-            </div>
-          </Link>
+          <span aria-hidden className="entry-door-glow entry-door-glow-gold" />
+          <AssistantPortrait interactive showMic size="small" />
           <div>
-            <h1 className="text-4xl font-bold uppercase tracking-tight sm:text-5xl">Ask StatBridge</h1>
-            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
-              Official statistics, answered from approved Stats SA publications — with the source, the page and the
-              period shown every time.
-            </p>
+            <h1 className="mt-7 text-3xl font-semibold sm:text-4xl">Ask StatBridge</h1>
+            <p className="mt-2 text-sm text-muted-foreground sm:text-base">Your official statistics assistant</p>
           </div>
-          <Link
-            to="/ask"
-            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--glow-teal)] transition-transform hover:scale-[1.03]"
-          >
-            Start asking
-            <ArrowRight aria-hidden className="size-4" />
-          </Link>
-          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
-            <ShieldCheck aria-hidden className="size-3.5 text-official" />
-            No sign-up. Typing or push-to-talk.
-          </p>
-        </motion.section>
+        </motion.button>
 
-        {/* Door two: the desk */}
-        <motion.section
+        <div className="mx-20 h-px bg-hairline md:my-20 md:mx-0 md:h-auto md:w-px" />
+
+        <motion.button
+          type="button"
+          aria-label="Enter StatBridge services"
+          onClick={() => navigate({ to: "/desk" })}
           initial={reduce ? false : { opacity: 0, y: 18 }}
           animate={{ opacity: 1, y: 0 }}
-          transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
-          className="flex flex-col justify-center gap-6 border-t border-hairline bg-surface/30 px-6 py-20 lg:border-t-0"
+          whileHover={reduce ? {} : { scale: 1.02 }}
+          whileTap={reduce ? {} : { scale: 0.98 }}
+          transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
+          className="entry-door group relative flex min-h-[50svh] flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden px-6 py-12 text-center md:min-h-svh"
         >
-          <div className="mx-auto w-full max-w-sm">
-            <p className="eyebrow text-official">Enter the desk</p>
-            <h2 className="mt-2 text-3xl font-bold uppercase tracking-tight">Media, tracking and tools</h2>
-            <ul className="mt-6 space-y-2">
-              {DESK.map((item) => (
-                <li key={item.to}>
-                  <Link
-                    to={item.to}
-                    className="group flex items-center justify-between gap-4 rounded-xl border border-hairline bg-surface/60 px-4 py-3.5 transition-colors hover:border-accent/50"
-                  >
-                    <span className="min-w-0">
-                      <span className="block truncate text-sm font-semibold text-foreground">{item.label}</span>
-                      <span className="block truncate text-xs text-muted-foreground">{item.note}</span>
-                    </span>
-                    <ArrowRight
-                      aria-hidden
-                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
-                    />
-                  </Link>
-                </li>
-              ))}
-            </ul>
-            <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
-              Demonstration build. Content shown here is loaded for demonstration and is not an official Statistics
-              South Africa endorsement.
-            </p>
-          </div>
-        </motion.section>
+          <span aria-hidden className="entry-door-glow entry-door-glow-neutral" />
+          <h2 className="relative flex items-center gap-3 text-3xl font-semibold sm:text-4xl">
+            Enter StatBridge
+            <ArrowRight aria-hidden className="size-7 text-official transition-transform duration-500 group-hover:translate-x-2" />
+          </h2>
+          <p className="relative mt-2 text-sm text-muted-foreground sm:text-base">Media, cases, tools and staff</p>
+        </motion.button>
       </div>
     </main>
   );
 }
/**
 * The entry gate. Two doors, full bleed, nothing else: ask the assistant,
 * or go to the desk (media, tracking, developers, staff).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { AssistantMark } from "@/components/statbridge/AssistantMark";
import { ThemeToggle } from "@/components/statbridge/ThemeToggle";

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
      <div className="absolute right-4 top-4 z-50">
        <ThemeToggle />
      </div>
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
