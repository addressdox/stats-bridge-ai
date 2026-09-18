/**
 * Staff-gated crawler trigger. Only a knowledge administrator may run a crawl
 * from the knowledge-base screens.
 */
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";

export const runKnowledgeCrawl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc("staff_role_of", { _uid: context.userId });
    if (role.data !== "administrator") {
      throw new Error("Only a knowledge administrator may run the crawler.");
    }
    const { runCrawl } = await import("./crawler.server");
    return runCrawl();
  });
