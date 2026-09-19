import { describe, expect, test } from "bun:test";
import {
  hasDraftTopicOverlap,
  INSUFFICIENT_DRAFT_INFORMATION,
  unsupportedDraftNumbers,
} from "../src/lib/statbridge/draft-grounding";
import { prepareCaseDraft, resolveDraftEvidence } from "../src/lib/statbridge/case-drafting.server";
import type { SemanticHit } from "../src/lib/statbridge/embeddings.server";

const passage = {
  passage_id: "death-passage",
  source_version_id: "death-version",
  title: "Mortality and causes of death, 2023",
  version_label: "2023 publication",
  page_number: 5,
  content: "The reported death rate was 8.5 deaths per 1,000 population in 2023.",
};
const question = "What was South Africa's death rate in 2023?";

function fixture(
  options: {
    question?: string;
    englishQuestion?: string;
    evidence?: (typeof passage)[];
    proposal?: Record<string, unknown>;
    verification?: Record<string, unknown>;
    verificationError?: boolean;
    semanticError?: boolean;
    semanticHits?: SemanticHit[];
    semanticEvidence?: (typeof passage)[];
    hydrationError?: "search_passages_by_id" | "search_observations_by_id";
  } = {},
) {
  const calls: Array<{ system: string; prompt: string }> = [];
  const evidence = options.evidence ?? [passage];
  const db: any = {
    from(table: string) {
      const chain: any = new Proxy(
        {},
        {
          get(_target, operation) {
            if (operation === "then")
              return (resolve: (value: unknown) => void) =>
                resolve({
                  data:
                    table === "cases"
                      ? {
                          id: "case-id",
                          reference: "SB-GROUNDING",
                          kind: "media",
                          question_text: options.question ?? question,
                          status: "received",
                        }
                      : table === "guidelines"
                        ? { id: "guideline-id", style_rules: "Use concise formal wording." }
                        : [],
                  error: null,
                });
            return () => chain;
          },
        },
      );
      return chain;
    },
    rpc: async (name: string) => ({
      data: name === "search_passages" ? evidence : name === "search_passages_by_id" ? options.semanticEvidence ?? [] : [],
      error: name === options.hydrationError ? { message: "source hydration unavailable" } : null,
    }),
  };
  const dependencies = {
    interpret: async () => ({
      language: "en",
      englishQuestion: options.englishQuestion ?? question,
      searchQueries: ["mortality 2023"],
      reviewReasons: ["media" as const],
    }),
    semanticSearch: async () => {
      if (options.semanticError) throw new Error("embedding provider unavailable");
      return options.semanticHits ?? [];
    },
    assistant: () => ({
      name: "fixture",
      model: "fixture",
      complete: async (input: { system: string; prompt: string }) => {
        calls.push(input);
        if (input.system.startsWith("Verify")) {
          if (options.verificationError) throw new Error("verification temporarily unavailable");
          return JSON.stringify(
            options.verification ?? { relevant: true, supported: true, issues: [] },
          );
        }
        return JSON.stringify(
          options.proposal ?? {
            body: passage.content,
            usedPassageIds: [passage.passage_id],
            usedObservationIds: [],
            gaps: [],
          },
        );
      },
    }),
  };
  return {
    calls,
    prepare: () =>
      prepareCaseDraft(
        db,
        {
          caseId: "case-id",
          instruction: "Use the requested reference period",
          basedOn: "Old unemployment template",
        },
        dependencies,
      ),
  };
}

