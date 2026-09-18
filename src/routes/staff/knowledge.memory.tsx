import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileClock, Loader2, Search } from "lucide-react";
import { useState } from "react";

import { StaffShell } from "@/components/statbridge/StaffShell";
import { supabase } from "@/integrations/supabase/client";

const title = "Communication memory — StatBridge knowledge base";
const description = "Approved Stats SA responses, statements and FAQs available for careful reuse.";

export const Route = createFileRoute("/staff/knowledge/memory")({
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
  component: MemoryPage,
});

const REUSE_TONE: Record<string, string> = {
  reusable: "bg-accent/15 text-accent",
  needs_review: "bg-warn-surface text-warn-foreground",
  historical_only: "bg-secondary text-muted-foreground",
  withdrawn: "bg-destructive/10 text-destructive",
};

function MemoryPage() {
  const [term, setTerm] = useState("");

  const query = useQuery({
    queryKey: ["memory-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memory_items")
        .select(
          "id, title, body, item_type, topic, audience, communicated_on, reference_period, origin, approval_basis, reuse_status, review_flag_reason, is_demo_seed, original_url",
        )
        .order("communicated_on", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const needle = term.trim().toLowerCase();
  const rows = (query.data ?? []).filter(
    (m) =>
      !needle ||
      m.title.toLowerCase().includes(needle) ||
      m.body.toLowerCase().includes(needle) ||
      (m.topic ?? "").toLowerCase().includes(needle),
  );

  return (
    <StaffShell title="Communication memory">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Only approved and released wording is filed here. An assistant conversation never becomes memory on its own. A
        withdrawn or corrected source flags the items that relied on it.
      </p>

      <label className="mt-5 flex max-w-md items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
        <Search aria-hidden className="size-4 text-muted-foreground" />
        <span className="sr-only">Search the memory</span>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by topic or wording"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>

      {query.isPending && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Loading the memory…
        </p>
      )}

      {query.isError && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          The memory could not be loaded. Your account may not have permission to see it.
        </div>
      )}

      {query.isSuccess && rows.length === 0 && (
        <div className="surface-panel mt-6 grid place-items-center p-12 text-center">
          <FileClock aria-hidden className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">
            {query.data.length === 0 ? "Nothing filed yet" : "Nothing matches that search"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Released responses are filed here automatically, together with the evidence they rested on.
          </p>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {rows.map((m) => (
          <li key={m.id} className="surface-panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{m.title}</span>
              <span className="rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{m.item_type}</span>
              <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${REUSE_TONE[m.reuse_status] ?? ""}`}>
                {m.reuse_status.replace(/_/g, " ")}
              </span>
              <span className="rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{m.audience}</span>
              {m.is_demo_seed && (
                <span className="rounded bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn-foreground">
                  Demonstration
                </span>
              )}
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{m.body}</p>

            <p className="mt-2 text-xs text-muted-foreground">
              {m.topic ? `${m.topic} · ` : ""}communicated {m.communicated_on}
              {m.reference_period ? ` · ${m.reference_period}` : ""} · origin {m.origin} · basis {m.approval_basis}
            </p>

            {m.review_flag_reason && (
              <p className="mt-2 rounded border border-warn/40 bg-warn-surface p-2 text-xs text-warn-foreground">
                Needs another look: {m.review_flag_reason}
              </p>
            )}
          </li>
        ))}
      </ul>
    </StaffShell>
  );
}
