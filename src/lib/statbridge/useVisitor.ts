/**
 * Keeps track of who is on this browser and which conversation is open.
 *
 * The browser stores nothing but a random token it made itself; every name,
 * email or phone number lives on the server.
 */
import { useEffect, useState } from "react";

import { openConversation, type OpenedConversation } from "./conversation.functions";

const TOKEN_KEY = "statbridge.visitor";

export function readBrowserToken(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(TOKEN_KEY);
  if (existing && existing.length >= 8) return existing;
  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  window.localStorage.setItem(TOKEN_KEY, fresh);
  return fresh;
}

export type VisitorSession = OpenedConversation & { browserToken: string };

export function useVisitorSession(channel: "chat" | "voice" | "widget" = "chat") {
  const [session, setSession] = useState<VisitorSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    const browserToken = readBrowserToken();
    if (!browserToken) return;

    void openConversation({
      data: {
        browserToken,
        channel,
        language: "en",
        device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
        pageUrl: typeof window !== "undefined" ? window.location.href.slice(0, 500) : null,
      },
    })
      .then((opened) => {
        if (!cancelled) setSession({ ...opened, browserToken });
      })
      .catch(() => {
        // A conversation record is a convenience; never block the answer on it.
      });

    return () => {
      cancelled = true;
    };
  }, [channel]);

  return { session, setSession };
}
