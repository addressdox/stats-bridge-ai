import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, Inbox, Loader2 } from "lucide-react";

import { StaffShell } from "@/components/statbridge/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { REVIEW_REASON_LABELS } from "@/lib/statbridge/contract";

const title = "Review queue — StatBridge staff";
const description = "Cases waiting for a Stats SA communications official, most urgent first.";

export const Route = createFileRoute("/staff/review/")({
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
};

function deadlineTone(deadline: string | null) {
  if (!deadline) return "text-muted-foreground";
  const hours = (new Date(deadline).getTime() - Date.now()) / 3_600_000;
  if (hours < 0) return "text-destructive font-semibold";
  if (hours < 6) return "text-warn-foreground font-semibold";
  return "text-muted-foreground";
}

function ReviewQueuePage() {
  const query = useQuery({
    queryKey: ["review-queue"],
    queryFn: async () => {
      const { data, error } = await supabase.from("review_queue").select("*");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <StaffShell title="Review queue">
      {query.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Loading the queue…
        </p>
      )}

      {query.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">The queue could not be loaded.</p>
          <p className="mt-1">
            If this keeps happening, your account may not have permission to see cases. Ask a communications manager.
          </p>
          <button onClick={() => query.refetch()} className="mt-2 font-semibold underline underline-offset-2">
            Try again
          </button>
        </div>
      )}

      {query.isSuccess && query.data.length === 0 && (
        <div className="surface-panel grid place-items-center p-12 text-center">
          <Inbox aria-hidden className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Nothing waiting</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Media enquiries and escalated public questions appear here, most urgent first.
          </p>
        </div>
      )}

      {query.isSuccess && query.data.length > 0 && (
        <ul className="space-y-3">
          {query.data.map((row) => (
            <li key={row.case_id as string}>
              <Link
                to="/staff/review/$id"
                params={{ id: row.case_id as string }}
                className="surface-panel block p-4 transition-colors hover:border-accent/50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{row.reference}</span>
                  <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                    {row.kind === "media" ? "Media" : "Public escalation"}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {STATUS_LABELS[row.status as string] ?? row.status}
                  </span>
                  {row.source_changed && (
                    <span className="inline-flex items-center gap-1 rounded bg-warn-surface px-2 py-0.5 text-[11px] font-semibold text-warn-foreground">
                      <AlertTriangle aria-hidden className="size-3" />
                      A source changed
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
                  <span className={`inline-flex items-center gap-1 ${deadlineTone(row.deadline_at as string | null)}`}>
                    <Clock aria-hidden className="size-3" />
                    {row.deadline_at
                      ? `Deadline ${new Date(row.deadline_at as string).toLocaleString("en-ZA")}`
                      : "No deadline given"}
                  </span>
                  <span className="text-muted-foreground">
                    {row.assigned_to_name ? `Assigned to ${row.assigned_to_name}` : "Unassigned"}
                  </span>
                  <span className="text-muted-foreground">
                    {(row.draft_count as number) > 0 ? `${row.draft_count} draft versions` : "No draft yet"}
                  </span>
                  {(row.review_reasons as string[] | null)?.length ? (
                    <span className="text-muted-foreground">
                      {(row.review_reasons as string[]).map((r) => REVIEW_REASON_LABELS[r] ?? r).join(", ")}
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </StaffShell>
  );
}
