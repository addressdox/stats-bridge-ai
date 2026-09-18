/** Private drafting assistance; release remains a separate permissioned decision. */
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { draftEvidenceSchema, type DraftRpcClient } from "@/lib/statbridge/draft.contract";
export type { DraftSuggestion } from "@/lib/statbridge/case-drafting.server";

const format = z.enum(["general_reply", "faq_answer", "short_media_statement"]);
async function canReview(context: {
  userId: string;
  supabase: {
    rpc(
      name: "has_permission",
      args: { _uid: string; _permission: string },
    ): PromiseLike<{ data: boolean | null; error: unknown }>;
  };
}) {
  const permission = await context.supabase.rpc("has_permission", {
    _uid: context.userId,
    _permission: "cases.review",
  });
  if (permission.error || permission.data !== true)
    throw new Error("Your account does not have case review access.");
}
export const suggestDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        instruction: z.string().trim().max(600).default(""),
        format: format.default("general_reply"),
        basedOn: z.string().trim().max(16000).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await canReview(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { prepareCaseDraft } = await import("@/lib/statbridge/case-drafting.server");
    const result = await prepareCaseDraft(supabaseAdmin, {
      ...data,
      basedOn: data.basedOn ?? null,
    });
    // Provider configuration stays server-side; staff need the evidence, not vendor identities.
    return {
      body: result.body,
      gaps: result.gaps,
      evidence: result.evidence,
      guidelineId: result.guidelineId,
      language: result.language,
    };
  });

export const saveReviewedDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        body: z.string().trim().min(1).max(16000),
        format,
        gaps: z.array(z.string().max(600)).max(12),
        evidence: z.array(draftEvidenceSchema).max(48).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await canReview(context);
    const result = await (context.supabase as unknown as DraftRpcClient).rpc("save_review_draft", {
      _case_id: data.caseId,
      _body: data.body,
      _format: data.format,
      _gaps: data.gaps,
      _evidence: data.evidence,
    });
    if (result.error) throw new Error(result.error.message ?? "The draft could not be saved.");
    return { draftId: result.data as string };
  });

export const beginPressRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ topic: z.string().trim().min(10).max(1200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await canReview(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { makeStatusToken } = await import("@/lib/statbridge/pipeline.server");
    const { ensureCaseDraft } = await import("@/lib/statbridge/case-drafting.server");
    const opened = await db.rpc("open_case", {
      _kind: "public_escalation",
      _question: data.topic,
      _reasons: ["formal_approval"],
      _token_hash: makeStatusToken().hash,
      _channel: "web",
      _consent: false,
    });
    const theCase = Array.isArray(opened.data) ? opened.data[0] : opened.data;
    if (opened.error || !theCase) throw new Error("The communications draft could not be started.");
    const marked = await db
      .from("cases")
      .update({ routing_note: "staff_press_release", assigned_to: context.userId })
      .eq("id", theCase.id);
    if (marked.error) throw new Error("The communications draft could not be assigned.");
    await db.from("audit_events").insert({
      actor_id: context.userId,
      actor_role: "staff",
      action: "press_release_draft_requested",
      entity_kind: "case",
      entity_id: theCase.id,
      case_id: theCase.id,
      origin: "screen",
    });
    try {
      await ensureCaseDraft(db, theCase.id);
    } catch {
      /* Keep the case visible for retry in the review workbench. */
    }
    return { caseId: theCase.id, reference: theCase.reference };
  });
