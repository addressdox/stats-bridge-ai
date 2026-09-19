import { beforeEach, expect, test } from "bun:test";

let interpretation = { language: "zu", englishQuestion: "unemployment Q2 2025", searchQueries: ["unemployment Q2 2025"], reviewReasons: ["media"] };
let proposal: unknown;
let generateFails = false;
let generationCalls = 0;
const dependencies = {
  interpret: async () => interpretation,
  assistant: () => ({ name: "private-provider", model: "private-model", complete: async ({system}: {system: string}) => { generationCalls++; if (system.startsWith("Verify a private draft")) return JSON.stringify({relevant: true, supported: true, issues: []}); if (generateFails) throw new Error("unavailable"); return JSON.stringify(proposal); } }),
  semanticSearch: async () => [],
};
const { resolveDraftEvidence, ensureCaseDraft, prepareCaseDraft } = await import("../src/lib/statbridge/case-drafting.server");
const { communicationSuggestions } = await import("../src/lib/statbridge/communications-intelligence");
const versionId = "11111111-1111-4111-a111-111111111111";
const passageId = "22222222-2222-4222-a222-222222222222";
const figureId = "33333333-3333-4333-a333-333333333333";
const caseId = "44444444-4444-4444-a444-444444444444";
const passage = { passage_id: passageId, content: "The official unemployment rate was 33.2% in Q2 2025.", source_version_id: versionId, title: "QLFS", version_label: "Q2 2025", page_number: 1 };
const figure = { observation_id: figureId, measure: "Official unemployment rate", display_value: "33.2", unit: "%", geography: "South Africa", reference_period: "Q2 2025", source_version_id: versionId, title: "QLFS", version_label: "Q2 2025" };
const calls: Array<{ name: string; args: any }> = [];
let existingDraft: null | { id: string } = null;
let evidenceAvailable = true;
let rpcFailure = false;
let verifiedHuman = true;
const db: any = {
  from(table: string) {
    const chain = new Proxy({}, { get(_t, operation) {
      if (operation === "then") return (resolve: any) => resolve({ data: table === "memory_items" ? [] : table === "observations" ? (verifiedHuman ? [{id:figureId}] : []) : table === "drafts" ? existingDraft : table === "cases" ? { id: caseId, reference: "SB-TEST", kind: "media", question_text: "IsiZulu question", status: "received" } : { id: versionId }, error: null });
      return () => chain;
    } }); return chain;
  },
  async rpc(name: string, args: any) {
    calls.push({ name, args });
    if (name === "save_generated_case_draft") return { data: "private-draft-id", error: null };
    if (rpcFailure && name === "search_passages") return { data: null, error: { message: "database unavailable" } };
    return { data: name === "search_passages" ? (evidenceAvailable ? [passage] : []) : name === "search_observations" ? (evidenceAvailable ? [figure] : []) : [], error: null };
  },
};
beforeEach(() => { calls.length = 0; generationCalls = 0; generateFails = false; existingDraft = null; evidenceAvailable = true; rpcFailure = false; verifiedHuman = true; proposal = { body: "Izinga lokungasebenzi lingu-33.2%.", gaps: [], usedPassageIds: [passageId], usedObservationIds: [figureId] }; });

test("draft references resolve only to retrieved source identities", () => {
  const resolved = resolveDraftEvidence(proposal, [passage], [figure]);
  expect(resolved.evidence).toHaveLength(2);
  expect(resolved.evidence.every(e => e.sourceVersionId === versionId)).toBe(true);
  expect(resolved.body).toContain("33.2%");
});
test("invented citations and unsupported draft bodies are rejected", () => {
  expect(() => resolveDraftEvidence({ body: "Unsupported claim", usedPassageIds: ["invented"] }, [passage], [figure])).toThrow("unknown source");
  expect(() => resolveDraftEvidence({ body: "Unsupported claim" }, [passage], [figure])).toThrow("no supporting evidence");
});
test("initial drafting persists evidence privately and never approves or releases", async () => {
  const result = await ensureCaseDraft(db, caseId, {}, dependencies);
  expect(result).toEqual({ draftId: "private-draft-id" });
  expect(Object.keys(result)).toEqual(["draftId"]);
  const save = calls.find(c => c.name === "save_generated_case_draft")!;
  expect(save.args._evidence).toHaveLength(2);
  expect(save.args._body).toContain("Izinga");
  expect(save.args._fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(calls.some(c => c.name === "approve_draft" || c.name === "release_draft")).toBe(false);
});
test("intake retries keep an existing draft and do not regenerate", async () => {
  existingDraft = { id: "existing-draft" };
  expect(await ensureCaseDraft(db, caseId, {}, dependencies)).toEqual({ draftId: "existing-draft" });
  expect(generationCalls).toBe(0); expect(calls).toHaveLength(0);
});
test("no evidence creates a reviewable gap instead of invented substance", async () => {
  evidenceAvailable = false;
  const draft = await prepareCaseDraft(db, { caseId }, dependencies);
  expect(draft.evidence).toHaveLength(0); expect(draft.gaps).toHaveLength(1);
  expect(generationCalls).toBe(0);
});
test("wording failure keeps evidence separate from an unavailable draft", async () => {
  generateFails = true;
  const draft = await prepareCaseDraft(db, { caseId }, dependencies);
  expect(draft.evidence).toHaveLength(2);
  expect(draft.body).not.toContain(passage.content);
  expect(draft.body).toContain("verified draft could not be prepared");
  expect(draft.gaps.join(" ")).toContain("not a completed response");
});
test("retrieval failures are not mislabelled as absent knowledge", async () => {
  rpcFailure = true;
  await expect(prepareCaseDraft(db, { caseId }, dependencies)).rejects.toThrow("could not be searched");
  expect(generationCalls).toBe(0);
});
test("communications suggestions cite observed demand and prioritise evidence gaps", () => {
  expect(communicationSuggestions([{ topic: "Gender", total: 7, answered: 2, gaps: 4, escalated: 1 }], "seven days")[0]).toContain("4 of 7 questions");
  expect(communicationSuggestions([{ topic: "Employment", total: 6, answered: 5, gaps: 0, escalated: 1 }], "seven days")[0]).toContain("reviewed FAQ or press release");
  expect(communicationSuggestions([{ topic: "Employment", total: 2, answered: 2, gaps: 0, escalated: 0 }], "seven days")).toEqual([]);
});

test("timestamp-only legacy figures cannot become approved-release evidence", async () => {
  verifiedHuman = false;
  proposal = { body: passage.content, usedPassageIds: [passageId] };
  const draft = await prepareCaseDraft(db, {caseId}, dependencies);
  expect(draft.evidence).toHaveLength(1);
  expect(draft.evidence[0]?.passageId).toBe(passageId);
  expect(draft.evidence.some(e => e.observationId === figureId)).toBe(false);
});
