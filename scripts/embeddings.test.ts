import { afterEach, describe, expect, test } from "bun:test";
import { backfillEmbeddings, embedTexts, semanticSearch } from "../src/lib/statbridge/embeddings.server";

type Row = Record<string, string | null>;
function fakeDatabase(
  passages: Row[] = [],
  observations: Row[] = [],
  existing: Row[] = [],
  failure?: string,
) {
  const tables: Record<string, Row[]> = { passages, observations, kb_embeddings: [...existing] };
  const reads: { table: string; after?: string; ids?: string[] }[] = [];
  const db = {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      let max = Infinity;
      let after: string | undefined;
      let ids: string[] | undefined;
      let ordered = false;
      const query = {
        select() {
          return query;
        },
        eq(key: string, value: unknown) {
          filters.push((r) => r[key] === value);
          return query;
        },
        not(key: string) {
          filters.push((r) => r[key] != null);
          return query;
        },
        in(key: string, values: string[]) {
          ids = values;
          filters.push((r) => values.includes(r[key]));
          return query;
        },
        gt(key: string, value: string) {
          after = value;
          filters.push((r) => r[key] > value);
          return query;
        },
        order() {
          ordered = true;
          return query;
        },
        limit(value: number) {
          max = value;
          return query;
        },
        async upsert(rows: Row[]) {
          if (failure === "upsert") return { error: { message: "write failed" } };
          for (const row of rows) {
            const i = tables[table].findIndex(
              (r) => r.owner_kind === row.owner_kind && r.owner_id === row.owner_id,
            );
            if (i >= 0) tables[table][i] = row;
            else tables[table].push(row);
          }
          return { error: null };
        },
        then(resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) {
          reads.push({ table, after, ids });
          let rows = tables[table].filter((r) => filters.every((f) => f(r)));
          if (ordered) rows = rows.toSorted((a, b) => a.id.localeCompare(b.id));
          return Promise.resolve(
            failure === table
              ? { data: null, error: { message: "read failed" } }
              : { data: rows.slice(0, max), error: null },
          ).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { db: db as unknown as Parameters<typeof backfillEmbeddings>[0], tables, reads };
}
function sourceRow(index: number): Row {
  return {
    id: String(index).padStart(6, "0"),
    content: "Published evidence",
    source_version_id: "version",
    "source_versions.status": "approved",
    verified_at: "2026-01-01",
    verified_by: "human-reviewer",
    measure: "Population",
    unit: "people",
    geography: "SA",
    reference_period: "2025",
    display_value: "100",
  };
}
const originalFetch = globalThis.fetch;
const originalGoogle = process.env.GEMINI_API_KEY;
const originalGateway = process.env.LOVABLE_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalGoogle === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGoogle;
  if (originalGateway === undefined) delete process.env.LOVABLE_API_KEY;
  else process.env.LOVABLE_API_KEY = originalGateway;
});
function googleMock() {
  process.env.GEMINI_API_KEY = "test-only";
  globalThis.fetch = (async (_url, init) => {
    const count = JSON.parse(String(init?.body)).requests.length;
    return Response.json({
      embeddings: Array.from({ length: count }, () => ({ values: Array(1536).fill(0.1) })),
    });
  }) as typeof fetch;
}

describe("embedding corpus traversal", () => {
  test("passes 500 source rows and 2000 existing embeddings, resumes and is idempotent", async () => {
    googleMock();
    const passages = Array.from({ length: 2111 }, (_, i) => sourceRow(i)).reverse();
    const existing = Array.from({ length: 2100 }, (_, i) => ({
      owner_kind: "passage",
      owner_id: sourceRow(i).id,
    }));
    const { db, tables, reads } = fakeDatabase(passages, [], existing);
    expect(await backfillEmbeddings(db, 7)).toEqual({ created: 7, remaining: 1 });
    expect(tables.kb_embeddings.slice(2100).map((r) => r.owner_id)).toEqual(
      Array.from({ length: 7 }, (_, i) => sourceRow(2100 + i).id),
    );
    expect(await backfillEmbeddings(db, 7)).toEqual({ created: 4, remaining: 0 });
    expect(await backfillEmbeddings(db, 7)).toEqual({ created: 0, remaining: 0 });
    expect(reads.some((r) => r.after === "001999")).toBe(true);
    expect(
      reads.filter((r) => r.table === "kb_embeddings").every((r) => r.ids && r.ids.length <= 100),
    ).toBe(true);
  });
  test("indexes the just-approved upload before unrelated global backlog", async () => {
    googleMock();
    const passages = [
      ...Array.from({ length: 130 }, (_, i) => sourceRow(i)),
      { ...sourceRow(131), source_version_id: "new-upload" },
      { ...sourceRow(132), source_version_id: "new-upload" },
    ];
    const { db, tables } = fakeDatabase(passages);
    expect(await backfillEmbeddings(db, 120, "new-upload")).toEqual({ created: 2, remaining: 0 });
    expect(tables.kb_embeddings.map(row => row.source_version_id)).toEqual(["new-upload", "new-upload"]);
  });
  test("paginates verified observations and excludes unapproved versions and unverified observations", async () => {
    googleMock();
    const observations = Array.from({ length: 503 }, (_, i) => sourceRow(i));
    observations.push(
      { ...sourceRow(504), verified_at: null },
      { ...sourceRow(505), "source_versions.status": "pending" },
      { ...sourceRow(506), verified_by: null },
    );
    const { db, tables } = fakeDatabase(
      [{ ...sourceRow(0), "source_versions.status": "pending" }],
      observations,
    );
    expect(await backfillEmbeddings(db, 700)).toEqual({ created: 503, remaining: 0 });
    expect(tables.kb_embeddings.every((r) => r.owner_kind === "observation")).toBe(true);
    expect(tables.kb_embeddings.some((r) => r.owner_id === sourceRow(506).id)).toBe(false);
  });
  for (const failure of ["passages", "observations", "kb_embeddings", "upsert"]) {
    test(`propagates ${failure} errors`, async () => {
      googleMock();
      const { db } = fakeDatabase(
        failure === "observations" ? [] : [sourceRow(0)],
        [],
        [],
        failure,
      );
      await expect(backfillEmbeddings(db)).rejects.toThrow("failed");
    });
  }
});

describe("semantic retrieval availability", () => {
  function semanticDatabase(result: { data: unknown; error: { message: string } | null }) {
    const calls: Array<{ name: string; args: { _embedding: string; _limit: number } }> = [];
    return {
      calls,
      db: {
        async rpc(name: string, args: { _embedding: string; _limit: number }) {
          calls.push({ name, args });
          return result;
        },
      } as unknown as Parameters<typeof semanticSearch>[0],
    };
  }

  test("an embedding provider failure propagates instead of impersonating zero matching knowledge", async () => {
    googleMock();
    globalThis.fetch = (async () => new Response("temporary provider error", { status: 503 })) as typeof fetch;
    const { db, calls } = semanticDatabase({ data: [], error: null });
    await expect(semanticSearch(db, "fertility rate")).rejects.toThrow("Embedding request failed");
    expect(calls).toHaveLength(0);
  });

  test("invalid provider vectors are not sent to the database or reported as an empty search", async () => {
    googleMock();
    globalThis.fetch = (async () => Response.json({ embeddings: [{ values: [0.1] }] })) as typeof fetch;
    const { db, calls } = semanticDatabase({ data: [], error: null });
    await expect(semanticSearch(db, "fertility rate")).rejects.toThrow("1536-dimensional");
    expect(calls).toHaveLength(0);
  });

  test("a vector RPC error propagates instead of impersonating zero matching knowledge", async () => {
    googleMock();
    const { db, calls } = semanticDatabase({ data: null, error: { message: "vector search unavailable" } });
    await expect(semanticSearch(db, "fertility rate")).rejects.toThrow("could not be searched");
    expect(calls).toHaveLength(1);
  });

  test("a successful empty vector search remains empty and sends the requested limit", async () => {
    googleMock();
    const { db, calls } = semanticDatabase({ data: [], error: null });
    expect(await semanticSearch(db, "fertility rate", 12)).toEqual([]);
    expect(calls[0]?.name).toBe("search_knowledge_semantic");
    expect(calls[0]?.args._limit).toBe(12);
    expect(JSON.parse(calls[0]!.args._embedding)).toHaveLength(1536);
  });

  test("successful vector hits retain their source identities for approved-only hydration", async () => {
    googleMock();
    const hits = [{ owner_kind: "passage", owner_id: "fertility-passage", source_version_id: "approved-version", content: "Published fertility evidence", similarity: 0.85 }];
    const { db } = semanticDatabase({ data: hits, error: null });
    expect(await semanticSearch(db, "fertility rate")).toEqual(hits);
  });
});

describe("embedding response validation", () => {
  for (const embeddings of [
    [],
    [{ values: [] }],
    [{ values: Array(1536).fill("bad") }],
    [{ values: Array(1536).fill(null) }],
    [{ values: Array(1536).fill(0) }, { values: Array(1536).fill(0) }],
  ]) {
    test("rejects invalid Google count or dimensions or values without writing", async () => {
      googleMock();
      globalThis.fetch = (async () => Response.json({ embeddings })) as typeof fetch;
      const { db, tables } = fakeDatabase([sourceRow(0)]);
      await expect(backfillEmbeddings(db)).rejects.toThrow("finite 1536-dimensional");
      expect(tables.kb_embeddings).toHaveLength(0);
    });
  }
  test("rejects non-finite values", async () => {
    googleMock();
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ embeddings: [{ values: Array(1536).fill(Infinity) }] }),
    })) as typeof fetch;
    await expect(embedTexts(["test"])).rejects.toThrow("finite");
  });
  test("uses gateway indices to restore order", async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.LOVABLE_API_KEY = "test-only";
    globalThis.fetch = (async () =>
      Response.json({
        data: [
          { index: 1, embedding: Array(1536).fill(2) },
          { index: 0, embedding: Array(1536).fill(1) },
        ],
      })) as typeof fetch;
    const result = await embedTexts(["first", "second"]);
    expect(result.map((r) => r[0])).toEqual([1, 2]);
  });
  test("rejects duplicate gateway indices", async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.LOVABLE_API_KEY = "test-only";
    globalThis.fetch = (async () =>
      Response.json({
        data: [
          { index: 0, embedding: Array(1536).fill(2) },
          { index: 0, embedding: Array(1536).fill(1) },
        ],
      })) as typeof fetch;
    await expect(embedTexts(["first", "second"])).rejects.toThrow("indices");
  });
});
