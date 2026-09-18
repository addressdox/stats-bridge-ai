/**
 * Deterministic routing rules applied before the assistant is ever called.
 *
 * These rules only ever ADD review reasons. The assistant may add more
 * reasons later, but it can never remove one added here.
 */
import type { Database } from "@/integrations/supabase/types";

export type ReviewReason = Database["public"]["Enums"]["review_reason"];

const MEDIA_SIGNALS = [
  /\bjournalist\b/i,
  /\breporter\b/i,
  /\bnewsroom\b/i,
  /\bpress\b/i,
  /\bmedia (enquiry|inquiry|request|query|desk)\b/i,
  /\bfor (a|an|my) (story|article|piece|broadcast|bulletin)\b/i,
  /\bon the record\b/i,
  /\bquote\b.*\b(stats ?sa|statistician)\b/i,
  /\bcomment from\b/i,
  /\bdeadline\b/i,
  /\bembargo\b/i,
  /\bi(?:'|’)?m writing (for|from)\b/i,
];

const SENSITIVE_SIGNALS = [
  /\b(unpublished|not yet published|before (the )?release|pre-?release|advance copy)\b/i,
  /\b(individual|personal|named) (respondent|household|record|data)\b/i,
  /\braw (micro)?data\b/i,
  /\b(scandal|corruption|fraud|lawsuit|litigation|investigation)\b/i,
  /\b(minister|president|cabinet|political part(y|ies)|election result)\b/i,
  /\b(criticis|critique|accus|blame)\w*\b.*\bstats ?sa\b/i,
];

const OFFICIAL_POSITION_SIGNALS = [
  /\b(official|formal) (position|statement|response|comment|view|stance)\b/i,
  /\bdoes stats ?sa (believe|think|agree|accept|endorse)\b/i,
  /\bwhat is stats ?sa(?:'|’)?s (view|position|opinion)\b/i,
  /\bon behalf of stats ?sa\b/i,
];

const INTERPRETATION_SIGNALS = [
  /\bwhy (did|does|is|are|has|have|was|were)\b/i,
  /\bwhat caused\b/i,
  /\bbecause of\b/i,
  /\bblame\b/i,
  /\bpredict|forecast|will (it|the|unemployment|inflation)\b/i,
  /\bshould (we|the government|south africa)\b/i,
  /\bdo you think\b/i,
  /\bimpact of\b/i,
  /\bexplain the reason\b/i,
  /\bis it (good|bad|acceptable)\b/i,
  // Judgement about performance is never a figure lookup, even when phrased plainly.
  /\b(failing|failed|succeeding|doing enough|incompetent|mismanag\w*|to blame)\b/i,
  /\bis (the )?(government|state|treasury|municipalit\w+|stats ?sa)\b/i,
  /\b(getting|got) (better|worse)\b/i,
  /\bhow (well|badly)\b/i,
];

const ADVERSARIAL_SIGNALS = [
  /\bignore (all |your |previous )?(prior |above )?instructions?\b/i,
  /\bsystem prompt\b/i,
  /\bdeveloper mode\b/i,
  /\bpretend (you are|to be)\b/i,
  /\bwithout (the )?(review|approval)\b/i,
  /\bshow me (the )?(drafts?|internal|staff|unapproved)\b/i,
  /\bservice[_ ]role\b/i,
  /\bapi key\b/i,
];

export type RoutingVerdict = {
  reasons: ReviewReason[];
  adversarial: boolean;
};

function matchAny(text: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(text));
}

export function routeQuestion(question: string): RoutingVerdict {
  const reasons = new Set<ReviewReason>();
  const text = question.trim();

  if (matchAny(text, MEDIA_SIGNALS)) reasons.add("media");
  if (matchAny(text, SENSITIVE_SIGNALS)) reasons.add("sensitive");
  if (matchAny(text, OFFICIAL_POSITION_SIGNALS)) reasons.add("formal_approval");
  if (matchAny(text, INTERPRETATION_SIGNALS)) reasons.add("interpretation");

  const adversarial = matchAny(text, ADVERSARIAL_SIGNALS);
  if (adversarial) reasons.add("sensitive");

  if (text.length > 600) reasons.add("complex");

  return { reasons: [...reasons], adversarial };
}

/** Media and sensitive requests may never receive AI-written wording. */
export function mustGoToHuman(reasons: readonly ReviewReason[]) {
  return reasons.some((r) =>
    ["media", "sensitive", "formal_approval", "interpretation", "complex"].includes(r),
  );
}

export function isAcknowledgementOnly(reasons: readonly ReviewReason[]) {
  return reasons.includes("media") || reasons.includes("sensitive");
}
