import { Keyboard, Mic } from "lucide-react";
import { useState } from "react";

import { AskExperience } from "@/components/statbridge/AskExperience";
import { VoiceCall } from "@/components/statbridge/VoiceCall";

export function AssistantExperience({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [typingOpened, setTypingOpened] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 justify-center px-3 py-2">
        <div role="group" aria-label="Conversation mode" className="inline-flex gap-1 rounded-full border border-hairline bg-surface p-1">
          <button
            type="button"
            aria-pressed={mode === "voice"}
            onClick={() => setMode("voice")}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-secondary aria-pressed:text-foreground"
          >
            <Mic aria-hidden className="size-4" />
            Voice
          </button>
          <button
            type="button"
            aria-pressed={mode === "text"}
            onClick={() => {
              setTypingOpened(true);
              setMode("text");
            }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-secondary aria-pressed:text-foreground"
          >
            <Keyboard aria-hidden className="size-4" />
            Type
          </button>
        </div>
      </div>

      {/* Unmount voice on a mode change so its microphone and connection close. */}
      {mode === "voice" && <div className="min-h-0 flex-1"><VoiceCall /></div>}
      {/* Keep the opened text chat mounted to preserve drafts and follow-ups. */}
      {typingOpened && (
        <div hidden={mode !== "text"} className="min-h-0 flex-1">
          <AskExperience compact={compact} />
        </div>
      )}
    </div>
  );
}