describe("private media draft grounding", () => {
  test("death rates cannot retrieve unemployment or monetary policy just because rates match", () => {
    expect(hasDraftTopicOverlap("What are the death rates?", "Unemployment rate was 33.2%.")).toBe(
      false,
    );
    expect(
      hasDraftTopicOverlap(
        "What are the death rates?",
        "Monetary policy interest rate announcement.",
      ),
    ).toBe(false);
    expect(hasDraftTopicOverlap("What are the death rates?", passage.content)).toBe(true);
    expect(hasDraftTopicOverlap("What are the death rates?", "Mortality and causes of death")).toBe(
      true,
    );
  });

  test("approved but unrelated search hits produce an information gap without generation", async () => {
    const f = fixture({
      evidence: [
        { ...passage, title: "Monetary policy", content: "The interest rate was 8.5% in 2023." },
      ],
    });
    const draft = await f.prepare();
    expect(draft.body).toBe(INSUFFICIENT_DRAFT_INFORMATION);
    expect(draft.evidence).toEqual([]);
    expect(f.calls).toHaveLength(0);
  });

  test("a failed semantic lookup without lexical evidence is an availability error, not a knowledge gap", async () => {
    const f = fixture({ evidence: [], semanticError: true });
    await expect(f.prepare()).rejects.toThrow("not a confirmed knowledge gap");
    expect(f.calls).toHaveLength(0);
  });

  test("unrelated lexical results cannot hide a failed semantic lookup", async () => {
    const f = fixture({
      evidence: [{ ...passage, title: "Monetary policy", content: "The interest rate was 8.5% in 2023." }],
      semanticError: true,
    });
    await expect(f.prepare()).rejects.toThrow("not a confirmed knowledge gap");
    expect(f.calls).toHaveLength(0);
  });

  test("relevant approved lexical evidence still supports drafting during a semantic outage", async () => {
    const f = fixture({ semanticError: true });
    const draft = await f.prepare();
    expect(draft.body).toBe(passage.content);
    expect(draft.evidence[0]?.passageId).toBe(passage.passage_id);
    expect(f.calls).toHaveLength(2);
  });

  test("successful empty lexical and semantic searches remain a genuine knowledge gap", async () => {
    const f = fixture({ evidence: [], semanticHits: [] });
    const draft = await f.prepare();
    expect(draft.body).toBe(INSUFFICIENT_DRAFT_INFORMATION);
    expect(draft.provider.model).toBe("no-evidence");
    expect(f.calls).toHaveLength(0);
  });

  test("a model-declared evidence gap is normal insufficiency, without unrelated candidate citations", async () => {
    const f = fixture({
      evidence: [{ ...passage, content: "The mortality publication describes death registrations but does not supply the requested rate." }],
      proposal: { decision: "gap", body: "The supplied information does not include that death rate.", gaps: ["The numerical death rate is missing."], usedPassageIds: [], usedObservationIds: [] },
    });
    const draft = await f.prepare();
    expect(draft.body).toBe(INSUFFICIENT_DRAFT_INFORMATION);
    expect(draft.provider.model).toBe("no-evidence");
    expect(draft.evidence).toEqual([]);
    expect(draft.gaps.join(" ")).toContain("does not answer the submitted question");
    expect(draft.gaps.join(" ")).not.toContain("unavailable");
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]?.system).toContain('"decision":"answer"|"gap"');
  });

  test("a gap label cannot publish unsupported facts from the model's body or notes", async () => {
    const f = fixture({
      proposal: { decision: "gap", body: "The death rate is 99.9% and caused by monetary policy.", gaps: ["The department confirms 99.9%."], usedPassageIds: [], usedObservationIds: [] },
    });
    const draft = await f.prepare();
    expect(draft.body).toBe(INSUFFICIENT_DRAFT_INFORMATION);
    expect(draft.evidence).toEqual([]);
    expect(JSON.stringify(draft)).not.toContain("99.9");
    expect(JSON.stringify(draft)).not.toContain("monetary policy");
  });

  test("an incomplete semantic search cannot be labelled a confirmed model knowledge gap", async () => {
    const f = fixture({
      semanticError: true,
      proposal: { decision: "gap", body: "I do not have enough information.", usedPassageIds: [], usedObservationIds: [] },
    });
    const draft = await f.prepare();
    expect(draft.body).not.toBe(INSUFFICIENT_DRAFT_INFORMATION);
    expect(draft.body).toContain("could not be prepared");
    expect(draft.gaps.join(" ")).toContain("unavailable");
  });

  test("a positive factual answer still needs citations even with the new decision field", async () => {
    const f = fixture({
      proposal: { decision: "answer", body: passage.content, usedPassageIds: [], usedObservationIds: [] },
    });
    const draft = await f.prepare();
    expect(draft.body).not.toBe(passage.content);
    expect(draft.body).toContain("could not be prepared");
    expect(draft.provider.model).not.toBe("no-evidence");
  });

  test.each([
    { decision: "gap", body: "No information", usedPassageIds: ["unrelated-id"] },
    { decision: "gap", body: 42, usedPassageIds: [] },
    { decision: "unknown", body: "No information", usedPassageIds: [] },
  ])("invalid knowledge-gap proposals cannot bypass the proposal schema or evidence contract", async (proposal) => {
    const f = fixture({ proposal });
    const draft = await f.prepare();
    expect(draft.provider.model).not.toBe("no-evidence");
    expect(draft.body).toContain("could not be prepared");
  });

  test.each(["passage", "observation"] as const)("failed %s hydration cannot become a false gap", async (kind) => {
    const f = fixture({
      evidence: [],
      semanticHits: [{ owner_kind: kind, owner_id: "semantic-result", source_version_id: passage.source_version_id, content: passage.content, similarity: 0.9 }],
      hydrationError: kind === "passage" ? "search_passages_by_id" : "search_observations_by_id",
    });
    await expect(f.prepare()).rejects.toThrow("could not be loaded");
    expect(f.calls).toHaveLength(0);
  });

  test("semantic-only evidence is reloaded through the approved-source gate before drafting", async () => {
    const f = fixture({
      evidence: [],
      semanticHits: [{ owner_kind: "passage", owner_id: passage.passage_id, source_version_id: passage.source_version_id, content: "An embedding candidate is not evidence by itself.", similarity: 0.9 }],
      semanticEvidence: [passage],
    });
    const draft = await f.prepare();
    expect(draft.body).toBe(passage.content);
    expect(draft.evidence[0]?.statement).toBe(passage.content);
    expect(f.calls[0]?.prompt).not.toContain("An embedding candidate is not evidence by itself");
  });

  test("the model and verifier receive fertility facts at the end of an ingestion-sized passage", async () => {
    const fact = "The synthetic total fertility rate is 2.21 children per woman for South Africa in 2025.";
    const content = `${"Methods and scope. ".repeat(100).slice(0, 1650)} ${fact}`;
    expect(content.length).toBeLessThanOrEqual(1800);
    expect(content.indexOf(fact)).toBeGreaterThan(1600);
    const fertilityPassage = { ...passage, title: "Mid-year population estimates", version_label: "2025", content };
    const f = fixture({
      question: "What is the total fertility rate in South Africa in 2025?",
      englishQuestion: "What is the total fertility rate in South Africa in 2025?",
      evidence: [fertilityPassage],
      proposal: { body: fact, usedPassageIds: [passage.passage_id], usedObservationIds: [], gaps: [] },
    });
    const draft = await f.prepare();
    expect(f.calls[0]?.prompt).toContain(fact);
    expect(JSON.parse(f.calls[1]!.prompt).citedEvidence[0].statement).toContain(fact);
    expect(draft.body).toBe(fact);
    expect(draft.evidence[0]?.statement).toContain(fact);
  });

  test("the actual submitted question reaches both generation and independent verification", async () => {
    const f = fixture({
      question: "Lingakanani izinga lokufa ngo-2023?",
      englishQuestion: question,
    });
    const draft = await f.prepare();
    expect(draft.body).toBe(passage.content);
    expect(f.calls).toHaveLength(2);
    expect(f.calls[0]!.prompt).toContain("QUESTION: Lingakanani izinga lokufa ngo-2023?");
    expect(f.calls[0]!.prompt).toContain("CURRENT DRAFT: Old unemployment template");
    const verification = JSON.parse(f.calls[1]!.prompt);
    expect(verification.question).toBe("Lingakanani izinga lokufa ngo-2023?");
    expect(verification.resolvedQuestion).toBe(question);
    expect(verification.draft).toBe(passage.content);
    expect(JSON.stringify(verification.citedEvidence)).not.toContain("Old unemployment template");
    expect(JSON.stringify(verification)).toContain(passage.title);
    expect(JSON.stringify(verification)).toContain(passage.version_label);
  });

  test("a real citation ID cannot support an invented number", () => {
    expect(() =>
      resolveDraftEvidence(
        { body: "The death rate was 99.9%.", usedPassageIds: [passage.passage_id] },
        [passage],
        [],
      ),
    ).toThrow("value not supported");
    expect(unsupportedDraftNumbers("The rate was 8.5 in 2023.", passage.content)).toEqual([]);
  });

  test("equivalent official thousands grouping is not mistaken for a fabricated number", () => {
    expect(
      unsupportedDraftNumbers(
        "There were 450,234 deaths per 100,000 people.",
        "There were 450 234 deaths per 100 000 people.",
      ),
    ).toEqual([]);
    expect(
      unsupportedDraftNumbers("There were 450234 deaths.", "There were 450\u00a0234 deaths."),
    ).toEqual([]);
    expect(unsupportedDraftNumbers("The rate was 8.7 per 1,000.", passage.content)).toEqual([
      "8.7",
    ]);
  });

  test.each([
    ["2.12", "2,12"],
    ["33.2", "33,2"],
    ["450234", "450,234"],
    ["1234.56", "1.234,56"],
    ["1234,56", "1,234.56"],
    ["1234567.89", "1.234.567,89"],
    ["1 234,50", "1,234.5"],
    ["0.12", "0,12"],
    ["0.001", "0,001"],
    ["0.00001", "0,00001"],
    ["0", "0,000"],
    ["2.100", "2,10"],
  ])("equivalent value %s is supported by the source's %s notation", (body, evidence) => {
    expect(unsupportedDraftNumbers(`The value is ${body}.`, `The value is ${evidence}.`)).toEqual([]);
  });

  test.each([
    ["212", "2,12"],
    ["21.2", "2,12"],
    ["1234", "12,34"],
    ["2.12", "2,13"],
    ["1234.56", "1.234,57"],
    ["1,234,567", "1234,567"],
    ["1", "0,001"],
    ["1", "0,00001"],
  ])("different value %s is not supported by %s", (body, evidence) => {
    expect(unsupportedDraftNumbers(`The value is ${body}.`, `The value is ${evidence}.`)).toHaveLength(1);
  });

  test("a fertility draft can cite an official decimal-comma rate without an invented-value failure", () => {
    const fertility = { ...passage, title: "Mid-year population estimates", version_label: "2025", content: "The total fertility rate is 2,12 children per woman in South Africa for 2025." };
    const result = resolveDraftEvidence({
      body: "The total fertility rate is 2.12 children per woman in South Africa for 2025.",
      usedPassageIds: [fertility.passage_id],
    }, [fertility], []);
    expect(result.body).toContain("2.12");
    expect(result.evidence[0]?.statement).toContain("2,12");
  });

  test.each([
    {
      relevant: false,
      supported: true,
      issues: ["The draft answers unemployment instead of deaths."],
    },
    { relevant: true, supported: false, issues: ["A death count was substituted for a rate."] },
  ])(
    "semantic rejection cannot present the proposed wording as an answer",
    async (verification) => {
      const f = fixture({
        proposal: {
          body: "The unemployment rate was 8.5% in 2023.",
          usedPassageIds: [passage.passage_id],
        },
        verification,
      });
      const draft = await f.prepare();
      expect(draft.body).toBe(INSUFFICIENT_DRAFT_INFORMATION);
      expect(draft.evidence).toEqual([]);
      expect(draft.gaps.length).toBeGreaterThan(0);
    },
  );

  test("a verifier failure leaves a clear unverified draft, never an unchecked extract answer", async () => {
    const f = fixture({ verificationError: true });
    const draft = await f.prepare();
    expect(draft.body).not.toBe(passage.content);
    expect(draft.body).toMatch(/insufficient|could not|unavailable|unverified|not been verified/i);
    expect(draft.gaps.length).toBeGreaterThan(0);
  });

  test("invalid source identifiers cannot fall back to an unchecked extract answer", async () => {
    const f = fixture({
      proposal: { body: "The death rate was 8.5.", usedPassageIds: ["invented-source"] },
    });
    const draft = await f.prepare();
    expect(draft.body).not.toBe(passage.content);
    expect(draft.gaps.length).toBeGreaterThan(0);
  });

  test("malformed verifier output cannot be mistaken for an approval", async () => {
    const f = fixture({ verification: { relevant: "yes", supported: "yes", issues: [] } });
    const draft = await f.prepare();
    expect(draft.body).not.toBe(passage.content);
    expect(draft.gaps.length).toBeGreaterThan(0);
    expect(draft.provider.name).toBe("Evidence workflow");
  });
});
