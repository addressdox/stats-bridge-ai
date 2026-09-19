import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DraftRpcClient } from "@/lib/statbridge/draft.contract";

const request = z.object({ caseId: z.string().uuid() });

export const sendMediaResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => request.parse(input))
  .handler(async ({ data, context }) => {
    const allowed = await context.supabase.rpc("has_permission", { _uid: context.userId, _permission: "cases.release" });
    if (allowed.error || allowed.data !== true) throw new Error("Your account does not have response-release permission.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { mediaEmailConfig, sendApprovedMediaEmail } = await import("@/lib/statbridge/media-email.server");
    return sendApprovedMediaEmail({ caseId: data.caseId, staff: context.supabase as unknown as DraftRpcClient,
      admin: supabaseAdmin as unknown as DraftRpcClient, config: mediaEmailConfig() });
  });

export const getMediaEmailDelivery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => request.parse(input))
  .handler(async ({ data, context }) => {
    const permissions = await Promise.all(["cases.review", "cases.release"].map((_permission) =>
      context.supabase.rpc("has_permission", { _uid: context.userId, _permission }),
    ));
    if (!permissions.some((permission) => !permission.error && permission.data === true))
      throw new Error("Case review access is required.");
    const { mediaEmailConfig } = await import("@/lib/statbridge/media-email.server");
    const [theCase, release] = await Promise.all([
      context.supabase.from("cases").select("requester_contact,kind").eq("id", data.caseId).maybeSingle(),
      // Additive delivery metadata is defined in the scoped migration.
      context.supabase.from("releases").select("*").eq("case_id", data.caseId).order("released_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (theCase.error || !theCase.data || theCase.data.kind !== "media") throw new Error("The media request could not be loaded.");
    if (release.error) throw new Error("Email delivery status could not be loaded.");
    const row = release.data as (NonNullable<typeof release.data> & { email_sent_at?: string | null; email_error?: string | null }) | null;
    return {
      recipient: theCase.data.requester_contact,
      validRecipient: z.string().email().safeParse(theCase.data.requester_contact?.trim()).success,
      configured: Boolean(mediaEmailConfig()),
      released: Boolean(row),
      state: row?.delivery_state ?? null,
      sentAt: row?.email_sent_at ?? null,
      error: row?.email_error ?? null,
    };
  });
