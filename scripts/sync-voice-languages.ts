/** Run with `bun scripts/sync-voice-languages.ts --apply`; preserves the existing voice, tools and credentials. */
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PERSONA, VOICE_STYLE } from "../src/lib/statbridge/persona";

const key = process.env.ELEVENLABS_API_KEY;
const agentId = process.env.ELEVENLABS_AGENT_ID;
if (!key || !agentId) throw new Error("Voice configuration is missing.");
const headers = { "xi-api-key": key, "Content-Type": "application/json" };
const url = `https://api.elevenlabs.io/v1/convai/agents/${agentId}`;
const response = await fetch(url, { headers });
if (!response.ok) throw new Error(`Voice configuration could not be read (${response.status}).`);
const before = await response.json();
const config = before.conversation_config;
const existingPrompt = config.agent.prompt.prompt as string;
const originalCallInstructions = existingPrompt
  .replace(/^[\s\S]*?\n\n(You are Kaya, the voice of StatBridge)/, "$1")
  .split("\n\nThe language and persona rules above override")[0]!;
const prompt = `${PERSONA}\n\n${VOICE_STYLE}\n\nLIVE LINE LANGUAGE ROUTING\nThis live line supports English and Afrikaans speech. Detect the caller's language on every turn. Use the language_detection tool to switch between English and Afrikaans as soon as the caller speaks or asks in the other language. Never insist on English for an Afrikaans caller. For another South African language, tell the caller to choose 'Speak another South African language' for the multilingual speech preview. Never claim this live speech engine supports an unavailable language.\n\n${originalCallInstructions.replace(/LANGUAGE\n[\s\S]*?\nMANNER/, "MANNER").replaceAll("Naledi", "Kaya")}\n\nThe language and persona rules above override any old English-only wording. Send answer_question the original question and the caller's detected language code. The question must remain in the caller's language. Every substantive answer must come from answer_question. Never read an internal draft or unreleased response. A media or sensitive request only receives the returned acknowledgement. Before log_media_enquiry, collect the journalist name, outlet, contact and exact question. Ask explicitly whether the caller consents to keeping these details for this enquiry. Only set consent true after an explicit yes; never infer permission, fabricate details or substitute Caller/Not given. If permission is declined, do not submit the media case. Pass conversation_id and browser_token dynamic variables to each tool unchanged.`;
const patch = {
  conversation_config: {
    agent: {
      first_message:
        "Stats South Africa information desk, Kaya speaking. How can I help you today?",
      prompt: {
        prompt,
        built_in_tools: {
          ...config.agent.prompt.built_in_tools,
          language_detection: {
            type: "system",
            name: "language_detection",
            description:
              "Switch to English or Afrikaans whenever the caller speaks or explicitly requests it, including later turns.",
            params: { system_tool_type: "language_detection", only_at_conversation_start: false },
          },
        },
      },
    },
    tts: { model_id: "eleven_v3_conversational", stability: 0.5 },
    language_presets: {
      ...config.language_presets,
      af: {
        overrides: {
          agent: {
            first_message:
              "Stats Suid-Afrika se inligtingstoonbank, Kaya aan die woord. Hoe kan ek jou vandag help?",
          },
        },
      },
    },
  },
};
if (!process.argv.includes("--apply")) {
  console.log(
    JSON.stringify({
      mode: "preview",
      EnglishOnlyInstructionFound: existingPrompt.includes("Then continue in English"),
      languages: ["en", "af"],
      multilingualSpeechPreview: "handled by the application",
    }),
  );
} else {
  const backup = mkdtempSync(join(tmpdir(), "statbridge-voice-config-"));
  chmodSync(backup, 0o700);
  writeFileSync(join(backup, "agent-before.json"), JSON.stringify(before, null, 2), {
    mode: 0o600,
  });
  const changed = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(patch) });
  if (!changed.ok) {
    const detail = await changed.json().catch(() => ({}));
    writeFileSync(join(backup, "patch-error.json"), JSON.stringify(detail), { mode: 0o600 });
    throw new Error(
      `Voice configuration update failed (${changed.status}). Details saved in private backup ${backup}.`,
    );
  }
  const answerToolIndex = config.agent.prompt.tools.findIndex(
    (tool: { name: string }) => tool.name === "answer_question",
  );
  const answerToolId = config.agent.prompt.tool_ids[answerToolIndex];
  if (answerToolId) {
    const toolUrl = `https://api.elevenlabs.io/v1/convai/tools/${answerToolId}`;
    const currentResponse = await fetch(toolUrl, { headers });
    if (!currentResponse.ok)
      throw new Error(`Answer tool could not be read (${currentResponse.status}).`);
    const current = await currentResponse.json();
    writeFileSync(join(backup, "answer-tool-before.json"), JSON.stringify(current, null, 2), {
      mode: 0o600,
    });
    const tool = current.tool_config;
    tool.api_schema.request_body_schema.properties.question.description =
      "The caller's complete original question in their spoken language. Do not translate to English.";
    tool.api_schema.request_body_schema.properties.language.description =
      "The caller's detected or requested language code, such as en or af. Never default to English when the caller uses another language.";
    const updated = await fetch(toolUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ tool_config: tool }),
    });
    if (!updated.ok) throw new Error(`Answer tool update failed (${updated.status}).`);
  }
  const mediaToolIndex = config.agent.prompt.tools.findIndex(
    (tool: { name: string }) => tool.name === "log_media_enquiry",
  );
  const mediaToolId = config.agent.prompt.tool_ids[mediaToolIndex];
  if (mediaToolId) {
    const toolUrl = `https://api.elevenlabs.io/v1/convai/tools/${mediaToolId}`;
    const currentResponse = await fetch(toolUrl, { headers });
    if (!currentResponse.ok)
      throw new Error(`Media tool could not be read (${currentResponse.status}).`);
    const current = await currentResponse.json();
    writeFileSync(join(backup, "media-tool-before.json"), JSON.stringify(current, null, 2), {
      mode: 0o600,
    });
    const tool = current.tool_config;
    const schema = tool.api_schema.request_body_schema;
    schema.properties.consent = {
      type: "boolean",
      description:
        "True only after the caller explicitly agrees to keeping their details to handle this media enquiry. Never infer consent and do not submit if permission was declined.",
    };
    schema.properties.language = {
      type: "string",
      description:
        "The caller's requested or spoken language code. Preserve the enquiry in the caller's original language.",
    };
    schema.required = Array.from(
      new Set([...schema.required, "name", "outlet", "contact", "consent"]),
    );
    tool.description =
      "Log a media enquiry only after obtaining the journalist name, outlet, contact, question and explicit consent to retaining these details. Never answer the media question directly or invent missing details.";
    const updated = await fetch(toolUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ tool_config: tool }),
    });
    if (!updated.ok) throw new Error(`Media tool update failed (${updated.status}).`);
  }
  const verified = await fetch(url, { headers }).then((value) => value.json());
  console.log(
    JSON.stringify({
      updated: true,
      backup,
      model: verified.conversation_config.tts.model_id,
      languages: [
        verified.conversation_config.agent.language,
        ...Object.keys(verified.conversation_config.language_presets),
      ],
      languageDetection: Boolean(
        verified.conversation_config.agent.prompt.built_in_tools.language_detection,
      ),
      EnglishOnlyInstructionRemains: verified.conversation_config.agent.prompt.prompt.includes(
        "Then continue in English",
      ),
    }),
  );
}
