import { afterEach, describe, expect, test } from "bun:test";
import type { LiveServerMessage } from "@google/genai";
import {
  LiveVoiceClient,
  type LiveVoiceCredentials,
} from "../src/lib/statbridge/live-voice-client";

type Dependencies = NonNullable<ConstructorParameters<typeof LiveVoiceClient>[1]>;
type Connect = NonNullable<Dependencies["connect"]>;
type Connection = Awaited<ReturnType<Connect>>;
type TransportCallbacks = Parameters<Connect>[1];
type AudioCallbacks = Parameters<NonNullable<Dependencies["createAudio"]>>[0];
type Request = { url: string; body: Record<string, unknown>; signal: AbortSignal | null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
  await Bun.sleep(0);
}

const nativePcm = btoa(String.fromCharCode(1, 0, 1, 0));
const preservedPcm = btoa(String.fromCharCode(2, 0, 3, 0));
const audioMessage = (text?: string) => ({
  serverContent: {
    modelTurn: { parts: [{ inlineData: { data: nativePcm, mimeType: "audio/pcm;rate=24000" } }] },
    ...(text ? { outputTranscription: { text } } : {}),
  },
});
const pcmResponse = () =>
  new Response(new Uint8Array([2, 0, 3, 0]), {
    headers: { "Content-Type": "audio/pcm;rate=24000" },
  });
const tokenResponse = () =>
  Response.json({
    token: "renewed-test-token",
    model: "test-live",
    config: { sessionResumption: {} },
  });
const active: LiveVoiceClient[] = [];
afterEach(() => {
  for (const client of active.splice(0)) client.close();
});

function harness(
  options: {
    respond?: (request: Request) => Promise<Response> | Response;
    open?: (callbacks: TransportCallbacks, connection: Connection) => Promise<Connection>;
  } = {},
) {
  let audioCallbacks!: AudioCallbacks;
  const played: Array<{ data: string; rate: number | undefined }> = [];
  const requests: Request[] = [];
  const messages: Array<{ source: "user" | "ai"; message: string; id: string }> = [];
  const errors: string[] = [];
  const statuses: string[] = [];
  const speaking: boolean[] = [];
  const connections: Array<{
    credentials: LiveVoiceCredentials;
    callbacks: TransportCallbacks;
    realtime: unknown[];
    content: unknown[];
    responses: unknown[];
    closes: number;
  }> = [];
  let connected = 0;
  let disconnected = 0;
  let audioCloses = 0;
  let playbackStops = 0;
  const client = new LiveVoiceClient(
    {
      onConnect: () => {
        connected++;
      },
      onDisconnect: () => {
        disconnected++;
      },
      onError: (message) => errors.push(message),
      onMessage: (message) => messages.push(message),
      onStatus: (status) => statuses.push(status),
      onSpeaking: (value) => speaking.push(value),
    },
    {
      createAudio: (callbacks) => {
        audioCallbacks = callbacks;
        return {
          start: async () => undefined,
          queue: (data, rate) => {
            played.push({ data, rate });
            callbacks.onPlaybackChange(true);
          },
          stopPlayback: () => {
            playbackStops++;
            callbacks.onPlaybackChange(false);
          },
          close: () => {
            audioCloses++;
          },
          inputLevel: 0.1,
          outputLevel: 0.2,
        };
      },
      fetch: (async (input, init) => {
        const request = {
          url: String(input),
          body: JSON.parse(String(init?.body)),
          signal: init?.signal ?? null,
        };
        requests.push(request);
        if (options.respond) return options.respond(request);
        if (request.url.endsWith("/token")) return tokenResponse();
        return request.url.endsWith("/speak")
          ? pcmResponse()
          : Response.json({ result: { language: "en", spoken: "Checked answer.", saved: true } });
      }) as typeof fetch,
      connect: async (credentials, callbacks) => {
        const record = {
          credentials,
          callbacks,
          realtime: [] as unknown[],
          content: [] as unknown[],
          responses: [] as unknown[],
          closes: 0,
        };
        connections.push(record);
        const connection: Connection = {
          sendRealtimeInput: (input) => {
            record.realtime.push(input);
          },
          sendClientContent: (input) => {
            record.content.push(input);
          },
          sendToolResponse: (input) => {
            record.responses.push(input);
          },
          close: () => {
            record.closes++;
            callbacks.onclose();
          },
        };
        if (options.open) return options.open(callbacks, connection);
        queueMicrotask(() => callbacks.onmessage({ setupComplete: {} } as LiveServerMessage));
        return connection;
      },
    },
  );
  active.push(client);
  const emit = (message: unknown) =>
    connections.at(-1)!.callbacks.onmessage(message as LiveServerMessage);
  let languageId = 0;
  return {
    client,
    played,
    requests,
    messages,
    errors,
    statuses,
    speaking,
    connections,
    start: () =>
      client.start({
        token: "test-only",
        model: "test-live",
        config: {},
        conversationId: "owned-conversation",
        browserToken: "owned-browser",
      }),
    emit,
    setLanguage: async (language: string) => {
      emit({
        toolCall: {
          functionCalls: [
            { id: `language-${++languageId}`, name: "set_language", args: { language } },
          ],
        },
      });
      await settle();
    },
    speechStart: () => audioCallbacks.onSpeechStart?.(),
    input: (data: string) => audioCallbacks.onInput(data),
    connected: () => connected,
    disconnected: () => disconnected,
    audioCloses: () => audioCloses,
    playbackStops: () => playbackStops,
  };
}

