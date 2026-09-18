import { afterEach, expect, test } from "bun:test";
import {
  readPreservedVoice,
  streamPreservedVoice,
} from "../src/lib/statbridge/preserved-voice.server";
import { Route } from "../src/routes/api/voice/speak";

const originalFetch = globalThis.fetch;
const environmentKeys = [
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_AGENT_ID",
  "ELEVENLABS_VOICE_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
);
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

function setup() {
  process.env.ELEVENLABS_API_KEY = "mock-account-key";
  process.env.ELEVENLABS_AGENT_ID = `owned-agent-${crypto.randomUUID()}`;
  process.env.ELEVENLABS_VOICE_ID = "older-recorded-fallback";
}
const profile = {
  voice_id: "actual-current-agent-voice",
  stability: 0.21,
  similarity_boost: 0.73,
  speed: 1.09,
};
const pcm = new Uint8Array([0, 1, 0, 2]);
const voiceResponse = () => Response.json({ conversation_config: { tts: profile } });
const post = (
  Route.options as unknown as {
    server: { handlers: { POST: (context: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;
const request = (body: unknown) =>
  new Request("http://localhost/api/voice/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("preserved speech fetches the current live agent voice instead of an older fallback", async () => {
  setup();
  const urls: string[] = [];
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    urls.push(String(url));
    return voiceResponse();
  }) as typeof fetch;
  const actual = await readPreservedVoice();
  expect(actual).toEqual({
    voiceId: profile.voice_id,
    stability: profile.stability,
    similarity: profile.similarity_boost,
    speed: profile.speed,
  });
  expect(urls).toEqual([
    `https://api.elevenlabs.io/v1/convai/agents/${process.env.ELEVENLABS_AGENT_ID}`,
  ]);
  expect(actual.voiceId).not.toBe(process.env.ELEVENLABS_VOICE_ID);
});

test("English and Afrikaans stream the same agent voice using v3 and matching settings", async () => {
  setup();
  const calls: Array<{
    url: string;
    body: Record<string, unknown>;
    signal: AbortSignal | null | undefined;
  }> = [];
  let agentReads = 0;
  globalThis.fetch = (async (url: RequestInfo | URL, options?: RequestInit) => {
    if (String(url).includes("/convai/agents/")) {
      agentReads++;
      return voiceResponse();
    }
    calls.push({
      url: String(url),
      body: JSON.parse(String(options?.body)),
      signal: options?.signal,
    });
    return new Response(pcm);
  }) as typeof fetch;
  for (const language of ["en", "af"]) {
    const signal = new AbortController().signal;
    const stream = await streamPreservedVoice("A short test", language, signal);
    expect(new Uint8Array(await new Response(stream).arrayBuffer())).toEqual(pcm);
    expect(calls.at(-1)?.signal).toBe(signal);
  }
  expect(agentReads).toBe(1);
  expect(calls.map((call) => call.body["language_code"])).toEqual(["en", "af"]);
  for (const call of calls) {
    expect(call.url).toBe(
      `https://api.elevenlabs.io/v1/text-to-speech/${profile.voice_id}/stream?output_format=pcm_24000`,
    );
    expect(call.body["model_id"]).toBe("eleven_v3");
    expect(call.body["voice_settings"]).toEqual({
      stability: 0,
      similarity_boost: 0.73,
      speed: 1.09,
      use_speaker_boost: true,
    });
    expect(JSON.stringify(call)).not.toContain("older-recorded-fallback");
  }
});

test("other spoken languages and SASL never enter the preserved English/Afrikaans renderer", async () => {
  setup();
  let requests = 0;
  globalThis.fetch = (async () => {
    requests++;
    return voiceResponse();
  }) as typeof fetch;
  for (const language of ["zu", "xh", "nso", "st", "tn", "ss", "ve", "ts", "nr", "sfs", "auto"])
    await expect(
      streamPreservedVoice("Test", language, new AbortController().signal),
    ).rejects.toMatchObject({ status: 422 });
  expect(requests).toBe(0);
});

test("voice profile failure and synthesis failure do not switch to another provider or voice", async () => {
  for (const failure of ["profile", "synthesis"]) {
    setup();
    const urls: string[] = [];
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      urls.push(String(url));
      if (String(url).includes("/convai/agents/") && failure !== "profile") return voiceResponse();
      return new Response("PRIVATE_PROVIDER_DIAGNOSTIC", { status: 503 });
    }) as typeof fetch;
    await expect(
      streamPreservedVoice("Test", "en", new AbortController().signal),
    ).rejects.toThrow();
    expect(urls.every((url) => url.startsWith("https://api.elevenlabs.io/"))).toBe(true);
    expect(urls.some((url) => url.includes("older-recorded-fallback"))).toBe(false);
    expect(urls.length).toBe(failure === "profile" ? 1 : 2);
  }
});

test("missing current agent configuration never uses a fallback voice", async () => {
  setup();
  delete process.env.ELEVENLABS_AGENT_ID;
  let requests = 0;
  globalThis.fetch = (async () => {
    requests++;
    return voiceResponse();
  }) as typeof fetch;
  await expect(
    streamPreservedVoice("Test", "af", new AbortController().signal),
  ).rejects.toMatchObject({ status: 503 });
  expect(requests).toBe(0);
});

test("speak route rejects missing ownership, invalid language and empty text before synthesis", async () => {
  let requests = 0;
  globalThis.fetch = (async () => {
    requests++;
    throw new Error("No request expected");
  }) as typeof fetch;
  const context = {
    conversationId: crypto.randomUUID(),
    browserToken: "test-browser-token",
    language: "en",
    text: "Test",
  };
  for (const body of [
    null,
    { ...context, conversationId: "none" },
    { ...context, browserToken: "none" },
    { ...context, language: "zu" },
    { ...context, text: "" },
  ])
    expect((await post({ request: request(body) })).status).toBe(400);
  expect(requests).toBe(0);
});

test("speak route checks browser ownership before reading or rendering the private agent voice", async () => {
  process.env.SUPABASE_URL ??= "https://test-supabase.example.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "mock-service-role-key";
  let providerCalls = 0;
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    if (
      String(url).includes("/rest/v1/visitor_identifiers") ||
      String(url).includes("/rest/v1/conversations")
    )
      return Response.json([]);
    providerCalls++;
    throw new Error("Provider must not be called");
  }) as typeof fetch;
  const response = await post({
    request: request({
      conversationId: crypto.randomUUID(),
      browserToken: "not-an-owned-browser",
      language: "af",
      text: "Goeiedag",
    }),
  });
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "unauthorised" });
  expect(providerCalls).toBe(0);
});
