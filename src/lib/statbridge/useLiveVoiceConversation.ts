import { useEffect, useRef, useState } from "react";
import {
  LiveVoiceClient,
  type LiveVoiceCallbacks,
  type LiveVoiceCredentials,
} from "./live-voice-client";

/** Transport-only adapter. The existing voice room owns its layout and evidence canvas. */
export function useLiveVoiceConversation(
  callbacks: Pick<LiveVoiceCallbacks, "onConnect" | "onDisconnect" | "onError" | "onMessage">,
) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const [isSpeaking, setSpeaking] = useState(false);
  const client = useRef<LiveVoiceClient | null>(null);
  const callbackRef = useRef(callbacks);
  callbackRef.current = callbacks;
  useEffect(
    () => () => {
      client.current?.close();
      client.current = null;
    },
    [],
  );
  return {
    status,
    isSpeaking,
    async startSession(credentials: LiveVoiceCredentials) {
      client.current?.close();
      const next = new LiveVoiceClient({
        onConnect: () => callbackRef.current.onConnect(),
        onDisconnect: () => callbackRef.current.onDisconnect(),
        onError: (message) => callbackRef.current.onError(message),
        onMessage: (message) => callbackRef.current.onMessage(message),
        onStatus: setStatus,
        onSpeaking: setSpeaking,
      });
      client.current = next;
      await next.start(credentials);
    },
    endSession() {
      client.current?.close();
      client.current = null;
    },
    getInputVolume: () => client.current?.inputLevel ?? 0,
    getOutputVolume: () => client.current?.outputLevel ?? 0,
  };
}
