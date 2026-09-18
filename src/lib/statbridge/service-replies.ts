/** Product help is authored service wording, never statistical evidence. */
export const SERVICE_INTENTS = ["greeting", "about", "usage", "languages", "thanks", "conversation"] as const;
export type ServiceIntent = (typeof SERVICE_INTENTS)[number];

const INTRODUCTION = "I'm Naledi. I help you find and understand published Statistics South Africa figures, definitions and releases. You can ask by voice or type, and I'll show the available source material with statistical answers. What would you like to know?";

const SERVICE_REPLIES: Record<ServiceIntent, string> = {
  greeting: `Hello! ${INTRODUCTION}`,
  about: INTRODUCTION,
  usage: "Ask me about a published South African statistic, definition or release, by voice or typing. Tell me the topic, place and period you're interested in, and you can ask follow-up questions. I show the available source material with statistical answers. If you need an official's help, you can ask me to send your enquiry to a person.",
  languages: "You can ask in English, Afrikaans, isiZulu, isiXhosa, Sepedi, Sesotho, Setswana, siSwati, Tshivenda, Xitsonga or isiNdebele. I follow the language you use, and you can tell me if you want to switch. South African Sign Language is visual, so it isn't available as spoken audio here.",
  thanks: "You're welcome. I'm here if you have another question about South Africa's published statistics.",
  conversation: "I'm here to help. What would you like to talk about?",
};

export function serviceReply(intent: ServiceIntent, conversationalReply?: string | null) {
  return {
    text: intent === "conversation" && conversationalReply ? conversationalReply : SERVICE_REPLIES[intent],
    followUps: intent === "thanks" || intent === "conversation" ? [] : [
      "Show me the latest published unemployment figures.",
      "How does Stats SA define unemployment?",
      "Where can I find the latest Census results?",
    ],
  };
}
