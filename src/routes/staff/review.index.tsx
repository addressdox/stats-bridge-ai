import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, type SearchSchemaInput } from "@tanstack/react-router";
import { AlertTriangle, Clock, Inbox, Loader2, Search } from "lucide-react";

import { useCallback, useEffect, useState } from "react";
import { beginPressRelease } from "@/lib/staff/draft.functions";
import { useStaff } from "@/lib/staff/useStaff";

import { StaffShell } from "@/components/statbridge/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { REVIEW_REASON_LABELS } from "@/lib/statbridge/contract";
import { Button } from "@/components/ui/button";
import { loadMediaDelivery, loadReviewQueue, reviewQueueSearchSchema, type ReviewQueueSearch } from "@/lib/staff/review-queue";

const title = "Review queue — Naledi staff";
const description = "Requests for Stats SA communications officials, newest first.";

export const Route = createFileRoute("/staff/review/")({
  validateSearch: (search: SearchSchemaInput & Partial<ReviewQueueSearch>) => reviewQueueSearchSchema.parse(search),
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
  component: ReviewQueuePage,
});

const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  draft_prepared: "Draft prepared",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  released: "Released",
  rejected: "Rejected",
};

function deadlineTone(deadline: string | null) {
  if (!deadline) return "text-muted-foreground";
  const hours = (new Date(deadline).getTime() - Date.now()) / 3_600_000;
  if (hours < 0) return "text-destructive font-semibold";
  if (hours < 6) return "text-warn-foreground font-semibold";
  return "text-muted-foreground";
}

