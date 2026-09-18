import { afterEach, describe, expect, test } from "bun:test";
import { pcmToWav, spokenAnswer } from "../src/lib/statbridge/voice";
import { synthesizeVoice, transcribeVoice } from "../src/lib/statbridge/voice.server";
import { readVoiceEvidence } from "../src/lib/statbridge/voice-evidence.server";
import { SOUTH_AFRICAN_LANGUAGES } from "../src/lib/statbridge/languages";
import type { PublicAnswer } from "../src/lib/statbridge/contract";

const originalFetch = globalThis.fetch;
const originalGoogle = process.env.GEMINI_API_KEY;
const originalVoice = process.env.ELEVENLABS_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalGoogle === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGoogle;
  if (originalVoice === undefined) delete process.env.ELEVENLABS_API_KEY;
  else process.env.ELEVENLABS_API_KEY = originalVoice;
});
const answer: PublicAnswer = {
  apiVersion: "v1",
  answerRef: "ANS-test",
  question: "Question",
  outcome: "answered",
  readingLevel: "short",
  officialBlocks: [],
  aiExplanation: "A checked explanation",
  caveats: [],
  followUps: [],
  references: [],
  clarification: null,
  gapDescription: null,
  caseReference: null,
  statusToken: null,
  reviewReasons: [],
  provider: null,
  createdAt: "2026-09-18",
};

describe("governed voice output", () => {
  test("escalations speak only acknowledgement, not accompanying internal-looking content", () => {
    expect(
      spokenAnswer({
        ...answer,
        outcome: "escalated",
        aiExplanation: "Do not read this draft",
        officialBlocks: [
          {
            type: "case_acknowledgement",
            reference: "CASE",
            statusUrl: "/case",
            message: "Your request awaits review.",
          },
        ],
      }),
    ).toBe("Your request awaits review.");
  });
  test("clarification uses the exact question", () => {
    expect(
      spokenAnswer({
        ...answer,
        outcome: "clarification",
        clarification: { question: "Watter tydperk?", choices: [] },
      }),
    ).toBe("Watter tydperk?");
  });
  test("PCM packaging preserves the audio bytes and sample rate", () => {
    const input = new Uint8Array([1, 2, 3, 4]);
    const wav = pcmToWav(input);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(new DataView(wav.buffer).getUint32(24, true)).toBe(24000);
    expect(wav.slice(44)).toEqual(input);
  });
  test("all eleven spoken languages reach synthesis without English substitution", async () => {
    process.env.GEMINI_API_KEY = "test-google";
    process.env.ELEVENLABS_API_KEY = "test-speech";
    const requested: Array<{ url: string; body: Record<string, any> }> = [];
    globalThis.fetch = (async (url: any, options: any) => {
      const body = JSON.parse(options.body);
      requested.push({ url: String(url), body });
      return String(url).includes("elevenlabs")
        ? new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "audio/mpeg" } })
        : Response.json({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        data: "AQIDBA==",
                        mimeType: "audio/l16; rate=24000; channels=1",
                      },
                    },
                  ],
                },
              },
            ],
          });
    }) as typeof fetch;
    for (const language of SOUTH_AFRICAN_LANGUAGES.filter((item) => item.spoken)) {
      const result = await synthesizeVoice(`Original words in ${language.name}`, language.code);
      expect(result.contentType).toMatch(/^audio\//);
      const sent = requested.at(-1)!;
      if (language.code === "en" || language.code === "af") {
        expect(sent.body.language_code).toBe(language.code);
        expect(sent.body.model_id).toBe(
          language.code === "af" ? "eleven_v3" : "eleven_multilingual_v2",
        );
        expect(result.preview).toBe(false);
      } else {
        expect(sent.body.contents[0].parts[0].text).toContain(`in ${language.name}`);
        expect(sent.body.contents[0].parts[0].text).toContain("Do not translate into English");
        expect(result.preview).toBe(true);
      }
    }
    expect(requested).toHaveLength(11);
  });
  test("sign language is never presented as speech", async () => {
    await expect(synthesizeVoice("Hello", "sasl")).rejects.toThrow("signed");
  });
  test("transcription preserves detected language and returns uncertainty", async () => {
    process.env.GEMINI_API_KEY = "test";
    globalThis.fetch = (async (_url: any, options: any) => {
      const request = JSON.parse(options.body);
      expect(request.contents[0].parts[0].text).toContain("automatically");
      expect(request.systemInstruction.parts[0].text).toContain("Do not answer");
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                { text: JSON.stringify({ text: "Sawubona", language: "zul", uncertain: false }) },
              ],
            },
          },
        ],
      });
    }) as typeof fetch;
    expect(await transcribeVoice(new Blob(["audio"], { type: "audio/webm;codecs=opus" }))).toEqual({
      text: "Sawubona",
      language: "zu",
      uncertain: true,
    });
  });
  test("invalid recordings never reach the transcription provider", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response();
    }) as typeof fetch;
    await expect(transcribeVoice(new Blob(["no"], { type: "text/html" }))).rejects.toThrow(
      "format",
    );
    expect(called).toBe(false);
  });
});

