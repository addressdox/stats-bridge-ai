import { expect, test } from "bun:test";
import {
  sourceRegisterPage,
  sourceRegisterSearchSchema,
  memorySearchSchema,
} from "../src/lib/staff/knowledge-collections";
import {
  collectAll,
  topicCounts,
  topicPage,
  insightsSearchSchema,
  decisionRecordSearchSchema,
} from "../src/lib/staff/insights-record";
import {
  conversationCollectionSchema,
  visitorCollectionSchema,
} from "../src/lib/staff/operations-collections";

test("source search and combined filters reach a record beyond the first page", () => {
  const rows = Array.from({ length: 63 }, (_, i) => ({
    id: String(i),
    status: i === 62 ? "approved" : "pending",
    version_label: "2026",
    sources: {
      title: i === 62 ? "Fertility estimates" : "Population",
      publisher: "Stats SA",
      topic: "demography",
      source_type: "statistical_release",
      audience: "public",
    },
  }));
  const all = sourceRegisterPage(rows, sourceRegisterSearchSchema.parse({ page: 2 }));
  expect(all.total).toBe(63);
  expect(all.rows[0]?.id).toBe("10");
  const result = sourceRegisterPage(
    rows,
    sourceRegisterSearchSchema.parse({
      q: "FERTILITY",
      status: "approved",
      sourceType: "statistical_release",
      audience: "public",
      page: 8,
    }),
  );
  expect(result.total).toBe(1);
  expect(result.page).toBe(1);
  expect(result.rows[0]?.id).toBe("62");
  expect(
    sourceRegisterPage(rows, sourceRegisterSearchSchema.parse({ q: "missing" })),
  ).toMatchObject({ rows: [], total: 0, page: 1 });
});
test("topic totals and ordering stay complete before pagination and gap filters", () => {
  const answers = Array.from({ length: 27 }, (_, i) => ({
    topic: `Topic ${String(i).padStart(2, "0")}`,
    outcome: "answered",
  }));
  answers.push({ topic: "Topic 26", outcome: "gap" }, { topic: "Topic 26", outcome: "escalated" });
  const topics = topicCounts(answers);
  const first = topicPage(topics, insightsSearchSchema.parse({}));
  expect(first.total).toBe(27);
  expect(first.rows[0]).toEqual({
    topic: "Topic 26",
    total: 3,
    answered: 1,
    gaps: 1,
    escalated: 1,
  });
  const filtered = topicPage(
    topics,
    insightsSearchSchema.parse({ outcome: "gaps", q: "26", page: 12 }),
  );
  expect(filtered.total).toBe(1);
  expect(filtered.page).toBe(1);
  const alphabetical = topicPage(topics, insightsSearchSchema.parse({ sort: "topic", page: 2 }));
  expect(alphabetical.rows[0]?.topic).toBe("Topic 10");
});
test("complete loading continues when the server caps pages below the requested batch size", async () => {
  const source = Array.from({ length: 13 }, (_, i) => i);
  const rows = await collectAll(
    async (from, to) => ({ data: source.slice(from, Math.min(to + 1, from + 4)), error: null }),
    10,
  );
  expect(rows).toEqual(source);
});
test("complete loading reports failure instead of silently returning incomplete totals", async () => {
  await expect(
    collectAll(async () => ({ data: null, error: { message: "Database unavailable" } })),
  ).rejects.toThrow("Database unavailable");
});
test("invalid saved collection parameters cannot request unbounded rows", () => {
  expect(memorySearchSchema.parse({ size: 9999, page: -5, status: "unknown" })).toMatchObject({
    size: 10,
    page: 1,
    status: "all",
  });
  expect(insightsSearchSchema.parse({ days: 9999, size: 0, severity: "invalid" })).toMatchObject({
    days: 30,
    size: 10,
    severity: "all",
  });
  expect(decisionRecordSearchSchema.parse({ from: "not-a-date" }).from).toBe("");
  expect(conversationCollectionSchema.safeParse({ pageSize: 10000 }).success).toBe(false);
  expect(visitorCollectionSchema.safeParse({ page: 0 }).success).toBe(false);
});
