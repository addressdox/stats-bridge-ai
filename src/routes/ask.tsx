/** Immersive Ask room: a voice call first, with a separate typed room. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PhoneCall } from "lucide-react";
import { useState } from "react";

import { AskExperience } from "@/components/statbridge/AskExperience";
import { VoiceCall } from "@/components/statbridge/VoiceCall";
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
  const [mode, setMode] = useState<"voice" | "chat">("voice");
  const [carried, setCarried] = useState("");
  const [chatKey, setChatKey] = useState(0);

  return (
    <div className="relative flex h-svh flex-col overflow-hidden bg-background">
      <header className="relative z-40 flex h-16 shrink-0 items-center justify-between border-b border-hairline bg-background/80 px-5 backdrop-blur-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Link>
        <StatBridgeMark />
        <div className="flex items-center gap-2">
          {mode === "chat" && (
            <button
              type="button"
              onClick={() => setMode("voice")}
              className="inline-flex items-center gap-2 rounded-full border border-official/55 bg-official/10 px-3.5 py-1.5 text-xs font-semibold text-official transition-colors hover:bg-official/20"
            >
              <PhoneCall aria-hidden className="size-3.5" />
              Back to voice
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>
      <main className="min-h-0 flex-1">
        {mode === "voice" ? (
          <VoiceCall
            onTypeInstead={(draft) => {
              setCarried(draft ?? "");
              setChatKey((value) => value + 1);
              setMode("chat");
            }}
          />
        ) : (
          <AskExperience key={chatKey} initialDraft={carried} />
        )}
      </main>
    </div>
  );
}
