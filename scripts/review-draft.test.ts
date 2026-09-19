import { beforeEach, expect, mock, test } from "bun:test";
const calls: Array<{ name: string; args: any }> = [];
let permitted = true;
const context = { userId: "real-authenticated-user", supabase: { rpc: async (name: string, args: any) => { calls.push({ name, args }); return { data: name === "has_permission" ? permitted : "saved-draft-id", error: null }; } } };
mock.module("@tanstack/react-start", () => ({ createServerFn: () => { let validate: any; const chain = { middleware: () => chain, inputValidator: (fn: any) => { validate = fn; return chain; }, handler: (fn: any) => async (input: any) => fn({ data: validate(input.data), context }) }; return chain; } }));
mock.module("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
const { saveReviewedDraft, suggestDraft, ensureReviewDraft, beginPressRelease } = await import("../src/lib/staff/draft.functions");
const caseId = "44444444-4444-4444-a444-444444444444";
const evidence = [{ sourceVersionId: "11111111-1111-4111-a111-111111111111", passageId: "22222222-2222-4222-a222-222222222222", statement: "Official text" }];
beforeEach(() => { calls.length = 0; permitted = true; });
test("drafting and saving require the existing case-review permission", async () => {
  permitted = false;
  await expect(suggestDraft({ data: { caseId } })).rejects.toThrow("case review access");
  await expect(ensureReviewDraft({ data: { caseId } })).rejects.toThrow("case review access");
  await expect(saveReviewedDraft({ data: { caseId, body: "Edited reply", format: "general_reply", gaps: [] } })).rejects.toThrow("case review access");
  await expect(beginPressRelease({ data: { topic: "Employment statistics in South Africa" } })).rejects.toThrow("case review access");
  expect(calls.every(c => c.name === "has_permission")).toBe(true);
});
test("human save sends wording and selected evidence in one authenticated RPC", async () => {
  const result = await saveReviewedDraft({ data: { caseId, body: "Edited reply", format: "general_reply", gaps: [], evidence } });
  expect(result.draftId).toBe("saved-draft-id");
  expect(calls[1]).toEqual({ name: "save_review_draft", args: { _case_id: caseId, _body: "Edited reply", _format: "general_reply", _gaps: [], _evidence: evidence } });
});
test("a manual edit with no redraft preserves previous references via null", async () => {
  await saveReviewedDraft({ data: { caseId, body: "Edited reply", format: "general_reply", gaps: [] } });
  expect(calls[1]?.args._evidence).toBe(null);
});
test("a malformed reference is rejected before any database write", async () => {
  await expect(saveReviewedDraft({ data: { caseId, body: "Edited reply", format: "general_reply", gaps: [], evidence: [{ sourceVersionId: evidence[0]!.sourceVersionId, statement: "No passage or figure" }] } })).rejects.toThrow();
  expect(calls).toHaveLength(0);
});
