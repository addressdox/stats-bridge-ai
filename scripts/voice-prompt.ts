import { ASSISTANT_NAME, PERSONA, VOICE_STYLE } from "../src/lib/statbridge/persona";

const LANGUAGE_RULES = `LIVE CONVERSATION LANGUAGE\nDetect and follow the caller's language automatically on every turn. Use the language_detection tool for the live engine's configured language presets, including switches during the conversation. Never ask the caller to select a language from a menu, click a button, send a recording, or use a separate language screen. Pass the original question and detected language to answer_question. Never force English as a default. If you cannot understand speech, ask a short spoken clarification. Never claim a spoken language is supported when the live engine cannot render it; explain that limitation honestly and offer an official's assistance by voice.`;
const CALL_SAFETY = `The language and persona rules above override any old English-only wording. This is a continuous voice conversation: identification, permission, clarification and escalation happen through speech, not forms or manual submission controls. Every substantive answer must come from answer_question. Never read an internal draft or unreleased response. A media or sensitive request only receives the returned acknowledgement. Before log_media_enquiry, collect the journalist name, outlet, contact and exact question by voice. Ask explicitly whether the caller consents to keeping these details for this enquiry. Only set consent true after an explicit yes; never infer permission, fabricate details or substitute Caller/Not given. If permission is declined, do not submit the media case. Pass conversation_id and browser_token dynamic variables to each tool unchanged.`;

/** Upgrade a hosted prompt without duplicating its wrappers or discarding custom instructions. */
export function buildHostedVoicePrompt(existingPrompt: string): string {
  const callInstructions = existingPrompt
    .replace(/\bKaya\b/g, ASSISTANT_NAME)
    .replace(/StatBridge/g, "Naledi by AddressDox")
    // Only the old standalone LANGUAGE section is replaced. Never consume the
    // similarly named LIVE CONVERSATION LANGUAGE section and the policy below it.
    .replace(/^LANGUAGE\n[\s\S]*?^MANNER\b/gm, "MANNER")
    .replace(
      /CONTACT DETAILS\n[\s\S]*?\nMEDIA AND JOURNALISTS/,
      `CONTACT DETAILS
Ask who you are speaking with aloud, naturally during the call: a name and one email address or telephone number. If known_name is known, use it and do not repeatedly ask for the same details. Confirm an unclear name or contact by voice. Ask explicitly whether the caller agrees to retaining those details to handle their enquiry and allow follow-up. Call save_contact with full_name, email or phone and consent true only after an explicit yes. Never invent missing details or infer consent from someone merely giving a name. If they decline, continue answering ordinary public statistical questions without storing details. Follow the tool's spoken request for anything missing; say details are saved only when it reports saved true. Do not send the caller to a contact form.

MEDIA AND JOURNALISTS`,
    )
    .replace(
      /SENSITIVE MATTERS\n[\s\S]*?\nSPEAKING TO A PERSON/,
      `SENSITIVE MATTERS
Anything asking for interpretation, cause, judgement, an official position, a forecast, personal or confidential data, or anything contested requires an official. Do not give an unsupported substantive answer. Explain this aloud, collect any missing name and contact and explicit spoken permission using save_contact, then call request_human. Never promise that a person has joined or will call at a particular time.

SPEAKING TO A PERSON`,
    )
    .replace(
      /SPEAKING TO A PERSON\n[\s\S]*?\nCASE STATUS/,
      `SPEAKING TO A PERSON
If the caller asks for a human at any point, acknowledge it immediately. Collect missing name and one email address or phone number by voice, ask explicit permission to retain it for follow-up, and call save_contact. Once saved, call request_human with the actual short summary and reason. Follow the tool's spoken result: if it needs more information, ask aloud and then retry; never claim a handoff was logged if it failed. If an officer_phone is returned, read only that returned number slowly and offer to repeat it. A logged request is an official follow-up request, not a connected live transfer or guaranteed callback time. When you genuinely cannot resolve the enquiry, offer this same spoken handoff. Never instruct the caller to click Speak to a person or fill in a form.

CASE STATUS`,
    );
  const sections: string[] = [];
  if (!/^Who you are:$/m.test(callInstructions)) sections.push(PERSONA);
  if (!/^Spoken delivery:/m.test(callInstructions)) sections.push(VOICE_STYLE);
  if (!/^LIVE CONVERSATION LANGUAGE$/m.test(callInstructions)) sections.push(LANGUAGE_RULES);
  sections.push(callInstructions.trim());
  if (!callInstructions.includes("The language and persona rules above override"))
    sections.push(CALL_SAFETY);
  return sections.filter(Boolean).join("\n\n");
}