describe("unclear recording recovery", () => {
  const empty = { text: "", language: "auto", uncertain: true };
  const phrase =
    "Lalingakanani izinga lentswela ngqesho eMzantsi Afrika kwikota yesibini yonyaka ka 2025?";
  function mockRecognition(secondary: Record<string, unknown> | null, primary = empty) {
    process.env.GEMINI_API_KEY = "test-primary";
    process.env.ELEVENLABS_API_KEY = "test-secondary";
    const calls: Array<{ url: string; options: RequestInit }> = [];
    globalThis.fetch = (async (url: Parameters<typeof fetch>[0], options: RequestInit) => {
      calls.push({ url: String(url), options });
      if (String(url).includes("speech-to-text"))
        return secondary ? Response.json(secondary) : new Response("Unavailable", { status: 502 });
      return Response.json({
        candidates: [{ content: { parts: [{ text: JSON.stringify(primary) }] } }],
      });
    }) as typeof fetch;
    return calls;
  }
  test("unclear audio recovers a documented language without forcing an English hint", async () => {
    const calls = mockRecognition({
      text: phrase,
      language_code: "xho",
      language_probability: 0.98,
    });
    expect(await transcribeVoice(new Blob(["audio"], { type: "audio/wav" }))).toEqual({
      text: phrase,
      language: "xh",
      uncertain: false,
    });
    expect(calls).toHaveLength(2);
    const form = calls[1]!.options.body as FormData;
    expect(form.get("model_id")).toBe("scribe_v2");
    expect(form.get("language_code")).toBeNull();
    expect(form.get("file")).toBeInstanceOf(Blob);
  });
  test("low or missing language confidence still requires confirmation", async () => {
    for (const probability of [0.4, undefined, 1.1]) {
      mockRecognition({ text: phrase, language_code: "xho", language_probability: probability });
      const result = await transcribeVoice(new Blob(["audio"], { type: "audio/wav" }));
      expect(result.uncertain).toBe(true);
      expect(result.language).toBe("auto");
    }
  });
  test("an unsupported explicit language never goes to the narrower recognizer", async () => {
    for (const language of ["st", "tn", "ss", "ve", "ts", "nr"]) {
      const calls = mockRecognition({
        text: phrase,
        language_code: "xho",
        language_probability: 1,
      });
      expect(await transcribeVoice(new Blob(["audio"], { type: "audio/wav" }), language)).toEqual(
        empty,
      );
      expect(calls).toHaveLength(1);
    }
  });
  test("an identified preview language is not replaced with a supported-language guess", async () => {
    const primary = { text: "Ngicela tibalo", language: "ss", uncertain: true };
    const calls = mockRecognition(
      { text: "Ngicela izibalo", language_code: "zul", language_probability: 1 },
      primary,
    );
    expect(await transcribeVoice(new Blob(["audio"], { type: "audio/wav" }))).toEqual(primary);
    expect(calls).toHaveLength(1);
  });
  test("a supported hint is forwarded, but the actual returned language is preserved", async () => {
    const calls = mockRecognition({ text: phrase, language_code: "xho", language_probability: 1 });
    const result = await transcribeVoice(new Blob(["audio"], { type: "audio/wav" }), "xh");
    expect((calls[1]!.options.body as FormData).get("language_code")).toBe("xh");
    expect(result.language).toBe("xh");
  });
  test("short shared greetings cannot bypass uncertainty through recovery", async () => {
    mockRecognition({ text: "Sawubona", language_code: "zul", language_probability: 1 });
    expect((await transcribeVoice(new Blob(["audio"], { type: "audio/wav" }))).uncertain).toBe(
      true,
    );
  });
  test("unsupported recognition and provider failure preserve the original result", async () => {
    for (const secondary of [
      null,
      { text: "Words", language_code: "fra", language_probability: 1 },
    ]) {
      mockRecognition(secondary);
      expect(await transcribeVoice(new Blob(["audio"], { type: "audio/wav" }))).toEqual(empty);
    }
  });
});

function fakeDB(ownerMatches: boolean, changed = false) {
  const reads: string[] = [];
  const rows: Record<string, unknown> = {
    visitor_identifiers: { visitor_id: "owner" },
    conversations: { visitor_id: ownerMatches ? "owner" : "someone-else" },
    conversation_turns: { answer_id: "answer-id" },
    answers: {
      public_ref: "ANS-test",
      question_text: "question",
      outcome: "answered",
      reading_level: "short",
      official_blocks: [],
      ai_explanation: "Safe answer",
      caveats: [],
      follow_ups: [],
      clarification: null,
      gap_description: null,
      review_reasons: [],
      created_at: "2026-09-18",
      language: "af",
      review_flag: changed ? "source_changed" : "none",
      ai_provider: "private-provider",
      ai_model: "private-model",
    },
  };
  const db = {
    from(table: string) {
      reads.push(table);
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        not() {
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        async maybeSingle() {
          return { data: rows[table], error: null };
        },
      };
      return query;
    },
  };
  return { db: db as unknown as Parameters<typeof readVoiceEvidence>[0], reads };
}

describe("live evidence ownership", () => {
  test("wrong owner cannot read an answer", async () => {
    const { db, reads } = fakeDB(false);
    expect(await readVoiceEvidence(db, "conversation", "browser-token")).toBeNull();
    expect(reads).not.toContain("answers");
  });
  test("owner receives public fields without model details", async () => {
    const { db } = fakeDB(true);
    const result = await readVoiceEvidence(db, "conversation", "browser-token");
    expect(result?.language).toBe("af");
    expect(result?.provider).toBeNull();
    expect(JSON.stringify(result)).not.toContain("private-provider");
  });
  test("source-changed evidence fails closed", async () => {
    const { db } = fakeDB(true, true);
    expect(await readVoiceEvidence(db, "conversation", "browser-token")).toBeNull();
  });
});
