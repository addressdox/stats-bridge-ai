/** Immersive Ask room with persistent safe evidence rendering. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

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
    <div className="relative flex h-svh flex-col overflow-hidden bg-background">
      <header className="relative z-40 flex h-16 shrink-0 items-center justify-between border-b border-hairline bg-background/80 px-5 backdrop-blur-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Link>
        <StatBridgeMark />
        <ThemeToggle />
      </header>
      <main className="min-h-0 flex-1"><AskExperience /></main>
    </div>
  );
}
