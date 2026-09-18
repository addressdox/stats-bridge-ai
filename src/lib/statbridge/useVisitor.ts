/**
 * Keeps track of who is on this browser and which conversation is open.
 *
 * The browser stores nothing but a random token it made itself; every name,
 * email or phone number lives on the server.
 */
import { useEffect, useState } from "react";

import { openConversation, type OpenedConversation } from "./conversation.functions";

const TOKEN_KEY = "statbridge.visitor";
let temporaryToken: string | null = null;

export function readBrowserToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(TOKEN_KEY);
    if (existing && existing.length >= 8 && existing.length <= 80) return existing;
  } catch {
    // Some embedded/private browsers block storage. Keep one identity for this page.
  }
  if (temporaryToken) return temporaryToken;
  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  temporaryToken = fresh;
  try {
    window.localStorage.setItem(TOKEN_KEY, fresh);
  } catch {
    // The session still works; recognition after reopening requires browser storage.
  }
  return fresh;
}

export type VisitorSession = OpenedConversation & { browserToken: string };

export function useVisitorSession(channel: "chat" | "voice" | "widget" = "chat") {
  const [session, setSession] = useState<VisitorSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSession(null);
    setError(null);
    setLoading(true);
    const browserToken = readBrowserToken();

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
        if (!cancelled) setError("We couldn't open your conversation. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [channel, attempt]);

  return { session, setSession, loading, error, retry: () => setAttempt((current) => current + 1) };
}
