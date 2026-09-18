import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { StaffShell } from "@/components/statbridge/StaffShell";
import { supabase } from "@/integrations/supabase/client";

const title = "Insights — StatBridge staff";
const description = "What the public is asking Stats SA, where the gaps are, and how long media replies take.";

export const Route = createFileRoute("/staff/insights")({
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
  component: InsightsPage,
});

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function InsightsPage() {
  const topics = useQuery({
    queryKey: ["insight-topics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("insight_topics").select("*");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const gaps = useQuery({
    queryKey: ["insight-gaps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("insight_gaps").select("*");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const turnaround = useQuery({
    queryKey: ["insight-turnaround"],
    queryFn: async () => {
      const { data, error } = await supabase.from("insight_turnaround").select("*");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const loading = topics.isPending || gaps.isPending || turnaround.isPending;
  const failed = topics.isError || gaps.isError || turnaround.isError;

  const hours = (turnaround.data ?? [])
    .map((r) => r.hours_to_release)
    .filter((h): h is number => typeof h === "number");
  const average = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null;
  const mid = median(hours);
  const metDeadline = (turnaround.data ?? []).filter((r) => r.met_deadline === true).length;
  const withDeadline = (turnaround.data ?? []).filter((r) => r.deadline_at !== null).length;

  const windows = (topics.data ?? [])
    .map((t) => t.window_start)
    .filter((w): w is string => Boolean(w))
    .sort();
  const windowStart = windows[0] ?? null;

  const includesDemo =
    (topics.data ?? []).some((t) => t.includes_demo_seed) ||
    (gaps.data ?? []).some((g) => g.includes_demo_seed) ||
    (turnaround.data ?? []).some((t) => t.is_demo_seed);

  return (
    <StaffShell title="Insights">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Every number here is counted from real records in this system. Nothing is estimated, and no claim is made about
        accuracy, savings or staff capacity.
        {windowStart ? ` Counts cover activity from ${new Date(windowStart).toLocaleDateString("en-ZA")} onward.` : ""}
      </p>

      {includesDemo && (
        <p className="mt-3 inline-block rounded bg-warn/15 px-2 py-1 text-xs font-semibold text-warn-foreground">
          These figures include demonstration records.
        </p>
      )}

      {loading && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Counting the records…
        </p>
      )}

      {failed && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          The insights could not be loaded. Your account may not have permission to see them.
        </div>
      )}

      {!loading && !failed && (
        <div className="mt-6 space-y-6">
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat label="Media replies measured" value={hours.length ? String(hours.length) : "—"} />
            <Stat
              label="Average time to release"
              value={average === null ? "—" : `${average.toFixed(1)} hours`}
              note="From the request arriving to the wording being released."
            />
            <Stat label="Median time to release" value={mid === null ? "—" : `${mid.toFixed(1)} hours`} />
          </section>

          <section className="surface-panel p-4">
            <h2 className="text-sm font-semibold">Deadlines</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {withDeadline === 0
                ? "No released case carried a stated deadline."
                : `${metDeadline} of ${withDeadline} released cases with a stated deadline were released in time.`}
            </p>
          </section>

          <section className="surface-panel p-4">
            <h2 className="text-sm font-semibold">Most-asked topics and what happened</h2>
            {(topics.data ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No questions have been recorded yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <caption className="sr-only">Question counts by topic and outcome</caption>
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-4">Topic</th>
                      <th scope="col" className="py-2 pr-4">Outcome</th>
                      <th scope="col" className="py-2 pr-4">Questions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(topics.data ?? []).map((t, i) => (
                      <tr key={`${t.topic}-${t.outcome}-${i}`} className="border-b border-border/60">
                        <td className="py-2 pr-4">{t.topic ?? "Not classified"}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{t.outcome}</td>
                        <td className="py-2 pr-4 font-mono">{t.question_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="surface-panel p-4">
            <h2 className="text-sm font-semibold">Where StatBridge could not answer</h2>
            {(gaps.data ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No unanswered questions have been recorded.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {(gaps.data ?? []).map((g, i) => (
                  <li key={`${g.topic}-${i}`} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold">{g.topic ?? "Not classified"}</span>
                      <span className="font-mono text-muted-foreground">{g.gap_count} questions</span>
                      {g.most_recent && (
                        <span className="text-muted-foreground">
                          most recent {new Date(g.most_recent).toLocaleDateString("en-ZA")}
                        </span>
                      )}
                    </div>
                    {g.recent_example && <p className="mt-1.5 text-sm text-muted-foreground">“{g.recent_example}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </StaffShell>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="surface-panel p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
