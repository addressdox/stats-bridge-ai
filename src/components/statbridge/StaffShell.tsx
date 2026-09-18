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
} from "lucide-react";

import { StatBridgeMark } from "@/components/statbridge/SiteChrome";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, useStaff } from "@/lib/staff/useStaff";

const LINKS = [
  { to: "/staff/overview", label: "Overview", icon: Gauge },
  { to: "/staff/handoffs", label: "Handover queue", icon: UserRound },
  { to: "/staff/conversations", label: "Conversations", icon: MessagesSquare },
  { to: "/staff/visitors", label: "People", icon: Users },
  { to: "/staff/review", label: "Review queue", icon: ClipboardList },
  { to: "/staff/knowledge/sources", label: "Sources", icon: BookOpen },
  { to: "/staff/knowledge/guidelines", label: "Guidelines", icon: ScrollText },
  { to: "/staff/knowledge/memory", label: "Communication memory", icon: FileClock },
  { to: "/staff/insights", label: "Insights", icon: Shield },
  { to: "/staff/record", label: "Decision record", icon: ScrollText },
  { to: "/staff/team", label: "Staff and roles", icon: UserCog },
  { to: "/staff/settings", label: "Desk settings", icon: Settings },
  { to: "/staff/account", label: "My account", icon: IdCard },
] as const;

export function StaffShell({ children, title }: { children: React.ReactNode; title: string }) {
  const { profile, isLoading } = useStaff();
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
          <p className="mt-2 text-sm text-muted-foreground">Ask a communications manager to reactivate it.</p>
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
        <nav aria-label="Staff" className="flex-1 space-y-0.5 p-2">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <link.icon aria-hidden className="size-4" />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-xs">
          <p className="font-medium text-sidebar-foreground">{profile.full_name}</p>
          <p className="text-sidebar-foreground/70">{ROLE_LABELS[profile.role]}</p>
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
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <div className="flex items-center gap-3 md:hidden">
            <span className="text-xs text-muted-foreground">{ROLE_LABELS[profile.role]}</span>
            <button onClick={signOut} className="text-xs font-medium text-accent">
              Sign out
            </button>
          </div>
        </header>
        <nav aria-label="Staff" className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-1.5 md:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
