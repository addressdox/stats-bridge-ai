import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getVoiceEvidence = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ conversationId: z.string().uuid(), browserToken: z.string().min(8).max(80) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./pipeline.server");
    const { readVoiceEvidence } = await import("./voice-evidence.server");
    return readVoiceEvidence(await getAdminClient(), data.conversationId, data.browserToken);
  });
