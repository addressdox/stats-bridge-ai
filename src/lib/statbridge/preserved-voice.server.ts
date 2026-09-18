import { VoiceError } from "./voice.server";

type VoiceProfile = { voiceId: string; stability: number; similarity: number; speed: number };
let cachedProfile: { agentId: string; until: number; profile: VoiceProfile } | undefined;

/** Read the actual live agent voice, not the older recorded-answer fallback voice. */
export async function readPreservedVoice(signal?: AbortSignal): Promise<VoiceProfile> {
  const key = process.env["ELEVENLABS_API_KEY"];
  const agentId = process.env["ELEVENLABS_AGENT_ID"];
  if (!key || !agentId) throw new VoiceError("The voice line is not available just now.", 503);
  if (cachedProfile?.agentId === agentId && cachedProfile.until > Date.now())
    return cachedProfile.profile;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": key }, signal: signal ?? AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw new VoiceError("The voice line is not available just now.");
  const data = (await response.json()) as {
    conversation_config?: {
      tts?: { voice_id?: string; stability?: number; similarity_boost?: number; speed?: number };
    };
  };
  const tts = data.conversation_config?.tts;
  if (!tts?.voice_id || !/^[a-zA-Z0-9_-]+$/.test(tts.voice_id))
    throw new VoiceError("The voice line is not available just now.");
  const bounded = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
      ? value
      : fallback;
  const profile = {
    voiceId: tts.voice_id,
    stability: bounded(tts.stability, 0.5, 0, 1),
    similarity: bounded(tts.similarity_boost, 0.82, 0, 1),
    speed: bounded(tts.speed, 0.97, 0.7, 1.2),
  };
  cachedProfile = { agentId, until: Date.now() + 300000, profile };
  return profile;
}

/** The original woman's voice remains the only renderer for English and Afrikaans. */
export async function streamPreservedVoice(text: string, language: string, signal: AbortSignal) {
  if (language !== "en" && language !== "af")
    throw new VoiceError("This voice route is for English and Afrikaans.", 422);
  const profile = await readPreservedVoice(signal);
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${profile.voiceId}/stream?output_format=pcm_24000`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env["ELEVENLABS_API_KEY"]!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        language_code: language,
        model_id: "eleven_v3",
        voice_settings: {
          // v3 accepts these stability settings; retain the agent's closest setting.
          stability: profile.stability < 0.25 ? 0 : profile.stability > 0.75 ? 1 : 0.5,
          similarity_boost: profile.similarity,
          speed: profile.speed,
          use_speaker_boost: true,
        },
      }),
      signal,
    },
  );
  if (!response.ok || !response.body)
    throw new VoiceError("Your usual voice could not be played. Please try the call again.");
  return response.body;
}
