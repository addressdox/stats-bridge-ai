import type { LiveConnectConfig, LiveServerMessage, Session } from "@google/genai";
import { LiveVoiceAudio } from "./live-voice-audio";
import { normalizeLanguage, SOUTH_AFRICAN_LANGUAGES } from "./languages";

export type LiveVoiceCredentials = {
  token: string;
  model: string;
  config: LiveConnectConfig;
  conversationId: string;
  browserToken: string;
};
export type LiveVoiceCallbacks = {
  onConnect(): void;
  onDisconnect(): void;
  onError(message: string): void;
  onMessage(message: { source: "user" | "ai"; message: string; id: string }): void;
  onStatus(status: "connecting" | "connected" | "disconnected"): void;
  onSpeaking(speaking: boolean): void;
};
type Connection = Pick<
  Session,
  "sendRealtimeInput" | "sendClientContent" | "sendToolResponse" | "close"
>;
type Audio = Pick<
  LiveVoiceAudio,
  "start" | "queue" | "stopPlayback" | "close" | "inputLevel" | "outputLevel"
>;
type AudioCallbacks = ConstructorParameters<typeof LiveVoiceAudio>[0];
type Connect = (
  credentials: LiveVoiceCredentials,
  callbacks: {
    onmessage(message: LiveServerMessage): void;
    onerror(): void;
    onclose(): void;
  },
) => Promise<Connection>;
type Dependencies = {
  fetch: typeof fetch;
  createAudio(callbacks: AudioCallbacks): Audio;
  connect: Connect;
};
const languages = new Set<string>(
  SOUTH_AFRICAN_LANGUAGES.filter((item) => item.spoken).map((item) => item.code),
);
export const usesPreservedVoice = (language: string) => language === "en" || language === "af";

/** One owned call; no audio, resumption handle or cancellation state is shared across visitors. */
export class LiveVoiceClient {
  private readonly deps: Dependencies;
  private audio: Audio;
  private connection: Connection | null = null;
  private credentials: LiveVoiceCredentials | null = null;
  private stopped = false;
  private ready = false;
  private connectVersion = 0;
  private turn = 0;
  private outputGeneration = 0;
  private language = "en";
  private languageReady = false;
  private userText = "";
  private modelText = "";
  private sentenceBuffer = "";
  private checkedText = "";
  private lastCompleted = false;
  private speaking = false;
  private resumptionHandle: string | undefined;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private tokenRequest: AbortController | null = null;
  private requests = new Set<AbortController>();
  private cancelledTools = new Set<string>();
  private toolResults = new Map<string, Promise<Record<string, unknown>>>();
  private speechQueue: Promise<void> = Promise.resolve();
  private setupReject: ((error: Error) => void) | null = null;

  constructor(
    private readonly callbacks: LiveVoiceCallbacks,
    dependencies: Partial<Dependencies> = {},
  ) {
    this.deps = {
      fetch: dependencies.fetch ?? globalThis.fetch.bind(globalThis),
      createAudio: dependencies.createAudio ?? ((callbacks) => new LiveVoiceAudio(callbacks)),
      connect:
        dependencies.connect ??
        (async (credentials, callbacks) => {
          const { GoogleGenAI } = await import("@google/genai");
          const ai = new GoogleGenAI({
            apiKey: credentials.token,
            httpOptions: { apiVersion: "v1beta" },
          });
          return ai.live.connect({
            model: credentials.model,
            config: credentials.config,
            callbacks,
          });
        }),
    };
    this.audio = this.deps.createAudio({
      onInput: (data) => {
        if (this.ready && !this.stopped)
          this.connection?.sendRealtimeInput({ audio: { data, mimeType: "audio/pcm;rate=16000" } });
      },
      onInputLevel: () => undefined,
      onOutputLevel: () => undefined,
      onPlaybackChange: (playing) => {
        this.speaking = playing;
        if (!this.stopped) callbacks.onSpeaking(playing);
      },
      onSpeechStart: () => this.beginUserTurn(),
    });
  }

  get inputLevel() {
    return this.audio.inputLevel;
  }
  get outputLevel() {
    return this.audio.outputLevel;
  }

  async start(credentials: LiveVoiceCredentials) {
    this.credentials = credentials;
    this.callbacks.onStatus("connecting");
    try {
      await this.audio.start();
      if (this.stopped) throw new DOMException("Call ended", "AbortError");
      await this.connect(false);
    } catch (error) {
      this.close();
      throw error;
    }
  }

