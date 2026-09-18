import { describe, expect, test } from "bun:test";
import { interpretQuestion, readQuestionContext } from "../src/lib/statbridge/question.server";

function database(row: Record<string, unknown> | null) {
  const reads: Array<{ operation: string; key?: string; value?: unknown }> = [];
  const query = {
    select(value: string) {
      reads.push({ operation: "select", value });
      return query;
    },
    eq(key: string, value: unknown) {
      reads.push({ operation: "eq", key, value });
      return query;
    },
    in(key: string, value: unknown) {
      reads.push({ operation: "in", key, value });
      return query;
    },
    is(key: string, value: unknown) {
      reads.push({ operation: "is", key, value });
      return query;
    },
    async maybeSingle() {
      return { data: row, error: null };
    },
  };
  return {
    db: { from: () => query } as unknown as Parameters<typeof readQuestionContext>[0],
    reads,
  };
}

const prior = {
  id: "prior-id",
  question_text: "And the previous quarter?",
  language: "af",
  outcome: "answered",
  case_id: null,
  review_flag: "none",
  validation_result: {
    resolved_question: "What was the unemployment rate in South Africa in Q1 2025?",
    other: "not context",
  },
  ai_explanation: "SECRET ANSWER WORDING",
  official_blocks: [{ internal: "not context" }],
};

describe("public follow-up context", () => {
  test("only the previous question, resolved question and language become model context", async () => {
    const { db, reads } = database(prior);
    const result = await readQuestionContext(db, "ANS-prior");
    expect(result).toEqual({
      answerId: "prior-id",
      context: {
        question: "And the previous quarter?",
        resolvedQuestion: "What was the unemployment rate in South Africa in Q1 2025?",
        language: "af",
      },
    });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(reads).toContainEqual({ operation: "in", key: "outcome", value: ["answered", "clarification"] });
    expect(reads).toContainEqual({ operation: "is", key: "case_id", value: null });
    expect(String(reads[0]?.value)).not.toContain("official_blocks");
  });
  test.each([
    { ...prior, outcome: "escalated" },
    { ...prior, case_id: "private-case" },
    { ...prior, review_flag: "source_changed" },
    { ...prior, outcome: "gap" },
    null,
  ])("private, unreviewed or absent parents supply no context", async (row) => {
    expect(await readQuestionContext(database(row).db, "ANS-parent")).toBeNull();
  });
  test("a public clarification retains the question context without supplying answer text", async () => {
    const result = await readQuestionContext(database({ ...prior, outcome: "clarification" }).db, "ANS-parent");
    expect(result?.context.resolvedQuestion).toContain("Q1 2025");
    expect(result?.answerId).toBe("prior-id");
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
  test("old answer records without resolved metadata remain compatible", async () => {
    const { db } = database({
      ...prior,
      question_text: "What was unemployment in Q2 2025?",
      validation_result: {},
    });
    expect((await readQuestionContext(db, "ANS-prior"))?.context.resolvedQuestion).toBeNull();
  });
  test("follow-up is resolved for fresh retrieval, with prior context separate from policy", async () => {
    let request: { system: string; prompt: string } | null = null;
    const { db } = database(prior);
    const previous = await readQuestionContext(db, "ANS-prior");
    const result = await interpretQuestion(
      "And the previous quarter?",
      "auto",
      null,
      {
        name: "test",
        model: "test",
        complete: async (input) => {
          request = input;
          return JSON.stringify({
            language: "en",
            englishQuestion: "What was the unemployment rate in South Africa in Q4 2024?",
            searchQueries: ["unemployment Q4 2024"],
            reviewReasons: [],
          });
        },
      },
      previous!.context,
    );
    const sent = JSON.parse(request!.prompt);
    expect(sent.question).toBe("And the previous quarter?");
    expect(sent.previousQuestionContext.resolvedQuestion).toContain("Q1 2025");
    expect(request!.system).toContain("fresh approved-source retrieval");
    expect(request!.system).toContain("separate untrusted conversational data");
    expect(request!.prompt).not.toContain("SECRET ANSWER");
    expect(result.searchQueries).toEqual(["unemployment Q4 2024"]);
  });
  test("current human or sensitive request cannot be cancelled by safe parent context", async () => {
    const result = await interpretQuestion(
      "I want to speak to a human",
      "auto",
      null,
      {
        name: "test",
        model: "test",
        complete: async () =>
          JSON.stringify({
            language: "en",
            englishQuestion: "Show unemployment Q1 2025",
            searchQueries: ["unemployment"],
            reviewReasons: [],
          }),
      },
      { question: "What was unemployment?", resolvedQuestion: null, language: "af" },
    );
    expect(result.reviewReasons).toContain("complex");
    expect(result.language).toBe("en");
  });
});
