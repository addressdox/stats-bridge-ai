import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Empty, Loading, Panel, Pill, relativeTime } from "@/components/statbridge/desk-ui";
import { StaffShell } from "@/components/statbridge/StaffShell";
import { listVisitors } from "@/lib/statbridge/desk.functions";

const title = "People — StatBridge staff";
const description = "Contact records for everyone who has chatted with or called the Stats SA assistant.";

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
  const fetchVisitors = useServerFn(listVisitors);
  const visitors = useQuery({
    queryKey: ["desk-visitors", search],
    queryFn: () => fetchVisitors({ data: { search } }),
  });

  return (
    <StaffShell title="People">
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background px-4 py-2 sm:-mx-6 sm:px-6">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, phone or organisation…"
            className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
          />
        </div>

        <Panel title="Contact records" description="Kept only with the person's agreement, and removed on request.">
          {visitors.isLoading ? (
            <Loading />
          ) : (visitors.data ?? []).length === 0 ? (
            <Empty>Nobody has left contact details yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">Phone</th>
                    <th className="py-2 pr-3 font-medium">Organisation</th>
                    <th className="py-2 pr-3 font-medium">Conversations</th>
                    <th className="py-2 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(visitors.data ?? []).map((person) => (
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
                      <td className="py-2 pr-3 font-mono tabular-nums">{person.conversationCount}</td>
                      <td className="py-2 text-xs text-muted-foreground">{relativeTime(person.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </StaffShell>
  );
}
