import { z } from "zod";
import type { DraftRpcClient } from "./draft.contract";

const emailAddress = z.string().trim().email().max(200);
export type MediaEmailConfig = { apiKey: string; from: string };
export type EmailResult =
  | { ok: true; providerId: string }
  | { ok: false; message: string; retrySafe: boolean };

/** Accept one mailbox only; preserve a configured display name without nesting it. */
function formatMediaEmailSender(value: string): string | null {
  if (/[\u0000-\u001f\u007f]/.test(value) || value.length > 320) return null;
  const sender = value.trim();
  if (emailAddress.safeParse(sender).success) return `Naledi <${sender}>`;
  const mailbox = /^("(?:[^"\\]|\\[\\"])+"|[^<>"\\,;:@]+)\s*<([^<>]+)>$/.exec(sender);
  if (!mailbox?.[1]?.trim() || !emailAddress.safeParse(mailbox[2]).success) return null;
  return `${mailbox[1].trim()} <${mailbox[2]!.trim()}>`;
}

export function mediaEmailConfig(env: Record<string, string | undefined> = process.env): MediaEmailConfig | null {
  const apiKey = env["RESEND_API_KEY"]?.trim() || env["RESEND_KEY"]?.trim();
  const from = env["MEDIA_EMAIL_FROM"]?.trim() ? env["MEDIA_EMAIL_FROM"] : env["RESEND_FROM"];
  if (!apiKey || !from || !formatMediaEmailSender(from)) return null;
  return { apiKey, from: from.trim() };
}

export async function deliverMediaEmail(
  input: { releaseId: string; recipient: string; reference: string; body: string },
  config: MediaEmailConfig,
  request: typeof fetch = fetch,
): Promise<EmailResult> {
  if (!emailAddress.safeParse(input.recipient).success)
    return { ok: false, message: "This media request does not contain a valid email address.", retrySafe: true };
  const from = formatMediaEmailSender(config.from);
  if (!from)
    return { ok: false, message: "The approved email sender is not configured correctly.", retrySafe: true };
  try {
    const response = await request("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `naledi-media-${input.releaseId}`,
      },
      // Plain text preserves the official's exact approved wording, including
      // line breaks, without treating it as HTML or generating new AI content.
      body: JSON.stringify({
        from,
        to: [input.recipient],
        subject: `Response to media enquiry ${input.reference.replace(/[\r\n]/g, " ")}`,
        text: input.body,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        message: response.status === 429
          ? "The email service is busy. Please retry shortly."
          : "The email could not be sent. Please retry or ask an administrator to check email delivery.",
        // Timeouts/conflicts/5xx can leave acceptance uncertain; preserve the
        // same idempotency key and enforce the retry window in the database.
        retrySafe: response.status >= 400 && response.status < 500 && ![408, 409].includes(response.status),
      };
    }
    const result = await response.json() as { id?: unknown };
    if (typeof result.id !== "string" || !result.id.trim())
      return { ok: false, message: "The email service did not confirm the send. Please retry shortly.", retrySafe: false };
    return { ok: true, providerId: result.id };
  } catch {
    return { ok: false, message: "Email delivery could not be confirmed. Please retry shortly.", retrySafe: false };
  }
}

type Claim = {
  releaseId: string;
  state: "sent" | "queued";
  claimed: boolean;
  attemptedAt?: string;
  recipient?: string;
  reference?: string;
  body?: string;
};

/** The authenticated claim RPC, not a browser payload, selects recipient and wording. */
export async function sendApprovedMediaEmail(input: {
  caseId: string;
  staff: DraftRpcClient;
  admin: DraftRpcClient;
  config: MediaEmailConfig | null;
  deliver?: typeof deliverMediaEmail;
}): Promise<{ state: "sent" | "queued" | "failed"; error: string | null }> {
  if (!input.config)
    throw new Error("Email delivery is not configured. Ask an administrator to connect the approved sender.");
  const claimed = await input.staff.rpc("claim_media_email", { _case_id: input.caseId });
  if (claimed.error) throw new Error(claimed.error.message);
  const claim = claimed.data as Claim | null;
  if (!claim?.releaseId) throw new Error("The approved response could not be prepared for sending.");
  if (!claim.claimed) return { state: claim.state, error: null };
  if (!claim.attemptedAt || !claim.recipient || !claim.reference || !claim.body)
    throw new Error("The approved response could not be prepared for sending.");
  const result = await (input.deliver ?? deliverMediaEmail)({
    releaseId: claim.releaseId,
    recipient: claim.recipient,
    reference: claim.reference,
    body: claim.body,
  }, input.config);
  const state = result.ok ? "sent" : "failed";
  const saved = await input.admin.rpc("finish_media_email", {
    _release_id: claim.releaseId,
    _attempted_at: claim.attemptedAt,
    _state: state,
    _provider_id: result.ok ? result.providerId : null,
    _error: result.ok ? null : result.message,
    _retry_safe: result.ok ? false : result.retrySafe,
  });
  if (saved.error || saved.data !== true)
    throw new Error("The delivery status could not be confirmed. Refresh the request before retrying.");
  return { state, error: result.ok ? null : result.message };
}
