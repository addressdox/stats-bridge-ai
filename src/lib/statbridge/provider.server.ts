/**
 * Replaceable server-side AI provider interface.
 *
 * The assistant never reaches the browser. It is only ever given approved,
 * public source extracts and it may only propose evidence ids and plain
 * wording. Swapping provider means implementing `AssistantProvider` and
 * returning it from `getAssistant()`.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export type AssistantProvider = {
  name: string;
  model: string;
  /** Returns raw model text. Callers parse and validate it themselves. */
  complete(input: { system: string; prompt: string }): Promise<string>;
};

const GATEWAY_MODEL = "openai/gpt-6-astra";

function lovableGateway(apiKey: string): AssistantProvider {
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey, // satisfies the SDK; the gateway authenticates on the header below
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

  return {
    name: "Lovable AI",
    model: GATEWAY_MODEL,
    async complete({ system, prompt }) {
      // Reasoning models can run for minutes: stream and consume server-side
      // so the request is never severed mid-generation by a silent buffer.
      const result = streamText({
        model: provider.responses(GATEWAY_MODEL),
        system,
        prompt,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      return await result.text;
    },
  };
}

function directGemini(apiKey: string): AssistantProvider {
  const model = process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash";
  return {
    name: "Google Gemini (direct API key)",
    model,
    async complete({ system, prompt }) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          }),
        },
      );
      if (!response.ok) {
        throw new AssistantUnavailable(`Gemini returned ${response.status}`, response.status);
      }
      const body = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    },
  };
}

export class AssistantUnavailable extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = "AssistantUnavailable";
    this.status = status;
  }
}

/** Prefers a project-owned Gemini key, falls back to the managed gateway. */
export function getAssistant(): AssistantProvider {
  const own = process.env["GEMINI_API_KEY"];
  if (own) return directGemini(own);
  const gateway = process.env["LOVABLE_API_KEY"];
  if (gateway) return lovableGateway(gateway);
  throw new AssistantUnavailable("No AI provider is configured on the server.", 503);
}

/** Extracts the first JSON object from a model reply, tolerating code fences. */
export function parseModelJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The assistant did not return a usable reply.");
  return JSON.parse(candidate.slice(start, end + 1));
}
