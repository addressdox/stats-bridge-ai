import { expect, test } from "bun:test";
import { deliverMediaEmail, mediaEmailConfig, sendApprovedMediaEmail } from "../src/lib/statbridge/media-email.server";
import type { DraftRpcClient } from "../src/lib/statbridge/draft.contract";

const config = { apiKey: "test-only-key", from: "desk@example.invalid" };
const approved = { releaseId: "release-123", recipient: "reporter@example.invalid", reference: "CASE-123", body: "The official's exact approved reply.\n\nSecond paragraph." };
const claim = { ...approved, state: "queued", claimed: true, attemptedAt: "2026-09-19T10:00:00Z" };
function fixture(data: unknown = claim) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const staff: DraftRpcClient = { rpc: async (name, args) => { calls.push({ name, args }); return { data, error: null }; } };
  const admin: DraftRpcClient = { rpc: async (name, args) => { calls.push({ name, args }); return { data: true, error: null }; } };
  return { calls, staff, admin };
}

test("missing or invalid sender configuration cannot release or email anything", async () => {
  expect(mediaEmailConfig({})).toBe(null);
  expect(mediaEmailConfig({ RESEND_API_KEY: "test", MEDIA_EMAIL_FROM: "not-email" })).toBe(null);
  expect(mediaEmailConfig({ RESEND_API_KEY: "test", MEDIA_EMAIL_FROM: config.from })).toEqual({ apiKey: "test", from: config.from });
  const f = fixture();
  await expect(sendApprovedMediaEmail({ ...f, caseId: "case-1", config: null })).rejects.toThrow("not configured");
  expect(f.calls).toHaveLength(0);
});

test("email uses the saved recipient, exact approved body and stable release idempotency key", async () => {
  let sent: { body: any; headers: Headers } | null = null;
  const request = (async (_url, init) => {
    sent = { body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) };
    return Response.json({ id: "email-receipt-1" });
  }) as typeof fetch;
  expect(await deliverMediaEmail(approved, config, request)).toEqual({ ok: true, providerId: "email-receipt-1" });
  expect(sent!.body.to).toEqual([approved.recipient]);
  expect(sent!.body.text).toBe(approved.body);
  expect(sent!.body.html).toBeUndefined();
  expect(sent!.headers.get("Idempotency-Key")).toBe("naledi-media-release-123");
});

test("invalid media email never reaches the email service", async () => {
  let calls = 0;
  const request = (async () => { calls++; return Response.json({ id: "no" }); }) as typeof fetch;
  expect((await deliverMediaEmail({ ...approved, recipient: "+27 123456789" }, config, request)).ok).toBe(false);
  expect(calls).toBe(0);
});

test("only a provider receipt can become Sent", async () => {
  for (const response of [Response.json({}), Response.json({ message: "provider secret" }, { status: 500 })]) {
    const result = await deliverMediaEmail(approved, config, (async () => response) as typeof fetch);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain("provider secret");
      expect(result.retrySafe).toBe(false);
    }
  }
});

test("network uncertainty remains retry-protected and confirmed rejection may be retried", async () => {
  const uncertain = await deliverMediaEmail(approved, config, (async () => { throw new Error("network"); }) as typeof fetch);
  expect(uncertain.ok).toBe(false);
  if (!uncertain.ok) expect(uncertain.retrySafe).toBe(false);
  const rejected = await deliverMediaEmail(approved, config, (async () => Response.json({}, { status: 422 })) as typeof fetch);
  if (!rejected.ok) expect(rejected.retrySafe).toBe(true);
});

test("sending requires the authenticated approval claim and persists its receipt", async () => {
  const f = fixture();
  const result = await sendApprovedMediaEmail({ ...f, caseId: "case-1", config, deliver: async (input) => {
    expect(input).toEqual(approved);
    return { ok: true, providerId: "receipt-1" };
  } });
  expect(result).toEqual({ state: "sent", error: null });
  expect(f.calls).toEqual([
    { name: "claim_media_email", args: { _case_id: "case-1" } },
    { name: "finish_media_email", args: { _release_id: approved.releaseId, _attempted_at: claim.attemptedAt, _state: "sent", _provider_id: "receipt-1", _error: null, _retry_safe: false } },
  ]);
});

test("missing approval or release permission never reaches email delivery", async () => {
  const f = fixture();
  f.staff.rpc = async () => ({ data: null, error: { message: "Only an approved case can be released" } });
  let sends = 0;
  await expect(sendApprovedMediaEmail({ ...f, caseId: "case-1", config, deliver: async () => { sends++; return { ok: true, providerId: "bad" }; } })).rejects.toThrow("approved");
  expect(sends).toBe(0);
});

test("concurrent or repeated Send cannot deliver an already claimed release again", async () => {
  for (const state of ["sent", "queued"] as const) {
    const f = fixture({ releaseId: approved.releaseId, claimed: false, state });
    let sends = 0;
    expect(await sendApprovedMediaEmail({ ...f, caseId: "case-1", config, deliver: async () => { sends++; return { ok: true, providerId: "bad" }; } })).toEqual({ state, error: null });
    expect(sends).toBe(0);
    expect(f.calls).toHaveLength(1);
  }
});

test("failed delivery persists failure rather than displaying success", async () => {
  const f = fixture();
  expect(await sendApprovedMediaEmail({ ...f, caseId: "case-1", config, deliver: async () => ({ ok: false, message: "Please retry.", retrySafe: false }) })).toEqual({ state: "failed", error: "Please retry." });
  expect(f.calls[1]?.args._state).toBe("failed");
  expect(f.calls[1]?.args._retry_safe).toBe(false);
});

test("lost receipt persistence does not falsely confirm success", async () => {
  const f = fixture();
  f.admin.rpc = async () => ({ data: false, error: null });
  await expect(sendApprovedMediaEmail({ ...f, caseId: "case-1", config, deliver: async () => ({ ok: true, providerId: "receipt" }) })).rejects.toThrow("status could not be confirmed");
});