describe("live voice output selection", () => {
  for (const language of ["en", "af"]) {
    test(`${language}: discards generated native PCM and plays the original voice response`, async () => {
      const h = harness();
      await h.start();
      await h.setLanguage(language);
      h.emit(audioMessage("A short spoken answer."));
      h.emit({ serverContent: { turnComplete: true } });
      await settle();
      const speech = h.requests.filter((request) => request.url.endsWith("/speak"));
      expect(speech).toHaveLength(1);
      expect(speech[0]!.body["language"]).toBe(language);
      expect(speech[0]!.body["text"]).toBe("A short spoken answer.");
      expect(h.played).toEqual([{ data: preservedPcm, rate: 24000 }]);
      expect(h.played.some((chunk) => chunk.data === nativePcm)).toBe(false);
    });
  }

  for (const language of ["zu", "xh", "nso", "st", "tn", "ss", "ve", "ts", "nr"]) {
    test(`${language}: native PCM is gated until the language tool confirms it`, async () => {
      const h = harness();
      await h.start();
      h.emit(audioMessage());
      await settle();
      expect(h.played).toHaveLength(0);
      await h.setLanguage(language);
      h.emit(audioMessage("Localized response"));
      h.emit({ serverContent: { turnComplete: true } });
      await settle();
      expect(h.played).toEqual([{ data: nativePcm, rate: 24000 }]);
      expect(h.requests).toHaveLength(0);
    });
  }

  test("automatic isiZulu to Afrikaans switching changes output without a selector", async () => {
    const h = harness();
    await h.start();
    await h.setLanguage("isiZulu");
    h.emit(audioMessage("Sawubona."));
    h.emit({ serverContent: { turnComplete: true } });
    await settle();
    h.speechStart();
    h.emit(audioMessage());
    expect(h.played).toHaveLength(1);
    await h.setLanguage("af-ZA");
    h.emit(audioMessage("Goeie môre."));
    h.emit({ serverContent: { turnComplete: true } });
    await settle();
    expect(h.played.map((chunk) => chunk.data)).toEqual([nativePcm, preservedPcm]);
    expect(h.requests[0]!.body["language"]).toBe("af");
    expect(h.playbackStops()).toBeGreaterThan(0);
  });

  test("invalid or signed language never unlocks native speech", async () => {
    const h = harness();
    await h.start();
    await h.setLanguage("zu");
    await h.setLanguage("sasl");
    h.emit(audioMessage());
    await settle();
    expect(h.played).toHaveLength(0);
    expect(JSON.stringify(h.connections[0]!.responses)).toContain("invalid_language");
  });

  test("original voice failure ends the line without substituting native English audio", async () => {
    const h = harness({ respond: () => new Response("unavailable", { status: 503 }) });
    await h.start();
    await h.setLanguage("en");
    h.emit(audioMessage("Hello."));
    h.emit({ serverContent: { turnComplete: true } });
    await settle();
    expect(h.played).toHaveLength(0);
    expect(h.errors).toHaveLength(1);
    expect(h.errors[0]).toContain("usual voice");
    expect(h.statuses.at(-1)).toBe("disconnected");
    expect(h.audioCloses()).toBe(1);
  });
});

