import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ScrollText } from "lucide-react";

import { StaffShell } from "@/components/statbridge/StaffShell";
import { useServerFn } from "@tanstack/react-start";
import { getDecisionRecord } from "@/lib/statbridge/governance.functions";

const title = "Decision record — StatBridge staff";
const description = "Who drafted, approved and released each Stats SA response, against which sources and rules.";

export const Route = createFileRoute("/staff/record")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecordPage,
});

function RecordPage() {
  const fetchRecord = useServerFn(getDecisionRecord);
  const query = useQuery({
    queryKey: ["decision-record"],
    queryFn: () => fetchRecord({ data: { limit: 100, offset: 0 } }),
  });

  return (
    <StaffShell title="Decision record">
      <p className="max-w-2xl text-sm text-muted-foreground">
        One row for every released response: the question, who wrote it, who approved which exact version, who
        released it, the sources it rested on and the house style in force at the time.
      </p>

      {query.isPending && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Loading the record…
        </p>
      )}

      {query.isError && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          The record could not be loaded: {(query.error as Error).message}
        </div>
      )}

      {query.isSuccess && query.data.length === 0 && (
        <div className="surface-panel mt-6 grid place-items-center p-12 text-center">
          <ScrollText aria-hidden className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Nothing has been released yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            As soon as a response is approved and released, its full decision history appears here.
          </p>
        </div>
      )}

      {query.isSuccess && query.data.length > 0 && (
        <ul className="mt-6 space-y-3">
          {query.data.map((r) => (
            <li key={r.release_id ?? r.reference ?? ""} className="surface-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{r.reference}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{r.kind}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                  version {r.released_version}
                </span>
                {r.is_demo_seed && (
                  <span className="rounded bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn-foreground">
                    Demonstration
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm">{r.question_text}</p>

              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <Line
                  label="First draft"
                  value={r.first_author_kind === "ai" ? "Assistant suggestion, edited by a person" : "Written by a person"}
                />
                <Line label="Approved by" value={r.approved_by_name ?? "—"} />
                <Line
                  label="Approved at"
                  value={r.approved_at ? new Date(r.approved_at).toLocaleString("en-ZA") : "—"}
                />
                <Line label="Released by" value={r.released_by_name ?? "—"} />
                <Line
                  label="Released at"
                  value={r.released_at ? new Date(r.released_at).toLocaleString("en-ZA") : "—"}
                />
                <Line label="Approval basis" value={r.approval_basis ?? "—"} />
                <Line label="Version fingerprint" value={r.fingerprint ? r.fingerprint.slice(0, 16) : "—"} mono />
                <Line
                  label="Supporting sources"
                  value={r.source_version_ids?.length ? `${r.source_version_ids.length} source versions` : "None recorded"}
                />
                <Line label="House style in force" value={r.guideline_id ? r.guideline_id.slice(0, 8) : "—"} mono />
                <Line label="Filed in memory" value={r.memory_item_id ? "Yes" : "No"} />
              </dl>
            </li>
          ))}
        </ul>
      )}
    </StaffShell>
  );
}

function Line({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : "text-xs"}>{value}</dd>
    </div>
  );
}
