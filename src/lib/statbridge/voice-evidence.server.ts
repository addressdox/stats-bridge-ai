import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { API_VERSION, publicAnswerSchema, type PublicAnswer } from "./contract";

/** A live caller can see only an answer actually attached to their own conversation. */
export async function readVoiceEvidence(
  db: SupabaseClient<Database>,
  conversationId: string,
  browserToken: string,
): Promise<PublicAnswer | null> {
  const [
    { data: identifier, error: identifierError },
    { data: conversation, error: conversationError },
  ] = await Promise.all([
    db
      .from("visitor_identifiers")
      .select("visitor_id")
      .eq("kind", "browser_token")
      .eq("value", browserToken)
      .maybeSingle(),
    db.from("conversations").select("visitor_id").eq("id", conversationId).maybeSingle(),
  ]);
  if (
    identifierError ||
    conversationError ||
    !identifier ||
    !conversation ||
    identifier.visitor_id !== conversation.visitor_id
  )
    return null;
  const { data: turn, error: turnError } = await db
    .from("conversation_turns")
    .select("answer_id")
    .eq("conversation_id", conversationId)
    .eq("author", "assistant")
    .not("answer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (turnError || !turn?.answer_id) return null;
  const { data: answer, error } = await db
    .from("answers")
    .select(
      "public_ref,question_text,outcome,reading_level,official_blocks,ai_explanation,caveats,follow_ups,clarification,gap_description,review_reasons,created_at,language,review_flag",
    )
    .eq("id", turn.answer_id)
    .maybeSingle();
  if (error || !answer || answer.review_flag !== "none") return null;
  const parsed = publicAnswerSchema.safeParse({
    apiVersion: API_VERSION,
    answerRef: answer.public_ref,
    question: answer.question_text,
    outcome: answer.outcome,
    readingLevel: answer.reading_level,
    officialBlocks: answer.official_blocks,
    aiExplanation: answer.ai_explanation,
    caveats: answer.caveats,
    followUps: answer.follow_ups,
    references: [],
    clarification: answer.clarification,
    gapDescription: answer.gap_description,
    caseReference: null,
    statusToken: null,
    reviewReasons: answer.review_reasons,
    provider: null,
    createdAt: answer.created_at,
    language: answer.language,
  });
  if (!parsed.success) return null;
  if (parsed.data.outcome === "escalated") {
    parsed.data.officialBlocks = parsed.data.officialBlocks.filter(
      (block) => block.type === "case_acknowledgement",
    );
    parsed.data.aiExplanation = null;
    parsed.data.caveats = [];
    parsed.data.followUps = [];
    parsed.data.references = [];
  }
  return parsed.data;
}