describe("interruption and async cancellation", () => {
  test("server interruption cancels pending and queued original-voice requests even without local VAD", async () => {
    const response = deferred<Response>();
    const h = harness({ respond: () => response.promise });
    await h.start();
    await h.setLanguage("en");
    h.emit({
      serverContent: {
        outputTranscription: { text: "First sentence. Second sentence." },
        turnComplete: true,
      },
    });
    await settle();
    expect(h.requests).toHaveLength(1);
    h.emit({ serverContent: { interrupted: true } });
    expect(h.requests[0]!.signal!.aborted).toBe(true);
    response.resolve(pcmResponse());
    await settle();
    expect(h.requests).toHaveLength(1);
    expect(h.played).toHaveLength(0);
    expect(h.errors).toHaveLength(0);
  });

  test("barge-in discards a late HTTP audio chunk whose fetch ignores abort", async () => {
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    const h = harness({
      respond: () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start: (controller) => {
              stream = controller;
            },
          }),
          { headers: { "Content-Type": "audio/pcm" } },
        ),
    });
    await h.start();
    await h.setLanguage("en");
    h.emit({ serverContent: { outputTranscription: { text: "Hello." }, turnComplete: true } });
    await settle();
    h.speechStart();
    stream.enqueue(new Uint8Array([2, 0, 3, 0]));
    stream.close();
    await settle();
    expect(h.requests[0]!.signal!.aborted).toBe(true);
    expect(h.played).toHaveLength(0);
    expect(h.errors).toHaveLength(0);
  });

  test("a cancelled tool batch cannot execute its next side effect or speak a late result", async () => {
    const response = deferred<Response>();
    const h = harness({ respond: () => response.promise });
    await h.start();
    await h.setLanguage("en");
    h.emit({
      toolCall: {
        functionCalls: [
          {
            id: "answer-slow",
            name: "answer_question",
            args: { question: "A statistical question" },
          },
          { id: "contact-after", name: "save_contact", args: { full_name: "Demo", consent: true } },
        ],
      },
    });
    await settle();
    h.emit({ serverContent: { interrupted: true } });
    response.resolve(Response.json({ result: { language: "en", spoken: "Obsolete answer." } }));
    await settle();
    expect(h.requests).toHaveLength(1);
    expect(h.messages).toHaveLength(0);
    expect(h.played).toHaveLength(0);
    expect(JSON.stringify(h.connections[0]!.responses)).not.toContain("answer-slow");
  });

  test("tool cancellation suppresses its late result", async () => {
    const response = deferred<Response>();
    const h = harness({ respond: () => response.promise });
    await h.start();
    h.emit({
      toolCall: { functionCalls: [{ id: "cancel-me", name: "answer_question", args: {} }] },
    });
    await settle();
    h.emit({ toolCallCancellation: { ids: ["cancel-me"] } });
    response.resolve(Response.json({ result: { language: "en", spoken: "Do not speak this." } }));
    await settle();
    expect(h.played).toHaveLength(0);
    expect(h.messages).toHaveLength(0);
    expect(h.connections[0]!.responses).toHaveLength(0);
  });
});

