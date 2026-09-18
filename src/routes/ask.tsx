@@
-import { X } from "lucide-react";
+import { ArrowLeft } from "lucide-react";
@@
 function AskRoom() {
   return (
-    <div className="relative min-h-svh stage-glow">
-      <header className="sticky top-0 z-40 border-b border-hairline bg-background/70 backdrop-blur">
-        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
-          <Link to="/" aria-label="StatBridge home" className="rounded-md">
-            <StatBridgeMark />
+    <div className="relative flex h-svh flex-col overflow-hidden bg-background">
+      <header className="relative z-40 flex h-16 shrink-0 items-center justify-between border-b border-hairline bg-background/80 px-5 backdrop-blur-md">
+          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
+            <ArrowLeft aria-hidden className="size-4" />
+            Back
           </Link>
-          <div className="flex items-center gap-1">
-            <Link
-              to="/media"
-              className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
-            >
-              Media desk
-            </Link>
-            <Link
-              to="/case"
-              className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
-            >
-              Track a request
-            </Link>
-            <ThemeToggle className="ml-1" />
-            <Link
-              to="/"
-              className="rounded-full border border-hairline p-2 text-muted-foreground transition-colors hover:text-foreground"
-              aria-label="Leave Ask"
-            >
-              <X aria-hidden className="size-4" />
-            </Link>
-          </div>
-        </div>
+          <StatBridgeMark />
+          <ThemeToggle />
       </header>
 
-      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-12">
+      <main className="min-h-0 flex-1">
         <AskExperience />
       </main>
     </div>
/**
 * Ask, as a full-height room: a thin bar, the conversation, and the
 * Evidence Canvas when there is evidence to show.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { X } from "lucide-react";

import { AskExperience } from "@/components/statbridge/AskExperience";
import { StatBridgeMark } from "@/components/statbridge/SiteChrome";
import { ThemeToggle } from "@/components/statbridge/ThemeToggle";

const title = "Ask StatBridge — official South African statistics";
const description =
  "Ask about published Statistics South Africa figures, definitions, methods and release dates. Every answer shows the approved source; media and sensitive requests go to an official.";

export const Route = createFileRoute("/ask")({
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
  component: AskRoom,
});

function AskRoom() {
  return (
    <div className="relative min-h-svh stage-glow">
      <header className="sticky top-0 z-40 border-b border-hairline bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/" aria-label="StatBridge home" className="rounded-md">
            <StatBridgeMark />
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/media"
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Media desk
            </Link>
            <Link
              to="/case"
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Track a request
            </Link>
            <ThemeToggle className="ml-1" />
            <Link
              to="/"
              className="rounded-full border border-hairline p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Leave Ask"
            >
              <X aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-12">
        <AskExperience />
      </main>
    </div>
  );
}
