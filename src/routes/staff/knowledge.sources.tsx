import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Loader2, Radar } from "lucide-react";
import { useState } from "react";

import { StaffShell } from "@/components/statbridge/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { runKnowledgeCrawl } from "@/lib/statbridge/crawl.functions";
import { useStaff } from "@/lib/staff/useStaff";

type CrawlSummary = {
  inserted: Array<{ title: string; url: string; publisher: string }>;
  skippedExisting: number;
  errors: string[];
};

const title = "Sources — StatBridge knowledge base";
const description = "Approve, correct and withdraw the Stats SA publications StatBridge is allowed to quote.";

export const Route = createFileRoute("/staff/knowledge/sources")({
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
  component: SourcesPage,
});

const STATUS_TONE: Record<string, string> = {
  approved: "bg-accent/15 text-accent",
  pending: "bg-secondary text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
  withdrawn: "bg-warn-surface text-warn-foreground",
  superseded: "bg-secondary text-muted-foreground",
};

function SourcesPage() {
  const { can } = useStaff();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const query = useQuery({
    queryKey: ["source-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("source_versions")
        .select(
          "id, version_label, status, ingest_state, published_on, reference_period, page_count, original_url, withdrawal_reason, change_note, approved_at, sources(title, publisher, source_type, audience, topic)",
        )
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const observationCounts = useQuery({
    queryKey: ["observation-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("observations").select("source_version_id, verified_at");
      if (error) throw new Error(error.message);
      const map = new Map<string, { total: number; verified: number }>();
      for (const row of data ?? []) {
        const entry = map.get(row.source_version_id) ?? { total: 0, verified: 0 };
        entry.total += 1;
        if (row.verified_at) entry.verified += 1;
        map.set(row.source_version_id, entry);
      }
      return map;
    },
  });

  const act = useMutation({
    mutationFn: async ({ fn, versionId, reason }: { fn: "approve" | "reject" | "withdraw"; versionId: string; reason?: string }) => {
      if (fn === "approve") {
        const { error } = await supabase.rpc("approve_source", { _version_id: versionId });
        if (error) throw new Error(error.message);
        return;
      }
      if (!reason?.trim()) throw new Error("A reason is required.");
      const rpc = fn === "reject" ? "reject_source" : "withdraw_source";
      const { error } = await supabase.rpc(rpc, { _version_id: versionId, _reason: reason });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNotice({ tone: "ok", text: "The source register was updated." });
      queryClient.invalidateQueries({ queryKey: ["source-versions"] });
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    },
    onError: (e: Error) => setNotice({ tone: "bad", text: e.message }),
  });

  const [crawlResult, setCrawlResult] = useState<CrawlSummary | null>(null);
  const crawl = useMutation({
    mutationFn: async (): Promise<CrawlSummary> => runKnowledgeCrawl(),
    onSuccess: (result) => {
      setCrawlResult(result);
      queryClient.invalidateQueries({ queryKey: ["source-versions"] });
    },
    onError: (e: Error) => setNotice({ tone: "bad", text: e.message }),
  });

  return (
    <StaffShell title="Sources">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Uploading a document does not make it searchable. Only an approved version, with every figure checked by a
        person, can be quoted in an answer. Corrections keep the earlier version in the history.
      </p>

      {can.knowledge && (
        <div className="surface-panel mt-4 flex flex-wrap items-center gap-3 p-4">
          <Radar aria-hidden className="size-4 text-accent" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            The crawler watches official South African publishers and proposes new publications here as{" "}
            <span className="font-medium text-foreground">pending</span> — nothing it finds is searchable until you
            approve it.
          </p>
          <button
            onClick={() => crawl.mutate()}
            disabled={crawl.isPending}
            className="rounded-md border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent disabled:opacity-60"
          >
            {crawl.isPending ? "Crawling official sources…" : "Run crawler now"}
          </button>
        </div>
      )}

      {crawlResult && (
        <p role="status" className="mt-4 rounded-md border border-accent/40 bg-accent/10 p-3 text-sm text-foreground">
          Crawl finished: {crawlResult.inserted.length} new publication
          {crawlResult.inserted.length === 1 ? "" : "s"} proposed for approval, {crawlResult.skippedExisting} already
          known.
          {crawlResult.errors.length > 0 ? ` ${crawlResult.errors.length} source page(s) could not be reached.` : ""}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className={`mt-4 rounded-md border p-3 text-sm ${
            notice.tone === "ok"
              ? "border-accent/40 bg-accent/10 text-foreground"
              : "border-destructive/40 bg-destructive/5 text-destructive"
          }`}
        >
          {notice.text}
        </p>
      )}

      {query.isPending && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Loading the source register…
        </p>
      )}

      {query.isError && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          The register could not be loaded. Your account may not have permission to see it.
        </div>
      )}

      {query.isSuccess && query.data.length === 0 && (
        <div className="surface-panel mt-6 grid place-items-center p-12 text-center">
          <BookOpen aria-hidden className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No sources recorded yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add a Stats SA publication or organisational page, ingest its text, check the figures, then approve it.
          </p>
        </div>
      )}

      {query.isSuccess && query.data.length > 0 && (
        <ul className="mt-6 space-y-3">
          {query.data.map((v) => {
            const counts = observationCounts.data?.get(v.id);
            return (
              <li key={v.id} className="surface-panel p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{v.sources?.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">{v.version_label}</span>
                  <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[v.status] ?? ""}`}>
                    {v.status}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                    ingest: {v.ingest_state}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                    {v.sources?.audience}
                  </span>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {v.sources?.publisher} · {v.sources?.source_type}
                  {v.published_on ? ` · published ${v.published_on}` : ""}
                  {v.reference_period ? ` · ${v.reference_period}` : ""}
                  {v.page_count ? ` · ${v.page_count} pages` : ""}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Figures checked by a person: {counts ? `${counts.verified} of ${counts.total}` : "—"}
                </p>

                {v.withdrawal_reason && (
                  <p className="mt-2 rounded border border-warn/40 bg-warn-surface p-2 text-xs text-warn-foreground">
                    Withdrawn: {v.withdrawal_reason}
                  </p>
                )}

                {can.knowledge && (
                  <Actions
                    disabled={act.isPending}
                    status={v.status}
                    onApprove={() => act.mutate({ fn: "approve", versionId: v.id })}
                    onReject={(reason) => act.mutate({ fn: "reject", versionId: v.id, reason })}
                    onWithdraw={(reason) => act.mutate({ fn: "withdraw", versionId: v.id, reason })}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!can.knowledge && (
        <p className="mt-6 text-xs text-muted-foreground">
          Only a knowledge administrator may approve, reject or withdraw a source. The server refuses these actions for
          other accounts.
        </p>
      )}
    </StaffShell>
  );
}

function Actions({
  status,
  disabled,
  onApprove,
  onReject,
  onWithdraw,
}: {
  status: string;
  disabled: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onWithdraw: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      {status !== "approved" && (
        <button
          onClick={onApprove}
          disabled={disabled}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          Approve this version
        </button>
      )}
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason"
        aria-label="Reason"
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
      />
      {status === "pending" && (
        <button
          onClick={() => onReject(reason)}
          disabled={disabled || !reason.trim()}
          className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive disabled:opacity-60"
        >
          Reject
        </button>
      )}
      {status === "approved" && (
        <button
          onClick={() => onWithdraw(reason)}
          disabled={disabled || !reason.trim()}
          className="rounded-md border border-warn/50 px-3 py-1.5 text-sm font-medium text-warn-foreground disabled:opacity-60"
        >
          Withdraw
        </button>
      )}
    </div>
  );
}
