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
const callInstructions = originalCallInstructions
  .replace(/LANGUAGE\n[\s\S]*?\nMANNER/, "MANNER")
  .replaceAll("Naledi", "Kaya")
  .replace(/CONTACT DETAILS\n[\s\S]*?\nMEDIA AND JOURNALISTS/, `CONTACT DETAILS
Ask who you are speaking with aloud, naturally during the call: a name and one email address or telephone number. If known_name is known, use it and do not repeatedly ask for the same details. Confirm an unclear name or contact by voice. Ask explicitly whether the caller agrees to retaining those details to handle their enquiry and allow follow-up. Call save_contact with full_name, email or phone and consent true only after an explicit yes. Never invent missing details or infer consent from someone merely giving a name. If they decline, continue answering ordinary public statistical questions without storing details. Follow the tool's spoken request for anything missing; say details are saved only when it reports saved true. Do not send the caller to a contact form.

MEDIA AND JOURNALISTS`)
  .replace(/SENSITIVE MATTERS\n[\s\S]*?\nSPEAKING TO A PERSON/, `SENSITIVE MATTERS
Anything asking for interpretation, cause, judgement, an official position, a forecast, personal or confidential data, or anything contested requires an official. Do not give an unsupported substantive answer. Explain this aloud, collect any missing name and contact and explicit spoken permission using save_contact, then call request_human. Never promise that a person has joined or will call at a particular time.

SPEAKING TO A PERSON`)
  .replace(/SPEAKING TO A PERSON\n[\s\S]*?\nCASE STATUS/, `SPEAKING TO A PERSON
If the caller asks for a human at any point, acknowledge it immediately. Collect missing name and one email address or phone number by voice, ask explicit permission to retain it for follow-up, and call save_contact. Once saved, call request_human with the actual short summary and reason. Follow the tool's spoken result: if it needs more information, ask aloud and then retry; never claim a handoff was logged if it failed. If an officer_phone is returned, read only that returned number slowly and offer to repeat it. A logged request is an official follow-up request, not a connected live transfer or guaranteed callback time. When you genuinely cannot resolve the enquiry, offer this same spoken handoff. Never instruct the caller to click Speak to a person or fill in a form.

CASE STATUS`);
const prompt = `${PERSONA}\n\n${VOICE_STYLE}\n\nLIVE CONVERSATION LANGUAGE\nDetect and follow the caller's language automatically on every turn. Use the language_detection tool for the live engine's configured language presets, including switches during the conversation. Never ask the caller to select a language from a menu, click a button, send a recording, or use a separate language screen. Pass the original question and detected language to answer_question. Never force English as a default. If you cannot understand speech, ask a short spoken clarification. Never claim a spoken language is supported when the live engine cannot render it; explain that limitation honestly and offer an official's assistance by voice.\n\n${callInstructions}\n\nThe language and persona rules above override any old English-only wording. This is a continuous voice conversation: identification, permission, clarification and escalation happen through speech, not forms or manual submission controls. Every substantive answer must come from answer_question. Never read an internal draft or unreleased response. A media or sensitive request only receives the returned acknowledgement. Before log_media_enquiry, collect the journalist name, outlet, contact and exact question by voice. Ask explicitly whether the caller consents to keeping these details for this enquiry. Only set consent true after an explicit yes; never infer permission, fabricate details or substitute Caller/Not given. If permission is declined, do not submit the media case. Pass conversation_id and browser_token dynamic variables to each tool unchanged.`;
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
    // Include the existing model when validating its language presets; do not change the voice.
    tts: config.tts,
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
      interaction: "continuous live voice; no forms or language selector",
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
  for (const name of ["save_contact", "request_human"]) {
    const index = config.agent.prompt.tools.findIndex((tool: { name: string }) => tool.name === name);
    const id = config.agent.prompt.tool_ids[index];
    if (!id) throw new Error(`The existing ${name} tool is missing.`);
    const toolUrl = `https://api.elevenlabs.io/v1/convai/tools/${id}`;
    const currentResponse = await fetch(toolUrl, { headers });
    if (!currentResponse.ok) throw new Error(`${name} could not be read (${currentResponse.status}).`);
    const current = await currentResponse.json();
    writeFileSync(join(backup, `${name}-before.json`), JSON.stringify(current, null, 2), { mode: 0o600 });
    const tool = current.tool_config;
    if (name === "save_contact") {
      const schema = tool.api_schema.request_body_schema;
      schema.properties.consent = {
        type: "boolean",
        description: "True only after the caller explicitly agrees aloud to retaining their details for this enquiry and follow-up. Providing details alone is not consent.",
      };
      schema.required = Array.from(new Set([...(schema.required ?? []), "full_name", "consent"]));
      tool.description = "Save the caller's actual name and one email address or phone number only after explicit spoken consent. Ask for missing details aloud. Do not invent values or direct the caller to a form. Follow the returned spoken message; confirm storage only when saved is true.";
    } else {
      tool.description = "Log a request for official assistance when the caller asks for a human or needs escalation. First use save_contact for missing name, one contact method and explicit spoken permission. Follow the returned spoken result; a request is not a connected live transfer or guaranteed callback. Never instruct the caller to click a button or fill a form.";
    }
    const updated = await fetch(toolUrl, { method: "PATCH", headers, body: JSON.stringify({ tool_config: tool }) });
    if (!updated.ok) throw new Error(`${name} update failed (${updated.status}).`);
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