  private async connect(resuming: boolean) {
    if (this.stopped || !this.credentials) return;
    const version = ++this.connectVersion;
    this.ready = false;
    if (resuming) await this.refreshCredentials(version);
    if (this.stopped || version !== this.connectVersion) return;
    // Resume configuration is locked into the newly minted single-use token by our server.
    const config = this.credentials.config;
    let setup = false;
    let acceptSetup!: () => void;
    const established = new Promise<void>((resolve, reject) => {
      acceptSetup = resolve;
      this.setupReject = reject;
    });
    // Attach rejection handling before the transport itself has finished opening.
    void established.catch(() => undefined);
    const timeout = setTimeout(
      () => this.setupReject?.(new Error("The voice line did not connect.")),
      20000,
    );
    try {
      const connection = await this.deps.connect(
        { ...this.credentials, config },
        {
          onmessage: (message) => {
            if (this.stopped || version !== this.connectVersion) return;
            if (message.setupComplete) {
              setup = true;
              acceptSetup();
            }
            void this.receive(message).catch(() =>
              this.fail("The voice line could not complete that response."),
            );
          },
          onerror: () => {
            if (version !== this.connectVersion || this.stopped) return;
            if (!setup) this.setupReject?.(new Error("The voice line could not connect."));
            else this.fail("The voice line was interrupted. Please try again.");
          },
          onclose: () => {
            if (version !== this.connectVersion || this.stopped) return;
            this.ready = false;
            if (!setup) this.setupReject?.(new Error("The voice line closed before connecting."));
            else this.scheduleReconnect();
          },
        },
      );
      if (this.stopped || version !== this.connectVersion) {
        connection.close();
        return;
      }
      this.connection = connection;
      await established;
      if (this.stopped || version !== this.connectVersion) return;
      this.ready = true;
      this.reconnectAttempts = 0;
      this.callbacks.onStatus("connected");
      this.callbacks.onConnect();
      if (!resuming)
        connection.sendClientContent({
          turns: [
            {
              role: "user",
              parts: [
                {
                  text: "Open the call with your short Stats South Africa information-desk greeting in English, then listen. Call set_language first.",
                },
              ],
            },
          ],
          turnComplete: true,
        });
    } finally {
      clearTimeout(timeout);
      this.setupReject = null;
    }
  }