function ReviewQueuePage() {
  const { can, profile } = useStaff();
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const pressDraft = useMutation({
    mutationFn: () => beginPressRelease({ data: { topic } }),
    onSuccess: (result) => navigate({ to: "/staff/review/$id", params: { id: result.caseId } }),
  });
  const filters = Route.useSearch();
  const updateFilters = useCallback((patch: Partial<ReviewQueueSearch>) => {
    void navigate({ to: "/staff/review", search: (current) => ({ ...reviewQueueSearchSchema.parse(current), ...patch }), replace: true });
  }, [navigate]);
  const query = useQuery({
    queryKey: ["review-queue", "cases", profile?.id, filters.q, filters.page, filters.size, filters.status, filters.kind, filters.attention, filters.assignment],
    queryFn: ({ signal }) => loadReviewQueue(supabase, filters, profile!.id, signal),
    enabled: can.review && Boolean(profile),
  });
  const emailQuery = useQuery({
    queryKey: ["review-queue", "email-delivery", profile?.id, filters.emailQ, filters.emailPage, filters.size, filters.delivery, filters.emailAttention],
    queryFn: ({ signal }) => loadMediaDelivery(supabase, filters, signal),
    enabled: can.review || can.release,
    refetchInterval: (current) => current.state.data?.rows.some((item) => item.delivery_state === "queued") ? 3000 : false,
  });
  // A case can leave a queue while an official is on its final page.
  useEffect(() => {
    if (!query.data) return;
    if (query.data.page !== filters.page) { updateFilters({ page: query.data.page }); return; }
    const lastPage = Math.max(1, Math.ceil(query.data.total / filters.size));
    if (filters.page > lastPage) updateFilters({ page: lastPage });
  }, [query.data, filters.page, filters.size, updateFilters]);
  useEffect(() => {
    if (!emailQuery.data) return;
    if (emailQuery.data.page !== filters.emailPage) { updateFilters({ emailPage: emailQuery.data.page }); return; }
    const lastPage = Math.max(1, Math.ceil(emailQuery.data.total / filters.size));
    if (filters.emailPage > lastPage) updateFilters({ emailPage: lastPage });
  }, [emailQuery.data, filters.emailPage, filters.size, updateFilters]);

  return (
    <StaffShell title="Review queue">
      {can.review && (
        <section className="surface-panel mb-5 p-4">
          <h2 className="text-sm font-semibold">Draft a press release</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Start from approved sources. The draft stays internal until an official reviews and
            releases it.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              aria-label="Press release topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic, reference period and geography"
              maxLength={1200}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
            <button
              disabled={pressDraft.isPending || topic.trim().length < 10}
              onClick={() => pressDraft.mutate()}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {pressDraft.isPending ? "Preparing draft…" : "Prepare private draft"}
            </button>
          </div>
          {pressDraft.isError && (
            <p className="mt-2 text-sm text-destructive">{pressDraft.error.message}</p>
          )}
        </section>
      )}
      {can.review && <section className="surface-panel mb-4 space-y-3 p-4" aria-label="Review queue search and filters">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold">Requests</h2><p className="mt-1 text-xs text-muted-foreground">Newest received first. Choose All statuses to include released and rejected requests.</p></div>
          <label className="text-xs font-medium">Per page<select aria-label="Requests per page" className={`${filterInput} ml-2 w-auto`} value={filters.size} onChange={(event) => updateFilters({ size: Number(event.target.value) as 10 | 25 | 50, page: 1, emailPage: 1 })}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
        </div>
        <QueueSearch label="Search requests" value={filters.q} placeholder="Reference, question or assigned official" search={(q) => updateFilters({ q, page: 1 })}/>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium">Request status<select className={`${filterInput} mt-1`} value={filters.status} onChange={(event) => updateFilters({ status: event.target.value as ReviewQueueSearch["status"], page: 1 })}><option value="open">Open requests</option><option value="all">All statuses</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs font-medium">Request type<select className={`${filterInput} mt-1`} value={filters.kind} onChange={(event) => updateFilters({ kind: event.target.value as ReviewQueueSearch["kind"], page: 1 })}><option value="all">All types</option><option value="media">Media request</option><option value="public_escalation">Public escalation</option></select></label>
          <label className="text-xs font-medium">Attention<select className={`${filterInput} mt-1`} value={filters.attention} onChange={(event) => updateFilters({ attention: event.target.value as ReviewQueueSearch["attention"], page: 1 })}><option value="all">All requests</option><option value="sensitive">Sensitive</option><option value="complex">Complex</option><option value="source_changed">A source changed</option></select></label>
          <label className="text-xs font-medium">Assigned to<select className={`${filterInput} mt-1`} value={filters.assignment} onChange={(event) => updateFilters({ assignment: event.target.value as ReviewQueueSearch["assignment"], page: 1 })}><option value="all">Anyone</option><option value="mine">Assigned to me</option><option value="unassigned">Unassigned</option></select></label>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => updateFilters({ q: "", status: "open", kind: "all", attention: "all", assignment: "all", page: 1 })}>Clear request filters</Button>
      </section>}
      {can.review && query.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Loading the queue…
        </p>
      )}

      {query.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">The queue could not be loaded.</p>
          <p className="mt-1">
            If this keeps happening, your account may not have permission to see cases. Ask a
            communications manager.
          </p>
          <button
            onClick={() => query.refetch()}
            className="mt-2 font-semibold underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {query.isSuccess && query.data.rows.length === 0 && (
        <div className="surface-panel grid place-items-center p-12 text-center">
          <Inbox aria-hidden className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No matching requests</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Try another search or change the filters. Released and rejected requests are available under All statuses.
          </p>
        </div>
      )}

      {query.isSuccess && query.data.rows.length > 0 && (
        <ul className="space-y-3">
          {query.data.rows.map((row) => (
            <li key={row.case_id as string}>
              <Link
                to="/staff/review/$id"
                params={{ id: row.case_id as string }}
                className="surface-panel block p-4 transition-colors hover:border-accent/50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{row.reference}</span>
                  <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                    {row.kind === "media" ? "Media request" : "Public escalation"}
                  </span>
                  {row.review_reasons?.includes("sensitive") && (
                    <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                      <AlertTriangle aria-hidden className="size-3" />Sensitive request
                    </span>
                  )}
                  {row.review_reasons?.includes("complex") && (
                    <span className="rounded bg-warn-surface px-2 py-0.5 text-[11px] font-semibold text-warn-foreground">Complex request</span>
                  )}
                  <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {STATUS_LABELS[row.status as string] ?? row.status}
                  </span>
                  {row.kind === "media" && row.status !== "released" && <span className="text-[11px] text-muted-foreground">Email: not sent</span>}
                  {row.source_changed && (
                    <span className="inline-flex items-center gap-1 rounded bg-warn-surface px-2 py-0.5 text-[11px] font-semibold text-warn-foreground">
                      <AlertTriangle aria-hidden className="size-3" />A source changed
                    </span>
                  )}
                  {row.is_demo_seed && (
                    <span className="rounded bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn-foreground">
                      Demonstration
                    </span>
                  )}
                </div>

                <p className="mt-2 line-clamp-2 text-sm text-foreground">{row.question_text}</p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  {row.received_at && <span className="text-muted-foreground">Received {new Date(row.received_at).toLocaleString("en-ZA")}</span>}
                  <span
                    className={`inline-flex items-center gap-1 ${deadlineTone(row.deadline_at as string | null)}`}
                  >
                    <Clock aria-hidden className="size-3" />
                    {row.deadline_at
                      ? `Deadline ${new Date(row.deadline_at as string).toLocaleString("en-ZA")}`
                      : "No deadline given"}
                  </span>
                  <span className="text-muted-foreground">
                    {row.assigned_to_name ? `Assigned to ${row.assigned_to_name}` : "Unassigned"}
                  </span>
                  <span className="text-muted-foreground">
                    {(row.draft_count as number) > 0
                      ? `${row.draft_count} draft versions`
                      : "No draft yet"}
                  </span>
                  {(row.review_reasons as string[] | null)?.length ? (
                    <span className="text-muted-foreground">
                      {(row.review_reasons as string[])
                        .map((r) => REVIEW_REASON_LABELS[r] ?? r)
                        .join(", ")}
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {query.isSuccess && <QueuePages label="Requests" page={filters.page} total={query.data.total} size={filters.size} busy={query.isFetching} change={(page) => updateFilters({ page })}/>}
      {(can.review || can.release) && <section className="mt-6 space-y-3" aria-label="Media email delivery">
        <h2 className="text-sm font-semibold">Media email delivery</h2>
        <p className="text-xs text-muted-foreground">All released media responses, newest released first. Open a request to check its email or retry a failed send.</p>
        <div className="surface-panel space-y-3 p-4">
          <QueueSearch label="Search media delivery" value={filters.emailQ} placeholder="Reference or question" search={(emailQ) => updateFilters({ emailQ, emailPage: 1 })}/>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium">Delivery status<select className={`${filterInput} mt-1`} value={filters.delivery} onChange={(event) => updateFilters({ delivery: event.target.value as ReviewQueueSearch["delivery"], emailPage: 1 })}><option value="all">All delivery statuses</option><option value="sent">Sent</option><option value="failed">Failed to send</option><option value="queued">Sending — awaiting confirmation</option><option value="shown">Not sent</option></select></label>
            <label className="text-xs font-medium">Delivery attention<select className={`${filterInput} mt-1`} value={filters.emailAttention} onChange={(event) => updateFilters({ emailAttention: event.target.value as ReviewQueueSearch["emailAttention"], emailPage: 1 })}><option value="all">All requests</option><option value="sensitive">Sensitive</option><option value="complex">Complex</option></select></label>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => updateFilters({ emailQ: "", delivery: "all", emailAttention: "all", emailPage: 1 })}>Clear delivery filters</Button>
        </div>
        {emailQuery.isPending && <p className="text-sm text-muted-foreground">Loading delivery status…</p>}
        {emailQuery.isError && <div role="alert" className="text-sm text-destructive"><p>Email delivery status could not be loaded.</p><button type="button" className="mt-1 underline" onClick={() => emailQuery.refetch()}>Try again</button></div>}
        {emailQuery.isSuccess && emailQuery.data.rows.length === 0 && <p className="text-sm text-muted-foreground">No released media responses match these filters.</p>}
        <ul className="space-y-2">
          {(emailQuery.data?.rows ?? []).map((row) => <li key={row.id}>
            <Link to="/staff/review/$id" params={{ id: row.case_id }} className="surface-panel block p-4 transition-colors hover:border-accent/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{row.cases.reference}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">Media request</span>
                {row.cases.review_reasons?.includes("sensitive") && <span className="rounded bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">Sensitive request</span>}
                {row.cases.review_reasons?.includes("complex") && <span className="rounded bg-warn-surface px-2 py-0.5 text-[11px] font-semibold text-warn-foreground">Complex request</span>}
                <span className={`text-xs font-medium ${row.delivery_state === "sent" ? "text-accent" : row.delivery_state === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
                  {row.delivery_state === "sent" ? "Sent" : row.delivery_state === "failed" ? "Failed to send" : row.delivery_state === "queued" ? "Sending — awaiting confirmation" : "Not sent"}
                </span>
                {row.cases.is_demo_seed && <span className="rounded bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn-foreground">Demonstration</span>}
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-foreground">{row.cases.question_text}</p>
              <p className="mt-2 text-xs text-muted-foreground">Released {new Date(row.released_at).toLocaleString("en-ZA")}</p>
            </Link>
          </li>)}
        </ul>
        {emailQuery.isSuccess && <QueuePages label="Media delivery" page={filters.emailPage} total={emailQuery.data.total} size={filters.size} busy={emailQuery.isFetching} change={(emailPage) => updateFilters({ emailPage })}/>}
      </section>}
    </StaffShell>
  );
}


const filterInput = "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-normal";

function QueueSearch({ label, value, placeholder, search }: { label: string; value: string; placeholder: string; search: (value: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  return <form className="flex gap-2" role="search" aria-label={label} onSubmit={(event) => { event.preventDefault(); search(text.trim()); }}>
    <div className="relative min-w-0 flex-1"><Search aria-hidden className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><input type="search" aria-label={label} className={`${filterInput} pl-9`} value={text} maxLength={200} placeholder={placeholder} onChange={(event) => setText(event.target.value)}/></div>
    <Button type="submit" variant="outline">Search</Button>
  </form>;
}

function QueuePages({ label, page, total, size, busy, change }: { label: string; page: number; total: number; size: number; busy: boolean; change: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <nav aria-label={`${label} pagination`} className="my-4 flex flex-wrap items-center justify-between gap-3">
    <p className="text-xs text-muted-foreground" aria-live="polite">{total === 0 ? "0 results" : `${(page - 1) * size + 1}–${Math.min(page * size, total)} of ${total}`} · Page {page} of {pages}</p>
    <div className="flex gap-2">
      <Button type="button" variant="outline" size="sm" disabled={page <= 1 || busy} onClick={() => change(1)} aria-label={`First ${label.toLowerCase()} page`}>First</Button>
      <Button type="button" variant="outline" size="sm" disabled={page <= 1 || busy} onClick={() => change(page - 1)} aria-label={`Previous ${label.toLowerCase()} page`}>Previous</Button>
      <Button type="button" variant="outline" size="sm" disabled={page >= pages || busy} onClick={() => change(page + 1)} aria-label={`Next ${label.toLowerCase()} page`}>Next</Button>
      <Button type="button" variant="outline" size="sm" disabled={page >= pages || busy} onClick={() => change(pages)} aria-label={`Last ${label.toLowerCase()} page`}>Last</Button>
    </div>
  </nav>;
}
