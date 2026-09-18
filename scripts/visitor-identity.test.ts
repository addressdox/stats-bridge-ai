import { expect, test } from "bun:test";
import { resolveVisitor } from "../src/lib/statbridge/visitors.server";

type Row = Record<string, unknown>;
type Result = { data: Row | null; error: { message: string } | null };
type Operation = "select" | "insert" | "upsert" | "update";

/** Models the database's unique (kind,value) claim and forces both first reads to miss. */
function fixture(initialMisses = 0) {
  const visitors = new Map<string, Row>();
  const identifiers = new Map<string, Row>();
  const claims: Array<{ row: Row; ignoreDuplicates: boolean }> = [];
  let sequence = 0;
  let browserReads = 0;
  let release!: () => void;
  const missesReady = new Promise<void>((resolve) => (release = resolve));
  const settings = {
    claimError: false,
    updateError: false,
    missingOwner: false,
    beforeClaim: null as (() => void) | null,
  };
  const addVisitor = (row: Row = {}) => {
    const id = `visitor-${++sequence}`;
    visitors.set(id, { id, full_name: null, consent_given: false, ...row });
    return id;
  };
  const bind = (kind: string, value: string, visitorId: string) =>
    identifiers.set(`${kind}:${value}`, { kind, value, visitor_id: visitorId });

  class Query implements PromiseLike<Result> {
    private operation: Operation = "select";
    private row: Row = {};
    private filters: Row = {};
    private ignoreDuplicates = false;
    constructor(private table: string) {}
    select() {
      return this;
    }
    eq(key: string, value: unknown) {
      this.filters[key] = value;
      return this;
    }
    insert(row: Row) {
      this.operation = "insert";
      this.row = row;
      return this;
    }
    update(row: Row) {
      this.operation = "update";
      this.row = row;
      return this;
    }
    upsert(row: Row, options: { onConflict: string; ignoreDuplicates?: boolean }) {
      expect(options.onConflict).toBe("kind,value");
      this.operation = "upsert";
      this.row = row;
      this.ignoreDuplicates = options.ignoreDuplicates ?? false;
      return this;
    }
    maybeSingle() {
      return this.run();
    }
    single() {
      return this.run();
    }
    then<TResult1 = Result, TResult2 = never>(
      fulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
      rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return this.run().then(fulfilled, rejected);
    }
    private async run(): Promise<Result> {
      if (this.table === "visitors") {
        if (this.operation === "update" && settings.updateError) return { data: null, error: { message: "update failed" } };
        if (this.operation === "insert") {
          const id = addVisitor(this.row);
          return { data: { id }, error: null };
        }
        const visitor = visitors.get(String(this.filters.id));
        if (this.operation === "update" && visitor) Object.assign(visitor, this.row);
        return { data: visitor ?? null, error: null };
      }
      expect(this.table).toBe("visitor_identifiers");
      if (this.operation === "upsert") {
        if (this.row.kind === "browser_token") {
          settings.beforeClaim?.();
          claims.push({ row: { ...this.row }, ignoreDuplicates: this.ignoreDuplicates });
          if (settings.claimError) return { data: null, error: { message: "claim failed" } };
        }
        const key = `${this.row.kind}:${this.row.value}`;
        // This block is synchronous, as a database uniqueness conflict is atomic.
        if (!this.ignoreDuplicates || !identifiers.has(key)) identifiers.set(key, { ...this.row });
        return { data: null, error: null };
      }
      if (this.filters.kind === "browser_token") {
        browserReads++;
        if (browserReads <= initialMisses) {
          if (browserReads === initialMisses) release();
          await missesReady;
          return { data: null, error: null };
        }
        if (settings.missingOwner) return { data: null, error: null };
      }
      return {
        data: identifiers.get(`${this.filters.kind}:${this.filters.value}`) ?? null,
        error: null,
      };
    }
  }
  const db = { from: (table: string) => new Query(table) } as unknown as Parameters<
    typeof resolveVisitor
  >[0];
  return { db, visitors, identifiers, claims, settings, addVisitor, bind };
}

const browserToken = "one-owned-browser-token";

test("two concurrent initial misses resolve to one immutable browser owner", async () => {
  const f = fixture(2);
  const results = await Promise.all([
    resolveVisitor(f.db, { browserToken }),
    resolveVisitor(f.db, { browserToken }),
  ]);
  const canonical = f.identifiers.get(`browser_token:${browserToken}`)!.visitor_id;
  expect(f.visitors.size).toBe(2); // The race really created two candidates.
  expect(results.map((result) => result.visitorId)).toEqual([canonical, canonical]);
  expect(f.claims).toHaveLength(2);
  expect(f.claims.every((claim) => claim.ignoreDuplicates)).toBe(true);
  expect(canonical).toBe(f.claims[0]!.row.visitor_id);
  // The losing candidate remains unreferenced; no existing identity/history is deleted.
  expect([...f.identifiers.values()].every((row) => row.visitor_id === canonical)).toBe(true);
});