  private async refreshCredentials(version: number) {
    const previous = this.credentials;
    const resumeHandle = this.resumptionHandle;
    if (!previous || !resumeHandle) throw new Error("The previous voice session is unavailable");
    const controller = new AbortController();
    this.tokenRequest?.abort();
    this.tokenRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await this.deps.fetch("/api/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: previous.conversationId,
          browserToken: previous.browserToken,
          resumeHandle,
        }),
        signal: controller.signal,
      });
      if (this.stopped || version !== this.connectVersion) return;
      if (controller.signal.aborted) throw new Error("The voice session renewal timed out");
      if (!response.ok) throw new Error("The voice session could not be renewed");
      const body = (await response.json()) as {
        token?: unknown;
        model?: unknown;
        config?: unknown;
      };
      if (this.stopped || version !== this.connectVersion) return;
      if (controller.signal.aborted) throw new Error("The voice session renewal timed out");
      if (
        typeof body.token !== "string" ||
        !body.token ||
        typeof body.model !== "string" ||
        !body.model ||
        !body.config ||
        typeof body.config !== "object" ||
        Array.isArray(body.config)
      )
        throw new Error("The renewed voice session is invalid");
      this.credentials = {
        ...previous,
        token: body.token,
        model: body.model,
        config: body.config as LiveConnectConfig,
      };
    } finally {
      clearTimeout(timeout);
      if (this.tokenRequest === controller) this.tokenRequest = null;
    }
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    if (!this.resumptionHandle || ++this.reconnectAttempts > 2) {
      this.fail("The voice line was interrupted. Please try again.");
      return;
    }
    this.callbacks.onStatus("connecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.stopped) return;
      // Detach callbacks before closing the old connection; it must not trigger another reconnect.
      ++this.connectVersion;
      this.connection?.close();
      this.connection = null;
      void this.connect(true).catch(() =>
        this.fail("The voice line could not reconnect. Please try again."),
      );
    }, 300);
  }

  private cancelOutput() {
    ++this.outputGeneration;
    this.audio.stopPlayback();
    for (const request of this.requests) request.abort();
    this.requests.clear();
    this.speechQueue = Promise.resolve();
    this.sentenceBuffer = "";
  }

  private beginUserTurn() {
    if (this.stopped) return;
    ++this.turn;
    this.cancelOutput();
    this.languageReady = false;
    this.userText = "";
    this.modelText = "";
    this.checkedText = "";
    this.lastCompleted = false;
  }

  private async receive(message: LiveServerMessage) {
    if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle)
      this.resumptionHandle = message.sessionResumptionUpdate.newHandle;
    if (message.goAway) this.scheduleReconnect();
    for (const id of message.toolCallCancellation?.ids ?? []) this.cancelledTools.add(id);
    const content = message.serverContent;
    if (content?.interrupted) {
      this.cancelOutput();
      this.languageReady = false;
      this.modelText = "";
      this.checkedText = "";
      // The acoustic speech-start callback already starts the next turn; do not erase its transcript.
    }
    if (content?.inputTranscription?.text) {
      if (this.lastCompleted) this.beginUserTurn();
      this.userText += content.inputTranscription.text;
      this.callbacks.onMessage({
        source: "user",
        message: this.userText.trim(),
        id: `user-${this.turn}`,
      });
    }
    // A server interruption may arrive without the local speech detector firing.
    if (content?.interrupted) return;
    const outputGeneration = this.outputGeneration;
    const receivedTurn = this.turn;
    if (message.toolCall?.functionCalls) {
      const version = this.turn;
      for (const call of message.toolCall.functionCalls) {
        if (this.stopped || version !== this.turn || outputGeneration !== this.outputGeneration)
          break;
        if (!call.id || !call.name || this.cancelledTools.has(call.id)) continue;
        let result: Record<string, unknown>;
        if (call.name === "set_language") {
          const code = normalizeLanguage(
            typeof call.args?.["language"] === "string" ? call.args["language"] : "auto",
          );
          if (!languages.has(code)) {
            this.languageReady = false;
            result = {
              error: "invalid_language",
              spoken: "Please clarify which language you are speaking.",
            };
          } else {
            this.language = code;
            this.languageReady = true;
            result = { language: code, ready: true };
          }
        } else {
          const cached = this.toolResults.get(call.id);
          const task = cached ?? this.callTool(call.name, call.args ?? {}, version);
          if (!cached) this.toolResults.set(call.id, task);
          result = await task;
          if (
            this.stopped ||
            version !== this.turn ||
            outputGeneration !== this.outputGeneration ||
            this.cancelledTools.has(call.id)
          )
            continue;
          const code = normalizeLanguage(
            typeof result["language"] === "string" ? result["language"] : this.language,
          );
          if (languages.has(code)) {
            this.language = code;
            this.languageReady = true;
          }
          if (
            !cached &&
            typeof result["spoken"] === "string" &&
            usesPreservedVoice(this.language)
          ) {
            // Read checked wording directly, avoiding a second generated paraphrase of a statistic.
            this.checkedText = [this.checkedText, result["spoken"]].filter(Boolean).join(" ");
            this.callbacks.onMessage({
              source: "ai",
              message: this.checkedText,
              id: `ai-${this.turn}`,
            });
            this.queueSpeech(result["spoken"], this.language, version);
          }
        }
        if (
          !this.stopped &&
          version === this.turn &&
          outputGeneration === this.outputGeneration &&
          !this.cancelledTools.has(call.id)
        )
          this.connection?.sendToolResponse({
            functionResponses: [{ id: call.id, name: call.name, response: result }],
          });
      }
    }
    if (this.stopped || receivedTurn !== this.turn || outputGeneration !== this.outputGeneration)
      return;
    if (content?.outputTranscription?.text && this.languageReady && !content.interrupted) {
      const text = content.outputTranscription.text;
      this.modelText += text;
      if (!this.checkedText) {
        this.callbacks.onMessage({
          source: "ai",
          message: this.modelText.trim(),
          id: `ai-${this.turn}`,
        });
        if (usesPreservedVoice(this.language)) {
          this.sentenceBuffer += text;
          this.flushSentences(false);
        }
      }
    }
    // The reference's English/Afrikaans voice is never played, including during errors or switches.
    if (this.languageReady && !usesPreservedVoice(this.language) && !content?.interrupted) {
      for (const part of content?.modelTurn?.parts ?? []) {
        if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/pcm")) {
          const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType)?.[1] ?? 24000);
          this.audio.queue(part.inlineData.data, rate);
        }
      }
    }
    if (content?.turnComplete && !content.interrupted) {
      this.flushSentences(true);
      this.lastCompleted = true;
    }
  }

  private flushSentences(final: boolean) {
    if (this.checkedText || !usesPreservedVoice(this.language)) {
      this.sentenceBuffer = "";
      return;
    }
    let match: RegExpExecArray | null;
    while ((match = /^([\s\S]*?[.!?])\s+/.exec(this.sentenceBuffer))) {
      this.queueSpeech(match[1]!, this.language, this.turn);
      this.sentenceBuffer = this.sentenceBuffer.slice(match[0].length);
    }
    if (final && this.sentenceBuffer.trim()) {
      this.queueSpeech(this.sentenceBuffer.trim(), this.language, this.turn);
      this.sentenceBuffer = "";
    }
  }

  private async callTool(name: string, args: Record<string, unknown>, turn: number) {
    const controller = new AbortController();
    this.requests.add(controller);
    try {
      const response = await this.deps.fetch("/api/voice/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: this.credentials?.conversationId,
          browserToken: this.credentials?.browserToken,
          name,
          args,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Tool unavailable");
      const body = (await response.json()) as { result?: Record<string, unknown> };
      if (!body.result || typeof body.result !== "object") throw new Error("Invalid tool response");
      return body.result;
    } catch {
      return {
        error: "tool_unavailable",
        spoken: "I could not complete that request just now. Please try again.",
        language: this.language,
      };
    } finally {
      this.requests.delete(controller);
    }
  }

  private queueSpeech(text: string, language: string, turn: number) {
    if (!text.trim()) return;
    const outputGeneration = this.outputGeneration;
    const current = () =>
      !this.stopped && turn === this.turn && outputGeneration === this.outputGeneration;
    this.speechQueue = this.speechQueue.then(async () => {
      if (!current()) return;
      const controller = new AbortController();
      this.requests.add(controller);
      try {
        const response = await this.deps.fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: this.credentials?.conversationId,
            browserToken: this.credentials?.browserToken,
            text: text.slice(0, 2500),
            language,
          }),
          signal: controller.signal,
        });
        if (!current() || controller.signal.aborted) {
          await response.body?.cancel().catch(() => undefined);
          return;
        }
        if (
          !response.ok ||
          !response.body ||
          !response.headers.get("Content-Type")?.startsWith("audio/pcm")
        )
          throw new Error("Voice unavailable");
        const reader = response.body.getReader();
        let oddByte: number | undefined;
        try {
          while (current() && !controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (!current() || controller.signal.aborted) break;
            if (done) {
              if (oddByte !== undefined) throw new Error("Incomplete voice audio sample");
              break;
            }
            if (!value) continue;
            const bytes = oddByte === undefined ? value : Uint8Array.from([oddByte, ...value]);
            oddByte = bytes.length % 2 ? bytes[bytes.length - 1] : undefined;
            const even = bytes.subarray(0, bytes.length - (bytes.length % 2));
            let binary = "";
            for (let offset = 0; offset < even.length; offset += 8192)
              binary += String.fromCharCode(...even.subarray(offset, offset + 8192));
            if (binary) this.audio.queue(btoa(binary), 24000);
          }
        } finally {
          await reader.cancel().catch(() => undefined);
        }
      } catch {
        if (!controller.signal.aborted && current())
          this.fail("Your usual voice could not be played. Please try the call again.");
      } finally {
        this.requests.delete(controller);
      }
    });
  }

  private fail(message: string) {
    if (this.stopped) return;
    this.callbacks.onError(message);
    this.close();
  }

  close() {
    if (this.stopped) return;
    this.stopped = true;
    this.ready = false;
    ++this.turn;
    ++this.connectVersion;
    this.setupReject?.(new DOMException("Call ended", "AbortError"));
    this.tokenRequest?.abort();
    this.tokenRequest = null;
    this.cancelOutput();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.connection?.close();
    this.connection = null;
    this.resumptionHandle = undefined;
    this.audio.close();
    this.callbacks.onSpeaking(false);
    this.callbacks.onStatus("disconnected");
    this.callbacks.onDisconnect();
  }
}