describe("owned live session lifecycle", () => {
  test("ending during transport connection closes the late connection without greeting", async () => {
    const ready = deferred<Connection>();
    let pending!: Connection;
    const h = harness({
      open: async (_callbacks, connection) => {
        pending = connection;
        return ready.promise;
      },
    });
    const starting = h.start();
    await settle();
    h.client.close();
    ready.resolve(pending);
    await starting;
    expect(h.connected()).toBe(0);
    expect(h.connections[0]!.closes).toBe(1);
    expect(h.connections[0]!.content).toHaveLength(0);
    expect(h.audioCloses()).toBe(1);
    expect(h.disconnected()).toBe(1);
  });

  test("mic input is forwarded only after setup and never after end", async () => {
    const h = harness();
    h.input("before");
    await h.start();
    h.input("during");
    h.client.close();
    h.input("after");
    expect(h.connections[0]!.realtime).toEqual([
      { audio: { data: "during", mimeType: "audio/pcm;rate=16000" } },
    ]);
  });

  test("GoAway resumes once, carries the owned handle, and does not repeat the greeting", async () => {
    const h = harness();
    await h.start();
    h.emit({ sessionResumptionUpdate: { resumable: true, newHandle: "test-session-handle" } });
    h.emit({ goAway: { timeLeft: "1s" } });
    await Bun.sleep(330);
    await settle();
    expect(h.connections).toHaveLength(2);
    expect(h.connections[0]!.closes).toBe(1);
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]!.url).toBe("/api/voice/token");
    expect(h.requests[0]!.body).toEqual({
      conversationId: "owned-conversation",
      browserToken: "owned-browser",
      resumeHandle: "test-session-handle",
    });
    expect(h.connections[1]!.credentials.token).toBe("renewed-test-token");
    expect(h.connections[1]!.credentials.config).toEqual({ sessionResumption: {} });
    expect(h.connections[1]!.content).toHaveLength(0);
    expect(h.connected()).toBe(2);
  });

  test("ending cancels a scheduled reconnect and ignores old socket callbacks", async () => {
    const h = harness();
    await h.start();
    h.emit({ sessionResumptionUpdate: { resumable: true, newHandle: "test-handle" }, goAway: {} });
    h.client.close();
    h.connections[0]!.callbacks.onclose();
    h.connections[0]!.callbacks.onmessage(audioMessage("Late audio") as LiveServerMessage);
    await Bun.sleep(330);
    expect(h.connections).toHaveLength(1);
    expect(h.played).toHaveLength(0);
    expect(h.messages).toHaveLength(0);
    expect(h.errors).toHaveLength(0);
  });

  test("three healthy GoAway renewals retain the call instead of exhausting failure retries", async () => {
    const h = harness();
    await h.start();
    for (let renewal = 1; renewal <= 3; renewal++) {
      h.emit({
        sessionResumptionUpdate: { resumable: true, newHandle: `owned-handle-${renewal}` },
        goAway: {},
      });
      await Bun.sleep(330);
      await settle();
      expect(h.connections).toHaveLength(renewal + 1);
      expect(h.requests.at(-1)!.body["resumeHandle"]).toBe(`owned-handle-${renewal}`);
      expect(h.statuses.at(-1)).toBe("connected");
    }
    expect(h.connected()).toBe(4);
    expect(h.errors).toHaveLength(0);
    expect(h.requests.filter((request) => request.url.endsWith("/token"))).toHaveLength(3);
    expect(h.connections.slice(1).every((connection) => connection.content.length === 0)).toBe(
      true,
    );
  });

  test("ending during token renewal aborts it and ignores a late successful token", async () => {
    const token = deferred<Response>();
    const h = harness({ respond: () => token.promise });
    await h.start();
    h.emit({ sessionResumptionUpdate: { resumable: true, newHandle: "test-handle" }, goAway: {} });
    await Bun.sleep(330);
    expect(h.requests).toHaveLength(1);
    h.client.close();
    expect(h.requests[0]!.signal!.aborted).toBe(true);
    token.resolve(tokenResponse());
    await settle();
    expect(h.connections).toHaveLength(1);
    expect(h.connected()).toBe(1);
    expect(h.errors).toHaveLength(0);
  });

  test("speech during reconnection cannot abort the separate token renewal", async () => {
    const token = deferred<Response>();
    const h = harness({ respond: () => token.promise });
    await h.start();
    h.emit({ sessionResumptionUpdate: { resumable: true, newHandle: "test-handle" }, goAway: {} });
    await Bun.sleep(330);
    h.speechStart();
    expect(h.requests[0]!.signal!.aborted).toBe(false);
    token.resolve(tokenResponse());
    await settle();
    expect(h.connections).toHaveLength(2);
    expect(h.connected()).toBe(2);
  });

  test("renewal failure closes the call instead of reusing the consumed token", async () => {
    const h = harness({ respond: () => new Response("unavailable", { status: 503 }) });
    await h.start();
    h.emit({ sessionResumptionUpdate: { resumable: true, newHandle: "test-handle" }, goAway: {} });
    await Bun.sleep(330);
    await settle();
    expect(h.connections).toHaveLength(1);
    expect(h.errors).toHaveLength(1);
    expect(h.statuses.at(-1)).toBe("disconnected");
    expect(h.audioCloses()).toBe(1);
  });
});

