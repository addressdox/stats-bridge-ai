import { createFileRoute } from "@tanstack/react-router";

import { caseStatusRequestSchema, CASE_STATUS_LABELS, type CaseStatus } from "@/lib/statbridge/contract";

import { apiVersioned, badRequest, jsonResponse, notFound, preflight } from "./_shared";

export const Route = createFileRoute("/api/public/v1/case-status")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return badRequest("The request body must be JSON.");
        }

        const parsed = caseStatusRequestSchema.safeParse(payload);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          return badRequest(`${issue?.path.join(".") || "body"}: ${issue?.message ?? "invalid"}`);
        }

        const { getAdminClient, hashToken } = await import("@/lib/statbridge/pipeline.server");
        const db = await getAdminClient();

        const { data: row } = await db
          .from("cases")
          .select("reference, status, received_at, deadline_at, released_at, closed_reason, status_token_hash")
          .eq("reference", parsed.data.reference.trim().toUpperCase())
          .maybeSingle();

        // A wrong token and a case that does not exist look identical, on purpose.
        if (!row || row.status_token_hash !== hashToken(parsed.data.token.trim())) {
          return notFound("No case matches that reference and token.");
        }

        let releasedBody: string | null = null;
        let releasedReferences: CaseStatus["releasedReferences"] = [];
        if (row.status === "released") {
          const { data: release } = await db
            .from("releases")
            .select("released_body, released_references, case_id, cases!inner(reference)")
            .eq("cases.reference", row.reference)
            .order("released_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          releasedBody = release?.released_body ?? null;
          releasedReferences = (release?.released_references as CaseStatus["releasedReferences"]) ?? [];
        }

        const status: CaseStatus = {
          reference: row.reference,
          status: row.status,
          statusLabel: CASE_STATUS_LABELS[row.status],
          receivedAt: row.received_at,
          deadlineAt: row.deadline_at,
          releasedAt: row.released_at,
          releasedBody,
          releasedReferences,
          closedReason: row.status === "rejected" ? row.closed_reason : null,
        };

        return jsonResponse(apiVersioned(status));
      },
    },
  },
});
