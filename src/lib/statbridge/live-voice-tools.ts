import { SOUTH_AFRICAN_LANGUAGES } from "./languages";

/** Provider-neutral declarations; credentials and conversation ownership never belong in tool arguments. */
export const LIVE_VOICE_TOOL_ACTIONS = {
  answer_question: "answer",
  save_contact: "contact",
  request_human: "human",
  check_case_status: "case-status",
  log_media_enquiry: "media",
} as const;

export type LiveVoiceToolName = keyof typeof LIVE_VOICE_TOOL_ACTIONS;
export const LIVE_VOICE_TOOL_NAMES = Object.keys(LIVE_VOICE_TOOL_ACTIONS) as [
  LiveVoiceToolName,
  ...LiveVoiceToolName[],
];

const language = {
  type: "STRING",
  description:
    "The caller's current spoken or requested language. Use auto when uncertain; never translate their question to English before calling.",
  enum: ["auto", ...SOUTH_AFRICAN_LANGUAGES.filter((item) => item.spoken).map((item) => item.code)],
};
const text = (description: string) => ({ type: "STRING", description });
const consent = {
  type: "BOOLEAN",
  description:
    "True only after the caller explicitly agrees to storing the supplied details for this request. Never infer permission. Do not submit details if permission is declined.",
};

export const functionDeclarations = [
  {
    name: "answer_question",
    description:
      "Retrieve a governed Stats SA answer before stating any statistic, publication, figure or substantive statistical explanation. Preserve the original spoken question. Speak only the returned public wording; an escalation receives only its acknowledgement.",
    parameters: {
      type: "OBJECT",
      properties: {
        question: text(
          "The caller's complete original question in their language, without changing its meaning.",
        ),
        language,
      },
      required: ["question"],
    },
  },
  {
    name: "save_contact",
    description:
      "Save the caller's actual name and one email address or phone number after explicit spoken permission. Collect missing details conversationally. Claim saved only when the result says saved:true.",
    parameters: {
      type: "OBJECT",
      properties: {
        full_name: text("The caller's name, not a placeholder."),
        email: text("The email address the caller supplied, if any."),
        phone: text("The phone number the caller supplied, if any."),
        organisation: text("Organisation, only if supplied."),
        consent,
        language,
      },
      required: ["full_name", "consent"],
    },
  },
  {
    name: "request_human",
    description:
      "Request an official using the caller's saved, consented contact details. If details are missing, ask aloud and use save_contact first. Confirm a request only from the returned result; never promise an instant transfer or response time.",
    parameters: {
      type: "OBJECT",
      properties: {
        summary: text(
          "A short accurate summary of what the caller wants an official to help with.",
        ),
        reason: {
          type: "STRING",
          enum: [
            "visitor_request",
            "media",
            "sensitive",
            "unsupported",
            "low_confidence",
            "complaint",
            "other",
          ],
        },
        urgency: { type: "STRING", enum: ["low", "normal", "high", "urgent"] },
        topic: text("The caller's topic, if known."),
        language,
      },
      required: ["summary"],
    },
  },
  {
    name: "check_case_status",
    description:
      "Check a private request only with the reference and private token supplied by its requester. Never guess either value.",
    parameters: {
      type: "OBJECT",
      properties: {
        reference: text("The caller's case reference."),
        token: text("The private status token provided by the caller."),
        language,
      },
      required: ["reference", "token"],
    },
  },
  {
    name: "log_media_enquiry",
    description:
      "Log a journalist's enquiry after collecting name, outlet, contact, question and explicit permission aloud. Return only its acknowledgement and reference, never an internal draft or substantive media answer.",
    parameters: {
      type: "OBJECT",
      properties: {
        question: text("The media enquiry in the caller's original language."),
        name: text("Journalist's actual name."),
        outlet: text("Their media outlet."),
        contact: text("Email address or phone number supplied for the official reply."),
        deadline: text("Their deadline, only if supplied."),
        consent,
        language,
      },
      required: ["question", "name", "outlet", "contact", "consent"],
    },
  },
];

/** Trusted session fields are supplied by the application, never by the model. */
export function liveVoiceToolValues(args: Record<string, unknown>): Record<string, unknown> {
  const values = { ...args };
  for (const key of [
    "conversationId",
    "conversation_id",
    "browserToken",
    "browser_token",
    "tool",
    "spoken",
    "channel",
    "parentAnswerRef",
    "parent_answer_ref",
  ])
    delete values[key];
  return values;
}
