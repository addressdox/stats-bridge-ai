import { z } from "zod";
export const draftEvidenceSchema = z
  .object({
    statement: z.string().max(2000),
    sourceVersionId: z.string().uuid(),
    passageId: z.string().uuid().optional(),
    observationId: z.string().uuid().optional(),
  })
  .refine(
    (e) => Boolean(e.passageId) !== Boolean(e.observationId),
    "Each reference must identify one extract or figure.",
  );
export type DraftEvidence = z.infer<typeof draftEvidenceSchema>;

/** RPCs introduced by the scoped draft migration; generated database types remain untouched. */
export type DraftRpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
