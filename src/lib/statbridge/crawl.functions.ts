/**
 * Staff-gated crawler trigger. Only a knowledge administrator may run a crawl
 * from the knowledge-base screens.
 */
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";

export const runKnowledgeCrawl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const allowed = await context.supabase.rpc("has_permission", { _uid: context.userId, _permission: "crawler.manage" });
    if (allowed.data !== true) {
      throw new Error("Your account cannot run the crawler.");
    }
    const { runCrawl } = await import("./crawler.server");
    return runCrawl();
  });
