import { createFileRoute } from "@tanstack/react-router";
import { Maximize2, SquareArrowOutUpRight, X } from "lucide-react";
import { useEffect } from "react";

import { AskExperience } from "@/components/statbridge/AskExperience";
import { StatBridgeMark } from "@/components/statbridge/SiteChrome";

const title = "StatBridge assistant";
const description = "The embeddable StatBridge assistant for Statistics South Africa information.";

export const Route = createFileRoute("/embed")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmbedPage,
});

function postToHost(message: Record<string, unknown>) {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage({ source: "statbridge", ...message }, "*");
}

function EmbedPage() {
  useEffect(() => {
    postToHost({ type: "ready" });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") postToHost({ type: "close" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="light flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-surface px-3 py-2">
        <StatBridgeMark className="text-sm" />
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => postToHost({ type: "expand" })}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <Maximize2 aria-hidden className="size-4" />
            <span className="sr-only">Make the assistant bigger</span>
          </button>
          <button
            type="button"
            onClick={() => postToHost({ type: "open-app" })}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <SquareArrowOutUpRight aria-hidden className="size-4" />
            <span className="sr-only">Open StatBridge in a new tab</span>
          </button>
          <button
            type="button"
            onClick={() => postToHost({ type: "close" })}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X aria-hidden className="size-4" />
            <span className="sr-only">Close the assistant</span>
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-3 py-4">
        <AskExperience compact />
      </main>
      <p className="border-t border-border bg-surface px-3 py-1.5 text-[10px] text-muted-foreground">
        Demonstration build. Answers quote approved Stats SA material.
      </p>
    </div>
  );
}