describe("tool results and transcript assembly", () => {
  test("duplicate concurrent tool IDs make one side-effect request and speak once", async () => {
    const response = deferred<Response>();
    const h = harness({
      respond: (request) => (request.url.endsWith("/tool") ? response.promise : pcmResponse()),
    });
    await h.start();
    await h.setLanguage("en");
    const message = {
      toolCall: {
        functionCalls: [
          {
            id: "save-once",
            name: "save_contact",
            args: { full_name: "Demonstration", consent: true },
          },
        ],
      },
    };
    h.emit(message);
    h.emit(message);
    await settle();
    expect(h.requests.filter((request) => request.url.endsWith("/tool"))).toHaveLength(1);
    response.resolve(
      Response.json({ result: { language: "en", spoken: "Your details are saved.", saved: true } }),
    );
    await settle();
    h.emit(message);
    await settle();
    expect(h.requests.filter((request) => request.url.endsWith("/tool"))).toHaveLength(1);
    expect(h.requests.filter((request) => request.url.endsWith("/speak"))).toHaveLength(1);
    expect(h.messages).toHaveLength(1);
    expect(h.requests[0]!.body["conversationId"]).toBe("owned-conversation");
    expect(h.requests[0]!.body["browserToken"]).toBe("owned-browser");
  });

  test("checked result wording is spoken directly and generated paraphrase is suppressed", async () => {
    const h = harness();
    await h.start();
    await h.setLanguage("en");
    h.emit({
      toolCall: {
        functionCalls: [{ id: "answer", name: "answer_question", args: { question: "Question" } }],
      },
    });
    await settle();
    h.emit(audioMessage("A conflicting paraphrase."));
    h.emit({ serverContent: { turnComplete: true } });
    await settle();
    const speech = h.requests.filter((request) => request.url.endsWith("/speak"));
    expect(speech).toHaveLength(1);
    expect(speech[0]!.body["text"]).toBe("Checked answer.");
    expect(h.messages.at(-1)!.message).toBe("Checked answer.");
    expect(h.played).toEqual([{ data: preservedPcm, rate: 24000 }]);
  });

  test("transcript fragments update one turn ID, then start a new turn after completion", async () => {
    const h = harness();
    await h.start();
    await h.setLanguage("zu");
    h.emit({ serverContent: { inputTranscription: { text: "Sawubona " } } });
    h.emit({ serverContent: { inputTranscription: { text: "Kaya" } } });
    h.emit({ serverContent: { outputTranscription: { text: "Sawubona " } } });
    h.emit({ serverContent: { outputTranscription: { text: "nawe." }, turnComplete: true } });
    h.emit({ serverContent: { inputTranscription: { text: "Enkosi" } } });
    await settle();
    const users = h.messages.filter((message) => message.source === "user");
    const replies = h.messages.filter((message) => message.source === "ai");
    expect(users.map((message) => message.message)).toEqual([
      "Sawubona",
      "Sawubona Kaya",
      "Enkosi",
    ]);
    expect(users[0]!.id).toBe(users[1]!.id);
    expect(users[2]!.id).not.toBe(users[1]!.id);
    expect(replies.map((message) => message.message)).toEqual(["Sawubona", "Sawubona nawe."]);
    expect(replies[0]!.id).toBe(replies[1]!.id);
  });

  test("original PCM stream joins split 16-bit samples without corrupting bytes", async () => {
    const h = harness({
      respond: () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array([2]));
              controller.enqueue(new Uint8Array([0, 3]));
              controller.enqueue(new Uint8Array([0]));
              controller.close();
            },
          }),
          { headers: { "Content-Type": "audio/pcm" } },
        ),
    });
    await h.start();
    await h.setLanguage("en");
    h.emit({ serverContent: { outputTranscription: { text: "Hello." }, turnComplete: true } });
    await settle();
    expect(h.played.map((chunk) => atob(chunk.data)).join("")).toBe(atob(preservedPcm));
    expect(h.errors).toHaveLength(0);
  });
});