test("a browser owner claimed after lookup cannot be stolen by a stale candidate", async () => {
  const f = fixture();
  const existing = f.addVisitor({ full_name: "Existing caller" });
  f.settings.beforeClaim = () => f.bind("browser_token", browserToken, existing);
  const result = await resolveVisitor(f.db, {
    browserToken,
    contact: { fullName: "Confirmed caller", email: " Caller@Example.org ", consent: true },
  });
  expect(result.visitorId).toBe(existing);
  expect(result.knownName).toBe("Confirmed caller");
  expect(f.identifiers.get(`browser_token:${browserToken}`)!.visitor_id).toBe(existing);
  expect(f.identifiers.get("email:caller@example.org")!.visitor_id).toBe(existing);
  expect(f.visitors.get(existing)?.consent_given).toBe(true);
});

test("existing browser contact updates retain its owner and normalisation", async () => {
  const f = fixture();
  const existing = f.addVisitor({ full_name: "Old name", phone: "+27821234567" });
  f.bind("browser_token", browserToken, existing);
  const result = await resolveVisitor(f.db, {
    browserToken,
    contact: {
      fullName: " Caller Name ",
      email: " CallER@example.org ",
      phone: " +27827654321 ",
      address: " Pretoria ",
      organisation: " Demo ",
      consent: true,
    },
  });
  expect(result).toEqual({ visitorId: existing, returning: true, knownName: "Caller Name" });
  expect(f.visitors.size).toBe(1);
  expect(f.visitors.get(existing)).toMatchObject({
    full_name: "Caller Name",
    email: "caller@example.org",
    phone: "+27827654321",
    address: "Pretoria",
    organisation: "Demo",
    consent_given: true,
  });
  expect(f.visitors.get(existing)?.consent_at).toEqual(expect.any(String));
  expect(f.identifiers.get("email:caller@example.org")!.visitor_id).toBe(existing);
  expect(f.identifiers.get("phone:+27827654321")!.visitor_id).toBe(existing);
});

test("existing email or phone can still attach a new browser to its known visitor", async () => {
  for (const [kind, value] of [
    ["email", "caller@example.org"],
    ["phone", "+27821234567"],
  ]) {
    const f = fixture();
    const existing = f.addVisitor({
      full_name: "Known caller",
      consent_given: true,
      consent_at: "already-given",
    });
    f.bind(kind!, value!, existing);
    const result = await resolveVisitor(f.db, {
      browserToken,
      contact: { [kind!]: value, consent: false },
    });
    expect(result).toEqual({ visitorId: existing, returning: true, knownName: "Known caller" });
    expect(f.visitors.size).toBe(1);
    expect(f.identifiers.get(`browser_token:${browserToken}`)!.visitor_id).toBe(existing);
    expect(f.visitors.get(existing)).toMatchObject({
      consent_given: true,
      consent_at: "already-given",
    });
  }
});

test("a new visitor without consent remains unconsented after claiming its browser", async () => {
  const f = fixture();
  const result = await resolveVisitor(f.db, { browserToken });
  expect(result).toMatchObject({ returning: false, knownName: null });
  expect(f.visitors.get(result.visitorId)).toMatchObject({
    consent_given: false,
    consent_at: null,
  });
  expect(f.identifiers.get(`browser_token:${browserToken}`)!.visitor_id).toBe(result.visitorId);
});

test("saved contact is remembered when the same browser returns without resending personal details", async () => {
  const f = fixture();
  const initial = await resolveVisitor(f.db, { browserToken });
  await resolveVisitor(f.db, { browserToken, contact: { fullName: "Remembered Visitor", email: "visitor@example.invalid", consent: true } });
  const returned = await resolveVisitor(f.db, { browserToken });
  expect(returned).toEqual({ visitorId: initial.visitorId, returning: true, knownName: "Remembered Visitor" });
  expect(f.visitors.size).toBe(1);
  expect(f.visitors.get(returned.visitorId)).toMatchObject({ email: "visitor@example.invalid", consent_given: true });
});

test("failed contact persistence cannot report that onboarding succeeded", async () => {
  const f = fixture();
  const id = f.addVisitor();
  f.bind("browser_token", browserToken, id);
  f.settings.updateError = true;
  await expect(resolveVisitor(f.db, { browserToken, contact: { fullName: "Unsaved Visitor", email: "visitor@example.invalid", consent: true } })).rejects.toThrow("could not be saved");
  expect(f.visitors.get(id)?.full_name).toBeNull();
});

test("failed or unreadable browser claims fail closed before contact writes", async () => {
  for (const setting of ["claimError", "missingOwner"] as const) {
    const f = fixture();
    f.settings[setting] = true;
    await expect(
      resolveVisitor(f.db, { browserToken, contact: { email: "caller@example.org" } }),
    ).rejects.toThrow("Could not identify this visitor.");
    expect(f.identifiers.has("email:caller@example.org")).toBe(false);
  }
});
