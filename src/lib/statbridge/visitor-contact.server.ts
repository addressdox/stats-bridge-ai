import { z } from "zod";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Resolve only the visitor who owns this actual browser conversation. Never creates a record. */
export async function readConversationVisitor(
  db: Admin,
  args: { conversationId: string | null; browserToken: string },
) {
  if (
    !z.string().uuid().safeParse(args.conversationId).success ||
    !z.string().trim().min(8).max(80).safeParse(args.browserToken).success ||
    /^(?:assistant-anonymous|voice-agent-anonymous)$/i.test(args.browserToken)
  )
    return null;
  const [{ data: identifier }, { data: conversation }] = await Promise.all([
    db
      .from("visitor_identifiers")
      .select("visitor_id")
      .eq("kind", "browser_token")
      .eq("value", args.browserToken)
      .maybeSingle(),
    db.from("conversations").select("visitor_id").eq("id", args.conversationId!).maybeSingle(),
  ]);
  if (!identifier || !conversation || identifier.visitor_id !== conversation.visitor_id)
    return null;
  const { data: visitor } = await db
    .from("visitors")
    .select("id, full_name, email, phone, consent_given")
    .eq("id", conversation.visitor_id)
    .maybeSingle();
  return visitor ?? null;
}
