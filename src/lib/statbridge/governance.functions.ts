import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Ctx = {
  userId: string;
  supabase: {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>;
  };
};
async function allowed(context: Ctx, key: string) {
  const r = await context.supabase.rpc("has_permission", {
    _uid: context.userId,
    _permission: key,
  });
  if (r.error || r.data !== true) throw new Error(`Your account does not have ${key} access.`);
  return context.userId;
}

export const listGuidelines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await allowed(context as never, "guidelines.view");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data, error } = await db
      .from("guidelines")
      .select("*")
      .order("version_number", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const guideline = z.object({
  title: z.string().trim().min(3).max(160),
  changeSummary: z.string().trim().min(3).max(1000),
  identityRules: z.string().trim().min(10).max(10000),
  evidenceRules: z.string().trim().min(10).max(10000),
  styleRules: z.string().trim().min(10).max(10000),
  numberRules: z.string().trim().min(10).max(10000),
  brandingRules: z.string().trim().min(3).max(10000),
  messagingRules: z.string().trim().min(3).max(10000),
  mediaPolicy: z.string().trim().min(10).max(10000),
  sensitiveTopicPolicy: z.string().trim().min(10).max(10000),
  escalationPolicy: z.string().trim().min(10).max(10000),
  voiceRules: z.string().trim().min(3).max(10000),
  multilingualRules: z.string().trim().min(3).max(10000),
  sensitiveTopics: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  complexTopics: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  requiredPhrases: z.array(z.string().trim().min(1).max(300)).max(50),
  forbiddenPhrases: z.array(z.string().trim().min(1).max(300)).max(50),
  prohibitedClaims: z.array(z.string().trim().min(1).max(500)).max(50),
});
export type GuidelineDraft = z.infer<typeof guideline>;
export const createGuideline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => guideline.parse(i))
  .handler(async ({ context, data }) => {
    const actor = await allowed(context as never, "guidelines.author");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: max } = await db
      .from("guidelines")
      .select("version_number")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: row, error } = await db
      .from("guidelines")
      .insert({
        version_number: (max?.version_number ?? 0) + 1,
        title: data.title,
        status: "draft",
        approval_basis: "official",
        created_by: actor,
        change_summary: data.changeSummary,
        identity_rules: data.identityRules,
        evidence_rules: data.evidenceRules,
        style_rules: data.styleRules,
        number_rules: data.numberRules,
        branding_rules: data.brandingRules,
        messaging_rules: data.messagingRules,
        media_policy: data.mediaPolicy,
        sensitive_topic_policy: data.sensitiveTopicPolicy,
        sensitive_topics: [...new Set(data.sensitiveTopics)],
        complex_topics: [...new Set(data.complexTopics)],
        escalation_policy: data.escalationPolicy,
        voice_rules: data.voiceRules,
        multilingual_rules: data.multilingualRules,
        required_phrases: data.requiredPhrases,
        forbidden_phrases: data.forbiddenPhrases,
        prohibited_claims: data.prohibitedClaims,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await db
      .from("audit_events")
      .insert({
        actor_id: actor,
        actor_role: "staff",
        action: "guideline_draft_created",
        entity_kind: "guideline",
        entity_id: row.id,
        detail: { change_summary: data.changeSummary },
        origin: "screen",
      });
    return { ok: true, id: row.id };
  });
export const activateGuideline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ guidelineId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await allowed(context as never, "guidelines.activate");
    const result = await (context as unknown as Ctx).supabase.rpc("activate_guidelines", {
      _guideline_id: data.guidelineId,
    });
    if (result.error)
      throw new Error((result.error as { message?: string }).message ?? "Activation failed.");
    return { ok: true };
  });

export const getDecisionRecord=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({from:z.string().datetime().nullish(),to:z.string().datetime().nullish(),limit:z.number().int().min(1).max(100).default(50),offset:z.number().int().min(0).default(0)}).parse(i??{})).handler(async({context,data})=>{await allowed(context as never,"audit.view");const r=await(context as unknown as Ctx).supabase.rpc("staff_decision_record",{_from:data.from??null,_to:data.to??null,_limit:data.limit,_offset:data.offset});if(r.error)throw new Error((r.error as {message?:string}).message??"Decision record could not be loaded.");return r.data as any[];});