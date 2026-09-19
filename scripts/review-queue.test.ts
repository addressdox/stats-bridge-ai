import { expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/integrations/supabase/types";
import { loadMediaDelivery, loadReviewQueue, reviewQueueSearchSchema, reviewSearchFilter } from "../src/lib/staff/review-queue";

function mockDatabase(response: unknown[] = [], total = 37, status = 200) {
  const requests: { url: URL; headers: Headers }[] = [];
  const db = createClient<Database>("https://queue-test.supabase.co", "test-publishable-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      requests.push({ url: new URL(String(input)), headers: new Headers(init?.headers) });
      return new Response(JSON.stringify(status === 200 ? response : { message: "permission denied" }), {
        status, headers: { "content-type": "application/json", "content-range": `0-9/${total}` },
      });
    } },
  });
  return { db, requests };
}
const defaults = () => reviewQueueSearchSchema.parse({});

test("unsafe URL parameters are bounded and default to the existing open queue", () => {
  expect(defaults()).toMatchObject({ page: 1, size: 10, status: "open", emailPage: 1 });
  expect(reviewQueueSearchSchema.parse({ page: -5, emailPage: "NaN", size: 100000, q: "x".repeat(201), status: "invalid" }))
    .toMatchObject({ page: 1, emailPage: 1, size: 10, q: "", status: "open" });
  expect(reviewQueueSearchSchema.parse({ page: "3", size: "25", q: "  fertility rate  ", status: "released" }))
    .toMatchObject({ page: 3, size: 25, q: "fertility rate", status: "released" });
});

test("request paging and count happen in the authenticated RPC with stable newest-first ordering", async () => {
  const { db, requests } = mockDatabase([{ case_id: "page-two" }]);
  const result = await loadReviewQueue(db, { ...defaults(), page: 2 }, "staff-user");
  expect(result).toEqual({ rows: [{ case_id: "page-two" }], total: 37, page: 2 });
  const request = requests[0]!;
  expect(request.url.pathname).toBe("/rest/v1/rpc/staff_review_cases");
  expect(request.url.searchParams.get("order")).toBe("received_at.desc.nullslast,case_id.desc");
  expect(request.url.searchParams.get("offset")).toBe("10");
  expect(request.url.searchParams.get("limit")).toBe("10");
  expect(request.url.searchParams.get("status")).toBe("not.in.(released,rejected)");
  expect(request.headers.get("prefer")).toContain("count=exact");
});

test("case search and combined filters apply before pagination, including closed history", async () => {
  const { db, requests } = mockDatabase();
  await loadReviewQueue(db, { ...defaults(), status: "released", q: "fertility rate", kind: "media", attention: "sensitive", assignment: "mine", page: 3, size: 25 }, "current-staff-id");
  const parameters = requests[0]!.url.searchParams;
  expect(parameters.get("status")).toBe("eq.released");
  expect(parameters.get("kind")).toBe("eq.media");
  expect(parameters.get("assigned_to")).toBe("eq.current-staff-id");
  expect(parameters.get("review_reasons")).toBe("cs.{sensitive}");
  expect(parameters.get("offset")).toBe("50");
  expect(parameters.get("or")).toContain('question_text.ilike."%fertility rate%"');
  expect(parameters.get("or")).toContain('reference.ilike."%fertility rate%"');
});

test("all statuses does not silently hide rejected or released cases", async () => {
  const { db, requests } = mockDatabase();
  await loadReviewQueue(db, { ...defaults(), status: "all", attention: "source_changed", assignment: "unassigned" }, "staff-user");
  const parameters = requests[0]!.url.searchParams;
  expect(parameters.has("status")).toBe(false);
  expect(parameters.get("source_changed")).toBe("eq.true");
  expect(parameters.get("assigned_to")).toBe("is.null");
});

test("search punctuation cannot become a PostgREST operator or wildcard", () => {
  expect(reviewSearchFilter('50%_*(a,b)."\\', ["question_text"]))
    .toBe('question_text.ilike."%50\\%\\_\\*(a,b).\\"\\\\%"');
  expect(reviewSearchFilter("death, birth rates", ["reference", "question_text"]))
    .toBe('reference.ilike."%death, birth rates%",question_text.ilike."%death, birth rates%"');
});

test("delivery search filters the joined case and pages all releases, rather than the latest fifty", async () => {
  const { db, requests } = mockDatabase([{ id: "release" }], 180);
  const result = await loadMediaDelivery(db, { ...defaults(), emailQ: "SB-2026", delivery: "failed", emailAttention: "complex", emailPage: 7, size: 25 });
  const request = requests[0]!;
  expect(result.total).toBe(180);
  expect(request.url.searchParams.get("offset")).toBe("150");
  expect(request.url.searchParams.get("limit")).toBe("25");
  expect(request.url.searchParams.get("order")).toBe("released_at.desc,id.desc");
  expect(request.url.searchParams.get("cases.kind")).toBe("eq.media");
  expect(request.url.searchParams.get("cases.or")).toContain('question_text.ilike."%SB-2026%"');
  expect(request.url.searchParams.get("cases.review_reasons")).toBe("cs.{complex}");
  expect(request.url.searchParams.get("delivery_state")).toBe("eq.failed");
  expect(request.headers.get("prefer")).toContain("count=exact");
});

test("database failures are surfaced instead of showing an empty queue", async () => {
  const { db } = mockDatabase([], 0, 403);
  await expect(loadReviewQueue(db, defaults(), "staff-user")).rejects.toThrow("permission denied");
  await expect(loadMediaDelivery(db, defaults())).rejects.toThrow("permission denied");
});


test("saved pages beyond the remaining results recover instead of displaying a database failure", async () => {
  for (const kind of ["requests", "delivery"] as const) {
    const offsets: string[] = [];
    const db = createClient<Database>("https://queue-test.supabase.co", "test-publishable-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input) => {
        const offset = new URL(String(input)).searchParams.get("offset")!;
        offsets.push(offset);
        return offset === "0"
          ? new Response("[]", { status: 200, headers: { "content-type": "application/json", "content-range": "*/0" } })
          : new Response(JSON.stringify({ code: "PGRST103", message: "Requested range not satisfiable" }), { status: 416, headers: { "content-type": "application/json" } });
      } },
    });
    const filters = { ...defaults(), page: 99, emailPage: 99 };
    const result = kind === "requests" ? await loadReviewQueue(db, filters, "staff-user") : await loadMediaDelivery(db, filters);
    expect(offsets).toEqual(["980", "0"]);
    expect(result).toEqual({ rows: [], total: 0, page: 1 });
  }
});
