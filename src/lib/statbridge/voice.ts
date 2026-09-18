import type { PublicAnswer } from "./contract";

/** Only the public, governed answer is eligible for speech. Internal drafts never enter this shape. */
export function spokenAnswer(answer: PublicAnswer): string {
  if (answer.outcome === "escalated") {
    return (
      answer.officialBlocks
        .filter((block) => block.type === "case_acknowledgement")
        .map((block) => block.message)
        .join(" ") || "Your request has been sent to an official for review."
    );
  }
  if (answer.outcome === "clarification")
    return answer.clarification?.question || answer.aiExplanation || "";
  if (answer.outcome !== "answered") return answer.gapDescription || answer.aiExplanation || "";
  if (answer.aiExplanation) return answer.aiExplanation;
  return answer.officialBlocks
    .map((block) => {
      if (block.type === "metric")
        return `${block.label}: ${block.displayValue}, ${block.referencePeriod}. ${block.source.title}.`;
      if (block.type === "official_quote") return `${block.text} ${block.source.title}.`;
      if (block.type === "definition") return block.officialText;
      return "";
    })
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

/** A RIFF header makes raw model PCM playable by HTMLAudioElement. */
export function pcmToWav(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  const wav = new Uint8Array(44 + pcm.byteLength);
  const view = new DataView(wav.buffer);
  const write = (offset: number, value: string) =>
    Array.from(value).forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  wav.set(pcm, 44);
  return wav;
}

export const AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
];
export const MAX_VOICE_BYTES = 12 * 1024 * 1024;
export const VOICE_PREVIEW_LANGUAGES = ["zu", "xh", "nso", "st", "tn", "nr", "ss", "ts", "ve"];
