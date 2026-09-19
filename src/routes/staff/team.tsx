import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, UserPlus } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Empty, Loading, Panel, Pill, relativeTime } from "@/components/statbridge/desk-ui";
import { StaffShell } from "@/components/statbridge/StaffShell";
import {
  CollectionPagination,
  CollectionToolbar,
  collectionSelectClass,
} from "@/components/statbridge/collection-controls";
import type { AccessRole, StaffMember } from "@/lib/statbridge/admin.functions";
import { Button } from "@/components/ui/button";
import {
  createRole,
  getStaffAdministration,
  inviteStaff,
  setStaffActive,
  setStaffRoles,
} from "@/lib/statbridge/admin.functions";
import { useStaff } from "@/lib/staff/useStaff";

export const Route = createFileRoute("/staff/team")({
  head: () => ({
    meta: [{ title: "Staff and roles — Naledi" }, { name: "robots", content: "noindex" }],
  }),
  component: TeamPage,
});
const field = "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm";
function TeamPage() {
  const { profile, hasPermission } = useStaff(),
    qc = useQueryClient();
  const fetch = useServerFn(getStaffAdministration),
    invite = useServerFn(inviteStaff),
    assign = useServerFn(setStaffRoles),
    toggle = useServerFn(setStaffActive),
    addRole = useServerFn(createRole);
  const query = useQuery({ queryKey: ["staff-admin"], queryFn: () => fetch() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["staff-admin"] });
  const [inv, setInv] = useState({ fullName: "", email: "", roleIds: [] as string[] });
  const [role, setRole] = useState({ name: "", description: "", permissionKeys: [] as string[] });
  const invitation = useMutation({
    mutationFn: () => invite({ data: inv }),
    onSuccess: () => {
      toast.success("Invitation sent securely.");
      setInv({ fullName: "", email: "", roleIds: [] });
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const roles = useMutation({
    mutationFn: (d: { staffId: string; roleIds: string[] }) => assign({ data: d }),
    onSuccess: () => {
      toast.success("Role assignment updated.");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const active = useMutation({
    mutationFn: (d: { staffId: string; isActive: boolean; reason: string }) => toggle({ data: d }),
    onSuccess: () => {
      toast.success("Account status updated and sessions revoked where required.");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const create = useMutation({
    mutationFn: () => addRole({ data: role }),
    onSuccess: () => {
      toast.success("Custom role created.");
      setRole({ name: "", description: "", permissionKeys: [] });
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const data = query.data;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [selected, setSelected] = useState<string | null>(null);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteStatus, setInviteStatus] = useState("all");
  const [invitePage, setInvitePage] = useState(1);
  const [inviteSize, setInviteSize] = useState(10);
  const members = (data?.staff ?? [])
    .filter(
      (m) =>
        `${m.fullName} ${m.email ?? ""} ${m.roles.map((r) => r.name).join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (status === "all" || m.isActive === (status === "active")) &&
        (roleFilter === "all" || m.roles.some((r) => r.id === roleFilter)),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id)
        : (sort === "newest"
            ? b.createdAt.localeCompare(a.createdAt)
            : a.createdAt.localeCompare(b.createdAt)) || a.id.localeCompare(b.id),
    );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(members.length / size)));
  const memberRows = members.slice((currentPage - 1) * size, currentPage * size);
  const invitations = (data?.invitations ?? []).filter(
    (i) =>
      `${i.full_name} ${i.email}`.toLowerCase().includes(inviteSearch.toLowerCase()) &&
      (inviteStatus === "all" || i.status === inviteStatus),
  );
  const currentInvitePage = Math.min(
    invitePage,
    Math.max(1, Math.ceil(invitations.length / inviteSize)),
  );
  const invitationRows = invitations.slice(
    (currentInvitePage - 1) * inviteSize,
    currentInvitePage * inviteSize,
  );
  return (
    <StaffShell title="Staff and roles">
      <div className="space-y-5">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Invite staff without sharing passwords, assign one or more roles, promote or demote
          access, and suspend accounts with an audit reason. The final active Super Administrator is
          protected.
        </p>
        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <p
            role="alert"
            className="rounded border border-destructive/30 p-3 text-sm text-destructive"
          >
            {(query.error as Error).message}
          </p>
        ) : (
          <>
            <Panel
              title="Role catalogue"
              description="System roles are maintained by Naledi. Custom roles can combine precise permissions."
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data?.roles.map((r) => (
                  <article key={r.id} className="rounded border border-border p-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-accent" />
                      <b className="text-sm">{r.name}</b>
                      {r.isSystem && <Pill>System</Pill>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                    <p className="mt-2 text-xs font-medium">{r.permissions.length} permissions</p>
                  </article>
                ))}
              </div>
            </Panel>
            {hasPermission("roles.manage") && (
              <Panel
                title="Create a custom role"
                description="Choose only the capabilities this job needs."
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    create.mutate();
                  }}
                  className="space-y-3"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      required
                      className={field}
                      placeholder="Role name"
                      value={role.name}
                      onChange={(e) => setRole({ ...role, name: e.target.value })}
                    />
                    <input
                      className={field}
                      placeholder="Purpose and boundaries"
                      value={role.description}
                      onChange={(e) => setRole({ ...role, description: e.target.value })}
                    />
                  </div>
                  <PermissionGrid
                    permissions={data?.permissions ?? []}
                    selected={role.permissionKeys}
                    setSelected={(v) => setRole({ ...role, permissionKeys: v })}
                  />
                  <Button disabled={create.isPending || !role.permissionKeys.length}>
                    Create role
                  </Button>
                </form>
              </Panel>
            )}
            {hasPermission("staff.manage") && (
              <Panel
                title="Invite a colleague"
                description="They receive an email link and choose their own password; no password is displayed or shared."
              >
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    invitation.mutate();
                  }}
                >
                  <input
                    required
                    className={field}
                    placeholder="Full name"
                    value={inv.fullName}
                    onChange={(e) => setInv({ ...inv, fullName: e.target.value })}
                  />
                  <input
                    required
                    type="email"
                    className={field}
                    placeholder="Work email"
                    value={inv.email}
                    onChange={(e) => setInv({ ...inv, email: e.target.value })}
                  />
                  <div className="sm:col-span-2">
                    <RoleChecks
                      roles={data?.roles ?? []}
                      selected={inv.roleIds}
                      setSelected={(v) => setInv({ ...inv, roleIds: v })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button disabled={invitation.isPending || !inv.roleIds.length}>
                      <UserPlus />
                      {invitation.isPending ? "Sending…" : "Send invitation"}
                    </Button>
                  </div>
                </form>
              </Panel>
            )}
            <Panel
              title="People with access"
              description="Search all staff accounts. Open a person to manage their roles and account status."
            >
              <div className="space-y-4">
                <CollectionToolbar
                  search={search}
                  onSearch={(v) => {
                    setSearch(v);
                    setPage(1);
                  }}
                  searchLabel="Search staff"
                  placeholder="Search name, email or role…"
                  onReset={() => {
                    setSearch("");
                    setStatus("all");
                    setRoleFilter("all");
                    setSort("newest");
                    setPage(1);
                  }}
                >
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Account status
                    <select
                      className={collectionSelectClass}
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">Any status</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Role
                    <select
                      className={collectionSelectClass}
                      value={roleFilter}
                      onChange={(e) => {
                        setRoleFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">All roles</option>
                      {data?.roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Staff order
                    <select
                      className={collectionSelectClass}
                      value={sort}
                      onChange={(e) => {
                        setSort(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="name">Name A–Z</option>
                    </select>
                  </label>
                </CollectionToolbar>
                {!memberRows.length ? (
                  <Empty>No staff accounts match these filters.</Empty>
                ) : (
                  <div className="overflow-x-auto">
                    <table
                      aria-label="Staff accounts"
                      className="w-full min-w-[700px] text-left text-sm"
                    >
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          {["Person", "Roles", "Status", "Last sign-in", "Actions"].map((h) => (
                            <th key={h} scope="col" className="px-2 py-3 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {memberRows.map((m) => (
                          <Fragment key={m.id}>
                            <tr>
                              <td className="px-2 py-3">
                                <p className="font-medium">
                                  {m.fullName} {m.id === profile?.id && <Pill>You</Pill>}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {m.email ?? "No email"}
                                </p>
                              </td>
                              <td className="max-w-72 px-2 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {m.roles.map((r) => (
                                    <Pill
                                      key={r.id}
                                      tone={r.key === "super_administrator" ? "warn" : "muted"}
                                    >
                                      {r.name}
                                    </Pill>
                                  ))}
                                </div>
                              </td>
                              <td className="px-2 py-3">
                                <Pill tone={m.isActive ? "good" : "bad"}>
                                  {m.isActive ? "Active" : "Suspended"}
                                </Pill>
                              </td>
                              <td className="px-2 py-3 text-xs text-muted-foreground">
                                {relativeTime(m.lastSignInAt)}
                              </td>
                              <td className="px-2 py-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  aria-expanded={selected === m.id}
                                  aria-label={`View access for ${m.fullName}`}
                                  onClick={() => setSelected(selected === m.id ? null : m.id)}
                                >
                                  {selected === m.id ? "Close" : "View access"}
                                </Button>
                              </td>
                            </tr>
                            {selected === m.id && (
                              <tr>
                                <td colSpan={5} className="bg-secondary/30 p-3">
                                  <StaffRow
                                    key={`${m.id}:${m.roles.map((r) => r.id).join(",")}:${m.isActive}`}
                                    member={m}
                                    allRoles={data?.roles ?? []}
                                    own={m.id === profile?.id}
                                    canManageRoles={hasPermission("roles.manage")}
                                    canManageStatus={hasPermission("staff.manage")}
                                    busy={roles.isPending || active.isPending}
                                    onRoles={(ids) => roles.mutate({ staffId: m.id, roleIds: ids })}
                                    onStatus={(isActive, reason) =>
                                      active.mutate({ staffId: m.id, isActive, reason })
                                    }
                                  />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <CollectionPagination
                  label="Staff"
                  page={currentPage}
                  pageSize={size}
                  total={members.length}
                  onPageChange={setPage}
                  onPageSizeChange={(v) => {
                    setSize(v);
                    setPage(1);
                  }}
                  busy={query.isFetching}
                />
              </div>
            </Panel>
            <Panel title="Invitations" description="Track every invitation and its current status.">
              <div className="space-y-4">
                <CollectionToolbar
                  search={inviteSearch}
                  onSearch={(v) => {
                    setInviteSearch(v);
                    setInvitePage(1);
                  }}
                  searchLabel="Search invitations"
                  placeholder="Search colleague or email…"
                  onReset={() => {
                    setInviteSearch("");
                    setInviteStatus("all");
                    setInvitePage(1);
                  }}
                >
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Invitation status
                    <select
                      className={collectionSelectClass}
                      value={inviteStatus}
                      onChange={(e) => {
                        setInviteStatus(e.target.value);
                        setInvitePage(1);
                      }}
                    >
                      <option value="all">All statuses</option>
                      {[...new Set((data?.invitations ?? []).map((i) => i.status))]
                        .sort()
                        .map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </option>
                        ))}
                    </select>
                  </label>
                </CollectionToolbar>
                {!invitationRows.length ? (
                  <Empty>No invitations match these filters.</Empty>
                ) : (
                  <div className="overflow-x-auto">
                    <table
                      aria-label="Staff invitations"
                      className="w-full min-w-[540px] text-left text-sm"
                    >
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          {["Colleague", "Email", "Status", "Invited"].map((h) => (
                            <th key={h} scope="col" className="px-2 py-3 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {invitationRows.map((i) => (
                          <tr key={i.id}>
                            <td className="px-2 py-3 font-medium">{i.full_name}</td>
                            <td className="px-2 py-3">{i.email}</td>
                            <td className="px-2 py-3">
                              <Pill>{i.status}</Pill>
                            </td>
                            <td className="px-2 py-3 text-xs text-muted-foreground">
                              {relativeTime(i.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <CollectionPagination
                  label="Invitations"
                  page={currentInvitePage}
                  pageSize={inviteSize}
                  total={invitations.length}
                  onPageChange={setInvitePage}
                  onPageSizeChange={(v) => {
                    setInviteSize(v);
                    setInvitePage(1);
                  }}
                  busy={query.isFetching}
                />
              </div>
            </Panel>
          </>
        )}
      </div>
    </StaffShell>
  );
}
function PermissionGrid({
  permissions,
  selected,
  setSelected,
}: {
  permissions: any[];
  selected: string[];
  setSelected: (v: string[]) => void;
}) {
  const groups = permissions.reduce<Record<string, any[]>>((all, p) => {
    (all[p.groupName] ??= []).push(p);
    return all;
  }, {});
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {Object.entries(groups).map(([name, items]) => (
        <fieldset key={name} className="rounded border border-border p-3">
          <legend className="px-1 text-xs font-semibold">{name}</legend>
          {items.map((p) => (
            <label key={p.key} className="flex gap-2 py-1 text-xs">
              <input
                type="checkbox"
                checked={selected.includes(p.key)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? [...selected, p.key] : selected.filter((x) => x !== p.key),
                  )
                }
              />
              <span>
                <b>{p.name}</b>
                <span className="block text-muted-foreground">{p.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
function RoleChecks({
  roles,
  selected,
  setSelected,
}: {
  roles: any[];
  selected: string[];
  setSelected: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {roles
        .filter((r) => r.isActive)
        .map((r) => (
          <label
            key={r.id}
            className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(r.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id),
                )
              }
            />
            {r.name}
          </label>
        ))}
    </div>
  );
}
function StaffRow({
  member,
  allRoles,
  own,
  canManageRoles,
  canManageStatus,
  busy,
  onRoles,
  onStatus,
}: {
  member: StaffMember;
  allRoles: AccessRole[];
  own: boolean;
  canManageRoles: boolean;
  canManageStatus: boolean;
  busy: boolean;
  onRoles: (v: string[]) => void;
  onStatus: (a: boolean, r: string) => void;
}) {
  const [ids, setIds] = useState<string[]>(member.roles.map((r) => r.id));
  return (
    <article className="space-y-3 rounded border border-border bg-surface p-4">
      <p className="font-medium">Access for {member.fullName}</p>
      {own ? (
        <p className="text-sm text-muted-foreground">Your own account cannot be changed here.</p>
      ) : (
        <>
          {canManageRoles && (
            <>
              <RoleChecks roles={allRoles} selected={ids} setSelected={setIds} />
              <Button size="sm" disabled={busy || !ids.length} onClick={() => onRoles(ids)}>
                Save roles
              </Button>
            </>
          )}
          {canManageStatus && (
            <Button
              className="ml-2"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                const reason = prompt(
                  member.isActive ? "Reason for suspension" : "Reason for restoration",
                );
                if (reason) onStatus(!member.isActive, reason);
              }}
            >
              {member.isActive ? "Suspend" : "Restore"}
            </Button>
          )}
          {!canManageRoles && !canManageStatus && (
            <p className="text-sm text-muted-foreground">
              You have view-only access to this account.
            </p>
          )}
        </>
      )}
    </article>
  );
}
