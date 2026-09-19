import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Empty, Loading, Panel, Pill, relativeTime } from "@/components/statbridge/desk-ui";
import {
  CollectionPagination,
  CollectionToolbar,
  collectionSelectClass,
} from "@/components/statbridge/collection-controls";
import { StaffShell } from "@/components/statbridge/StaffShell";
import { listVisitorPage } from "@/lib/statbridge/desk.functions";

const title = "People — Naledi staff";
const description =
  "Contact records for everyone who has chatted with or called the Stats SA assistant.";

export const Route = createFileRoute("/staff/visitors")({
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
  component: VisitorsPage,
});

function VisitorsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10);
  const [consent, setConsent] = useState<"all" | "given" | "missing">("all");
  const [activity, setActivity] = useState<"all" | "single" | "returning">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const fetchVisitors = useServerFn(listVisitorPage);
  const visitors = useQuery({
    queryKey: ["desk-visitors", search, page, pageSize, consent, activity, sort],
    queryFn: () => fetchVisitors({ data: { search, page, pageSize, consent, activity, sort } }),
  });

  useEffect(() => {
    if (visitors.data && visitors.data.page !== page) setPage(visitors.data.page);
  }, [visitors.data, page]);

  return (
    <StaffShell title="People">
      <div className="space-y-4">
        <CollectionToolbar
          search={search}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchLabel="Search people"
          placeholder="Search name, email, phone or organisation…"
          onReset={() => {
            setSearch("");
            setConsent("all");
            setActivity("all");
            setSort("newest");
            setPage(1);
          }}
        >
          <label className="grid gap-1 text-xs text-muted-foreground">
            Agreement
            <select
              aria-label="Contact agreement"
              value={consent}
              onChange={(event) => {
                setConsent(event.target.value as typeof consent);
                setPage(1);
              }}
              className={collectionSelectClass}
            >
              <option value="all">Any agreement status</option>
              <option value="given">Agreement given</option>
              <option value="missing">Agreement not recorded</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Activity
            <select
              aria-label="Visitor activity"
              value={activity}
              onChange={(event) => {
                setActivity(event.target.value as typeof activity);
                setPage(1);
              }}
              className={collectionSelectClass}
            >
              <option value="all">Any activity</option>
              <option value="returning">Returning visitors</option>
              <option value="single">One or no conversations</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Last seen
            <select
              aria-label="Visitor order"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as typeof sort);
                setPage(1);
              }}
              className={collectionSelectClass}
            >
              <option value="newest">Most recent first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </CollectionToolbar>

        <Panel
          title="Contact records"
          description="Kept only with the person's agreement, and removed on request."
        >
          {visitors.isLoading ? (
            <Loading />
          ) : visitors.isError ? (
            <p role="alert" className="py-4 text-sm text-destructive">
              {visitors.error.message}
            </p>
          ) : (visitors.data?.rows ?? []).length === 0 ? (
            <Empty>No contact records match these filters.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full min-w-[720px] text-left text-sm"
                aria-label="Visitor contact records"
              >
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Name
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Email
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Phone
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Organisation
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Conversations
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Last seen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(visitors.data?.rows ?? []).map((person) => (
                    <tr key={person.id}>
                      <td className="py-2 pr-3">
                        {person.fullName ?? "Not given"}
                        {!person.consentGiven && (
                          <span className="ml-1.5">
                            <Pill tone="warn">no agreement</Pill>
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{person.email ?? "—"}</td>
                      <td className="py-2 pr-3">{person.phone ?? "—"}</td>
                      <td className="py-2 pr-3">{person.organisation ?? "—"}</td>
                      <td className="py-2 pr-3 font-mono tabular-nums">
                        {person.conversationCount}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {relativeTime(person.lastSeenAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <CollectionPagination
            label="People"
            page={visitors.data?.page ?? page}
            pageSize={pageSize}
            total={visitors.data?.total ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value as 10 | 25 | 50);
              setPage(1);
            }}
            busy={visitors.isFetching}
          />
        </Panel>
      </div>
    </StaffShell>
  );
}
