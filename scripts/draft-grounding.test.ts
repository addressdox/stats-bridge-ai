import { describe, expect, test } from "bun:test";
import {
  hasDraftTopicOverlap,
  INSUFFICIENT_DRAFT_INFORMATION,
  unsupportedDraftNumbers,
} from "../src/lib/statbridge/draft-grounding";
import { prepareCaseDraft, resolveDraftEvidence } from "../src/lib/statbridge/case-drafting.server";

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
      data: name === "search_passages" ? evidence : [],
      error: null,
    }),
  };
  const dependencies = {
    interpret: async () => ({
      language: "en",
      englishQuestion: options.englishQuestion ?? question,
      searchQueries: ["mortality 2023"],
      reviewReasons: ["media" as const],
    }),
    semanticSearch: async () => [],
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
