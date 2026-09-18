/** Staff accounts, roles and access. Administrators only for any change. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Empty, Loading, Panel, Pill, relativeTime } from "@/components/statbridge/desk-ui";
import { StaffShell } from "@/components/statbridge/StaffShell";
import {
  changeStaffRole,
  createStaffAccount,
  listStaff,
  setStaffActive,
  type StaffMember,
} from "@/lib/statbridge/admin.functions";
import { ROLE_LABELS, useStaff, type StaffRole } from "@/lib/staff/useStaff";

const title = "Staff and roles — StatBridge staff";
const description = "Who may sign in to the Stats SA desk, and what each person is allowed to do.";

export const Route = createFileRoute("/staff/team")({
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
  component: TeamPage,
});

const ROLE_POWERS: Record<StaffRole, string> = {
  official: "Answers, drafts and handovers. Cannot approve or release.",
  manager: "Everything an official does, plus approving and releasing answers.",
  administrator: "Full control: knowledge, desk settings, staff accounts and roles.",
};

const inputClass = "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm";

function TeamPage() {
  const { profile } = useStaff();
  const isAdmin = profile?.role === "administrator";
  const queryClient = useQueryClient();

  const fetchStaff = useServerFn(listStaff);
  const roleFn = useServerFn(changeStaffRole);
  const activeFn = useServerFn(setStaffActive);
  const createFn = useServerFn(createStaffAccount);

  const staff = useQuery({ queryKey: ["staff-list"], queryFn: () => fetchStaff() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff-list"] });

  const changeRole = useMutation({
    mutationFn: (input: { staffId: string; role: StaffRole }) => roleFn({ data: input }),
    onSuccess: () => {
      toast.success("Role updated.");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActive = useMutation({
    mutationFn: (input: { staffId: string; isActive: boolean }) => activeFn({ data: input }),
    onSuccess: () => {
      toast.success("Account updated.");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [draft, setDraft] = useState({ email: "", fullName: "", role: "official" as StaffRole, password: "" });
  const create = useMutation({
    mutationFn: () => createFn({ data: draft }),
    onSuccess: () => {
      toast.success("Staff account created.");
      setDraft({ email: "", fullName: "", role: "official", password: "" });
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <StaffShell title="Staff and roles">
      <div className="space-y-4">
        <Panel title="What each role may do">
          <ul className="space-y-2 text-sm">
            {(Object.keys(ROLE_LABELS) as StaffRole[]).map((role) => (
              <li key={role} className="flex flex-wrap items-center gap-2">
                <Pill tone={role === "administrator" ? "warn" : "muted"}>{ROLE_LABELS[role]}</Pill>
                <span className="text-muted-foreground">{ROLE_POWERS[role]}</span>
              </li>
            ))}
          </ul>
        </Panel>

        {isAdmin && (
          <Panel title="Add a colleague" description="Creates the sign-in and the staff record together.">
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                create.mutate();
              }}
            >
              <input
                className={inputClass}
                placeholder="Full name"
                value={draft.fullName}
                onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
                required
              />
              <input
                className={inputClass}
                type="email"
                placeholder="Work email"
                value={draft.email}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                required
              />
              <select
                className={inputClass}
                value={draft.role}
                onChange={(event) => setDraft({ ...draft, role: event.target.value as StaffRole })}
              >
                {(Object.keys(ROLE_LABELS) as StaffRole[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <input
                className={inputClass}
                type="text"
                placeholder="First password (at least 10 characters)"
                minLength={10}
                value={draft.password}
                onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                required
              />
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {create.isPending ? "Creating…" : "Create account"}
                </button>
                <span className="ml-3 text-xs text-muted-foreground">
                  Ask them to change the password on their account page at first sign-in.
                </span>
              </div>
            </form>
          </Panel>
        )}

        <Panel title="People with access">
          {staff.isLoading ? (
            <Loading />
          ) : (staff.data ?? []).length === 0 ? (
            <Empty>No staff accounts yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Last signed in</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(staff.data ?? []).map((member: StaffMember) => (
                    <tr key={member.id} className="border-t border-border align-middle">
                      <td className="py-2 pr-3 font-medium">{member.fullName}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{member.email ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {isAdmin && member.id !== profile?.id ? (
                          <select
                            className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
                            value={member.role}
                            onChange={(event) =>
                              changeRole.mutate({ staffId: member.id, role: event.target.value as StaffRole })
                            }
                          >
                            {(Object.keys(ROLE_LABELS) as StaffRole[]).map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          ROLE_LABELS[member.role]
                        )}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {member.lastSignInAt ? relativeTime(member.lastSignInAt) : "Never"}
                      </td>
                      <td className="py-2 pr-3">
                        {isAdmin && member.id !== profile?.id ? (
                          <button
                            type="button"
                            onClick={() => toggleActive.mutate({ staffId: member.id, isActive: !member.isActive })}
                            className="rounded-md border border-border px-2 py-1 text-xs"
                          >
                            {member.isActive ? "Suspend" : "Restore"}
                          </button>
                        ) : (
                          <Pill tone={member.isActive ? "good" : "warn"}>{member.isActive ? "Active" : "Suspended"}</Pill>
                        )}
                      </td>
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
