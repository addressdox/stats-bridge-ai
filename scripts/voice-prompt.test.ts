import { describe, expect, test } from "bun:test";
import { PERSONA, VOICE_STYLE } from "../src/lib/statbridge/persona";
import { buildHostedVoicePrompt } from "./voice-prompt";

const callInstructions = `You are Naledi, the public information desk for Statistics South Africa. You speak with callers on a live telephone-style line.

WHO YOU ARE
Calm, warm, precise and unhurried.

THE ONE UNBREAKABLE RULE
Every statistic must come from answer_question.

HOW A CALL RUNS
Greet briefly: "Stats South Africa information desk, Naledi speaking. How can I help you?"

CONTACT DETAILS
Ask for contact details.

MEDIA AND JOURNALISTS
Call log_media_enquiry and never answer substantively.

SENSITIVE MATTERS
Refer sensitive enquiries to an official.

SPEAKING TO A PERSON
Collect contact details and call request_human.

CASE STATUS
Call check_case_status with the caller's reference and private token.

MANNER
Use the published figures.

CUSTOM DESK RULE
Retain this organisation-specific instruction exactly.`;

const count = (value: string, text: string) => value.split(text).length - 1;

describe("hosted Naledi prompt migration", () => {
  test("an already wrapped prompt remains unchanged across repeated syncs", () => {
    const wrapped = buildHostedVoicePrompt(callInstructions);
    expect(buildHostedVoicePrompt(wrapped)).toBe(wrapped);
    expect(count(wrapped, "Who you are:")).toBe(1);
    expect(count(wrapped, "LIVE CONVERSATION LANGUAGE\n")).toBe(1);
    expect(count(wrapped, "WHO YOU ARE\n")).toBe(1);
    expect(count(wrapped, "The language and persona rules above override")).toBe(1);
    expect(wrapped).toContain("Retain this organisation-specific instruction exactly.");
    expect(wrapped).toContain(
      "Call check_case_status with the caller's reference and private token.",
    );
  });

  test("a custom persona and preamble are preserved instead of discarded or duplicated", () => {
    const customPersona = PERSONA.replace(
      "You never talk down to anyone.",
      "You never talk down to anyone. Preserve this custom approved wording.",
    );
    const existing = `CUSTOM PREAMBLE\nKeep the desk's opening policy.\n\n${customPersona}\n\n${VOICE_STYLE}\n\n${callInstructions}`;
    const migrated = buildHostedVoicePrompt(existing);
    expect(migrated).toContain(customPersona);
    expect(migrated).toContain("CUSTOM PREAMBLE\nKeep the desk's opening policy.");
    expect(count(migrated, "Who you are:")).toBe(1);
    expect(count(migrated, "Spoken delivery:")).toBe(1);
    expect(buildHostedVoicePrompt(migrated)).toBe(migrated);
  });

  test("legacy identities migrate to Naledi without undoing language and evidence safeguards", () => {
    const previous = callInstructions
      .replaceAll("Naledi", "Kaya")
      .replace("public information desk for Statistics South Africa", "voice of StatBridge");
    const migrated = buildHostedVoicePrompt(previous);
    expect(migrated).not.toMatch(/\bKaya\b|StatBridge/);
    expect(migrated).toContain("Stats South Africa information desk, Naledi speaking.");
    expect(migrated).toContain("language_detection tool");
    expect(migrated).not.toContain("set_language");
    expect(migrated).toContain("Every statistic must come from answer_question.");
    expect(migrated).toContain("consent true only after an explicit yes");
    expect(migrated).toContain("If permission is declined, do not submit the media case.");
    expect(migrated).toContain(
      "Pass conversation_id and browser_token dynamic variables to each tool unchanged.",
    );
  });

  test("removing an obsolete standalone language policy cannot erase live call policies", () => {
    const old = callInstructions.replace(
      "MANNER\n",
      "LANGUAGE\nThen continue in English.\n\nMANNER\n",
    );
    const migrated = buildHostedVoicePrompt(old);
    expect(migrated).not.toContain("Then continue in English");
    expect(migrated).toContain("MEDIA AND JOURNALISTS\n");
    expect(migrated).toContain("SENSITIVE MATTERS\n");
    expect(migrated).toContain("CASE STATUS\n");
    expect(migrated).toContain("MANNER\nUse the published figures.");
    expect(buildHostedVoicePrompt(migrated)).toBe(migrated);
  });
});
