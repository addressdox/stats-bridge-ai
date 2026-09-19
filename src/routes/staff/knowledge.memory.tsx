import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileClock, ExternalLink } from "lucide-react";
import { useEffect } from "react";

import {
  CollectionPagination,
  CollectionToolbar,
  collectionSelectClass,
} from "@/components/statbridge/collection-controls";
import { Empty, Loading, Pill } from "@/components/statbridge/desk-ui";
import { StaffShell } from "@/components/statbridge/StaffShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  loadMemoryPage,
  memorySearchSchema,
  type MemorySearch,
} from "@/lib/staff/knowledge-collections";

const title = "Communication memory — Naledi knowledge base";
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
  validateSearch: (search) => memorySearchSchema.parse(search),
  component: MemoryPage,
});
const labels = {
  reusable: "Reusable",
  needs_review: "Needs review",
  historical_only: "Historical only",
  withdrawn: "Withdrawn",
};
function MemoryPage() {
  const filters = Route.useSearch(),
    navigate = Route.useNavigate();
  const update = (values: Partial<MemorySearch>) =>
    void navigate({ search: (previous) => ({ ...previous, ...values }), replace: true });
  const query = useQuery({
    queryKey: ["memory-items", filters],
    queryFn: ({ signal }) => loadMemoryPage(supabase, filters, signal),
  });
  useEffect(() => {
    if (query.data && query.data.page !== filters.page)
      void navigate({
        search: (previous) => ({ ...previous, page: query.data.page }),
        replace: true,
      });
  }, [query.data, filters.page, navigate]);

  return (
    <StaffShell title="Communication memory">
      <div className="space-y-5">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Approved and released wording is filed here with its publication context. Check the reuse
          status before using a response; a changed or withdrawn source flags the items that relied
          on it.
        </p>
        <CollectionToolbar
          search={filters.q}
          onSearch={(q) => update({ q, page: 1 })}
          searchLabel="Search communication memory"
          placeholder="Search title, topic or wording"
          onReset={() => void navigate({ search: memorySearchSchema.parse({}), replace: true })}
        >
          <label className="flex flex-col gap-1 text-xs font-medium">
            Reuse status
            <select
              className={collectionSelectClass}
              value={filters.status}
              onChange={(e) =>
                update({
                  status: memorySearchSchema.parse({ status: e.target.value }).status,
                  page: 1,
                })
              }
            >
              <option value="all">All statuses</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Item type
            <select
              className={collectionSelectClass}
              value={filters.kind}
              onChange={(e) =>
                update({ kind: memorySearchSchema.parse({ kind: e.target.value }).kind, page: 1 })
              }
            >
              <option value="all">All types</option>
              {[
                "media_response",
                "press_release",
                "official_statement",
                "faq",
                "other_messaging",
              ].map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Audience
            <select
              className={collectionSelectClass}
              value={filters.audience}
              onChange={(e) =>
                update({
                  audience: memorySearchSchema.parse({ audience: e.target.value }).audience,
                  page: 1,
                })
              }
            >
              <option value="all">All audiences</option>
              <option value="public">Public</option>
              <option value="staff">Staff only</option>
            </select>
          </label>
        </CollectionToolbar>
        {query.isPending ? (
          <Loading label="Loading communication memory…" />
        ) : query.isError ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            The memory could not be loaded. {query.error.message}
          </p>
        ) : query.data.rows.length === 0 ? (
          <div className="surface-panel p-8 text-center">
            <FileClock aria-hidden className="mx-auto size-8 text-muted-foreground" />
            <Empty>No matching communication records.</Empty>
            <p className="text-xs text-muted-foreground">
              Adjust the search or filters. Released responses are filed here automatically.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {query.data.rows.map((m) => (
              <MemoryCard key={m.id} item={m} />
            ))}
          </ul>
        )}
        {!query.isError && (
          <CollectionPagination
            page={query.data?.page ?? filters.page}
            pageSize={filters.size}
            total={query.data?.total ?? 0}
            onPageChange={(page) => update({ page })}
            onPageSizeChange={(size) =>
              update({ size: memorySearchSchema.parse({ size }).size, page: 1 })
            }
            label="communication records"
            busy={query.isFetching}
          />
        )}
      </div>
    </StaffShell>
  );
}

type MemoryItem = Awaited<ReturnType<typeof loadMemoryPage>>["rows"][number];
function MemoryCard({ item: m }: { item: MemoryItem }) {
  const tone =
    m.reuse_status === "reusable"
      ? "good"
      : m.reuse_status === "needs_review"
        ? "warn"
        : m.reuse_status === "withdrawn"
          ? "bad"
          : "muted";
  const original = m.original_url && /^https?:\/\//i.test(m.original_url) ? m.original_url : null;
  return (
    <li className="flex min-w-0 flex-col rounded-lg border border-border bg-surface p-4">
      <Dialog>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FileClock aria-hidden className="size-5 text-accent" />
          <Pill tone={tone}>{labels[m.reuse_status]}</Pill>
        </div>
        <h2 className="mt-3 line-clamp-2 text-sm font-semibold leading-relaxed" title={m.title}>
          {m.title}
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Pill>{m.item_type.replaceAll("_", " ")}</Pill>
          <Pill>{m.audience === "staff" ? "Staff only" : "Public"}</Pill>
          {m.is_demo_seed && <Pill tone="warn">Demonstration</Pill>}
        </div>
        <p className="my-4 line-clamp-4 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
        {m.review_flag_reason && (
          <p className="mb-3 line-clamp-2 rounded bg-warn-surface p-2 text-xs text-warn-foreground">
            Needs review: {m.review_flag_reason}
          </p>
        )}
        <div className="mt-auto">
          <p className="mb-3 border-t border-border pt-3 text-xs text-muted-foreground">
            {m.topic ? `${m.topic} · ` : ""}
            {m.communicated_on}
            {m.reference_period ? ` · ${m.reference_period}` : ""}
          </p>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              aria-label={`Read communication: ${m.title}`}
            >
              Read communication
            </Button>
          </DialogTrigger>
        </div>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <div className="mb-2 flex flex-wrap gap-2">
              <Pill tone={tone}>{labels[m.reuse_status]}</Pill>
              <Pill>{m.item_type.replaceAll("_", " ")}</Pill>
              {m.is_demo_seed && <Pill tone="warn">Demonstration</Pill>}
            </div>
            <DialogTitle className="pr-6 leading-snug">{m.title}</DialogTitle>
            <DialogDescription>
              Released wording and its original communication context.
            </DialogDescription>
          </DialogHeader>
          {m.review_flag_reason && (
            <p className="rounded border border-warn/40 bg-warn-surface p-3 text-sm text-warn-foreground">
              Needs another look: {m.review_flag_reason}
            </p>
          )}
          <dl className="grid gap-3 rounded-lg border border-border bg-secondary/20 p-4 text-xs sm:grid-cols-2">
            {[
              ["Communicated", m.communicated_on],
              ["Reference period", m.reference_period ?? "Not recorded"],
              ["Topic", m.topic ?? "Not recorded"],
              ["Audience", m.audience === "staff" ? "Staff only" : "Public"],
              ["Origin", m.origin.replaceAll("_", " ")],
              ["Approval basis", m.approval_basis],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-medium text-muted-foreground">{label}</dt>
                <dd className="mt-1">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</div>
          {original && (
            <a
              href={original}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border-t border-border pt-4 text-sm text-accent underline underline-offset-2"
            >
              <ExternalLink aria-hidden className="size-4" />
              Open original communication
            </a>
          )}
        </DialogContent>
      </Dialog>
    </li>
  );
}
