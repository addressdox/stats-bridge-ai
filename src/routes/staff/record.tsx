import { Fragment, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, FileCheck2, ScrollText, ShieldCheck } from "lucide-react";
import { StaffShell } from "@/components/statbridge/StaffShell";
import {
  CollectionPagination,
  CollectionToolbar,
  collectionSelectClass,
} from "@/components/statbridge/collection-controls";
import { Empty, Loading, Panel, Pill } from "@/components/statbridge/desk-ui";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { getDecisionRecordPage } from "@/lib/statbridge/governance.functions";
import { decisionRecordSearchSchema, type DecisionRecordSearch } from "@/lib/staff/insights-record";

const title = "Decision record — Naledi staff";
const description =
  "Who drafted, approved and released each Stats SA response, against which sources and rules.";
export const Route = createFileRoute("/staff/record")({
  validateSearch: (search) => decisionRecordSearchSchema.parse(search),
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
type Decision = Database["public"]["Views"]["decision_record"]["Row"];
const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })
    : "Not recorded";

function RecordPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const fetchRecord = useServerFn(getDecisionRecordPage);
  const [expanded, setExpanded] = useState<string | null>(null);
  const update = (patch: Partial<DecisionRecordSearch>) =>
    void navigate({ search: (current) => ({ ...current, ...patch }) });
  const query = useQuery({
    queryKey: ["decision-record-page", search],
    queryFn: () => fetchRecord({ data: search }),
  });
  useEffect(() => {
    if (query.data && query.data.page !== search.page)
      void navigate({
        search: (previous) => ({ ...previous, page: query.data.page }),
        replace: true,
      });
  }, [query.data, search.page, navigate]);
  const rows = query.data?.rows ?? [];

  return (
    <StaffShell title="Decision record">
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
          <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
          <div>
            <h2 className="text-sm font-semibold">A traceable record of every released response</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Review who drafted, approved and released each response, the exact version, supporting
              evidence and guidance in force. Most recently released responses appear first.
            </p>
          </div>
        </div>
        <CollectionToolbar
          search={search.q}
          onSearch={(q) => update({ q, page: 1 })}
          searchLabel="Search decision records"
          placeholder="Search reference, question or official…"
          onReset={() => update({ ...decisionRecordSearchSchema.parse({}), size: search.size })}
        >
          <label className="grid gap-1 text-xs text-muted-foreground">
            Request type
            <select
              className={collectionSelectClass}
              value={search.kind}
              onChange={(e) =>
                update({ kind: e.target.value as DecisionRecordSearch["kind"], page: 1 })
              }
            >
              <option value="all">All request types</option>
              <option value="media">Media</option>
              <option value="public_escalation">Public escalation</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Approval basis
            <select
              className={collectionSelectClass}
              value={search.basis}
              onChange={(e) =>
                update({ basis: e.target.value as DecisionRecordSearch["basis"], page: 1 })
              }
            >
              <option value="all">All approval bases</option>
              <option value="official">Official</option>
              <option value="demonstration">Demonstration</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Memory
            <select
              className={collectionSelectClass}
              value={search.memory}
              onChange={(e) =>
                update({ memory: e.target.value as DecisionRecordSearch["memory"], page: 1 })
              }
            >
              <option value="all">All records</option>
              <option value="filed">Filed in memory</option>
              <option value="not_filed">Not filed</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Released from (UTC)
            <input
              type="date"
              className={collectionSelectClass}
              value={search.from}
              max={search.to || undefined}
              onChange={(e) => update({ from: e.target.value, page: 1 })}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Released to (UTC)
            <input
              type="date"
              className={collectionSelectClass}
              value={search.to}
              min={search.from || undefined}
              onChange={(e) => update({ to: e.target.value, page: 1 })}
            />
          </label>
        </CollectionToolbar>
        <Panel
          title="Released responses"
          description="Open a record to inspect its complete approval and evidence trail."
        >
          {query.isPending ? (
            <Loading label="Loading the decision record…" />
          ) : query.isError ? (
            <p
              role="alert"
              className="rounded border border-destructive/30 p-3 text-sm text-destructive"
            >
              The record could not be loaded: {(query.error as Error).message}
            </p>
          ) : !rows.length ? (
            <div className="py-8 text-center">
              <ScrollText aria-hidden className="mx-auto size-8 text-muted-foreground" />
              <Empty>No released responses match these filters.</Empty>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">Released responses, most recent first</caption>
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th scope="col" className="px-2 py-3 font-medium">
                      Reference and question
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Type / basis
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Approved by
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Released
                    </th>
                    <th scope="col" className="px-2 py-3 font-medium">
                      Audit trail
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((record) => (
                    <Fragment key={record.release_id ?? record.reference}>
                      <tr
                        className={`border-b border-border/60 align-top ${expanded === record.release_id ? "bg-secondary/35" : "hover:bg-secondary/20"}`}
                      >
                        <td className="max-w-sm px-2 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold">
                              {record.reference}
                            </span>
                            <Pill>Version {record.released_version}</Pill>
                          </div>
                          <p className="mt-1.5 line-clamp-2 leading-relaxed text-muted-foreground">
                            {record.question_text}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-start gap-2">
                            <Pill>{record.kind === "media" ? "Media" : "Public escalation"}</Pill>
                            <Pill tone={record.approval_basis === "official" ? "good" : "warn"}>
                              {record.approval_basis === "official"
                                ? "Official approval"
                                : "Demonstration"}
                            </Pill>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <p>{record.approved_by_name ?? "Not recorded"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {dateTime(record.approved_at)}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="whitespace-nowrap text-xs">
                            {dateTime(record.released_at)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {record.released_by_name ?? "Not recorded"}
                          </p>
                        </td>
                        <td className="px-2 py-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-expanded={expanded === record.release_id}
                            aria-controls={`audit-${record.release_id}`}
                            onClick={() =>
                              setExpanded(expanded === record.release_id ? null : record.release_id)
                            }
                          >
                            {expanded === record.release_id ? (
                              <ChevronDown aria-hidden />
                            ) : (
                              <ChevronRight aria-hidden />
                            )}
                            Details
                          </Button>
                        </td>
                      </tr>
                      {expanded === record.release_id && (
                        <tr>
                          <td
                            colSpan={5}
                            className="border-b p-4"
                            id={`audit-${record.release_id}`}
                          >
                            <DecisionDetails record={record} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!query.isError && (
            <div className="mt-4">
              <CollectionPagination
                page={query.data?.page ?? search.page}
                pageSize={search.size}
                total={query.data?.total ?? 0}
                onPageChange={(page) => update({ page })}
                onPageSizeChange={(size) =>
                  update({ size: size as DecisionRecordSearch["size"], page: 1 })
                }
                label="Decision records"
                busy={query.isFetching}
              />
            </div>
          )}
        </Panel>
      </div>
    </StaffShell>
  );
}

function DecisionDetails({ record }: { record: Decision }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FileCheck2 aria-hidden className="size-4 text-accent" />
          Decision and evidence trail
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{record.question_text}</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-surface p-3">
          <h4 className="mb-3 text-xs font-semibold">1. Drafted</h4>
          <dl className="space-y-3">
            <Line
              label="Draft origin"
              value={
                record.first_author_kind === "ai"
                  ? "Assistant-generated draft"
                  : "Written by an official"
              }
            />
            <Line label="Drafted by" value={record.drafted_by ?? "Not recorded"} />
            <Line
              label="Released version"
              value={String(record.released_version ?? "Not recorded")}
            />
          </dl>
        </section>
        <section className="rounded-lg border border-border bg-surface p-3">
          <h4 className="mb-3 text-xs font-semibold">2. Approved</h4>
          <dl className="space-y-3">
            <Line label="Approved by" value={record.approved_by_name ?? "Not recorded"} />
            <Line label="Approved at" value={dateTime(record.approved_at)} />
            <Line label="Approval basis" value={record.approval_basis ?? "Not recorded"} />
            <Line label="Approver ID" value={record.approved_by ?? "Not recorded"} mono />
          </dl>
        </section>
        <section className="rounded-lg border border-border bg-surface p-3">
          <h4 className="mb-3 text-xs font-semibold">3. Released</h4>
          <dl className="space-y-3">
            <Line label="Released by" value={record.released_by_name ?? "Not recorded"} />
            <Line label="Released at" value={dateTime(record.released_at)} />
            <Line label="Filed in memory" value={record.memory_item_id ? "Yes" : "No"} />
            <Line label="Demonstration record" value={record.is_demo_seed ? "Yes" : "No"} />
          </dl>
        </section>
      </div>
      <section className="rounded-lg border border-border bg-secondary/20 p-3">
        <h4 className="mb-3 text-xs font-semibold">Exact version and supporting evidence</h4>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Line
            label="Full version fingerprint"
            value={record.fingerprint ?? "Not recorded"}
            mono
          />
          <Line label="Guidance version ID" value={record.guideline_id ?? "Not recorded"} mono />
          <Line label="Release ID" value={record.release_id ?? "Not recorded"} mono />
          <Line label="Memory item ID" value={record.memory_item_id ?? "Not filed"} mono />
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Supporting source versions ({record.source_version_ids?.length ?? 0})
            </dt>
            <dd className="mt-1">
              {record.source_version_ids?.length ? (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {record.source_version_ids.map((id) => (
                    <li key={id} className="break-all font-mono text-xs">
                      {id}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-xs">None recorded</span>
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
function Line({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-1 break-words text-xs ${mono ? "break-all font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
