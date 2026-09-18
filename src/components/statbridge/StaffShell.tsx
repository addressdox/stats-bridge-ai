import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ClipboardList,
  FileClock,
  Gauge,
  Loader2,
  LogOut,
  MessagesSquare,
  ScrollText,
  Shield,
  UserRound,
  Users,
  Settings,
  UserCog,
  IdCard,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

import { StatBridgeMark } from "@/components/statbridge/SiteChrome";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, useStaff } from "@/lib/staff/useStaff";

const GROUPS = [
  { label: "Operations", links: [
    { to: "/staff/overview", label: "Command centre", icon: Gauge, permission: "dashboard.view" },
    { to: "/staff/handoffs", label: "Handover queue", icon: UserRound, permission: "handoffs.manage" },
    { to: "/staff/conversations", label: "Conversations", icon: MessagesSquare, permission: "conversations.view" },
    { to: "/staff/visitors", label: "People", icon: Users, permission: "visitors.view" },
    { to: "/staff/review", label: "Review queue", icon: ClipboardList, permission: "cases.review" },
  ]},
  { label: "Knowledge", links: [
    { to: "/staff/knowledge/sources", label: "Knowledge library", icon: BookOpen, permission: "sources.view" },
    { to: "/staff/knowledge/guidelines", label: "Guidelines", icon: ScrollText, permission: "guidelines.view" },
    { to: "/staff/knowledge/memory", label: "Communication memory", icon: FileClock, permission: "memory.manage" },
  ]},
  { label: "Intelligence & governance", links: [
    { to: "/staff/insights", label: "Decision intelligence", icon: Shield, permission: "insights.view" },
    { to: "/staff/record", label: "Decision record", icon: ScrollText, permission: "audit.view" },
  ]},
  { label: "Administration", links: [
    { to: "/staff/team", label: "Staff and roles", icon: UserCog, permission: "staff.view" },
    { to: "/staff/settings", label: "Desk settings", icon: Settings, permission: "settings.manage" },
    { to: "/staff/account", label: "My account", icon: IdCard, permission: null },
  ]},
] as const;

export function StaffShell({ children, title }: { children: React.ReactNode; title: string }) {
  const { profile, roles, hasPermission, isLoading } = useStaff();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/staff/sign-in", replace: true });
  }

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Checking your sign-in…
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">Staff sign-in needed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is for Stats SA communications staff. Records stay protected on the server whether or not this
            page is shown.
          </p>
          <Link
            to="/staff/sign-in"
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Go to staff sign-in
          </Link>
        </div>
      </div>
    );
  }

  if (!profile.is_active) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">This account is not active</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ask a Super Administrator to reactivate it.</p>
          <button onClick={signOut} className="mt-4 text-sm font-medium text-accent underline underline-offset-2">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-4 py-4">
          <Link to="/" className="text-sidebar-foreground">
            <StatBridgeMark />
          </Link>
        </div>
         <nav aria-label="Staff" className="flex-1 space-y-4 overflow-y-auto p-2">
          {GROUPS.map((group) => {
            const links = group.links.filter((link) => !link.permission || hasPermission(link.permission));
            if (!links.length) return null;
            return <div key={group.label}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">{group.label}</p>
              <div className="space-y-0.5">{links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <link.icon aria-hidden className="size-4" />
              {link.label}
            </Link>
              ))}</div>
            </div>;
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-xs">
          <p className="font-medium text-sidebar-foreground">{profile.full_name}</p>
           <p className="text-sidebar-foreground/70">{roles.map((role) => role.name).join(", ") || ROLE_LABELS[profile.role]}</p>
          {profile.is_demo && (
            <p className="mt-1 inline-block rounded bg-warn/20 px-1.5 py-0.5 text-[10px] font-semibold text-warn">
              Demonstration account
            </p>
          )}
          <button
            onClick={signOut}
            className="mt-3 inline-flex items-center gap-1.5 text-sidebar-foreground/75 hover:text-sidebar-foreground"
          >
            <LogOut aria-hidden className="size-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
         <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
           <div className="flex items-center gap-3"><button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open staff navigation">{menuOpen ? <X className="size-5"/> : <Menu className="size-5"/>}</button><h1 className="text-lg font-semibold tracking-tight">{title}</h1></div>
           <div className="flex items-center gap-3 md:hidden">
            <button onClick={signOut} className="text-xs font-medium text-accent">
              Sign out
            </button>
          </div>
        </header>
         {menuOpen && <nav aria-label="Staff" className="grid grid-cols-2 gap-1 border-b border-border bg-surface p-3 md:hidden">
            {GROUPS.map((group) => group.links.filter((link) => !link.permission || hasPermission(link.permission)).map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {link.label}
            </Link>
           )))}
         </nav>}
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
