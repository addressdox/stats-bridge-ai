import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";

import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { to: "/ask", label: "Ask" },
  { to: "/media", label: "Media desk" },
  { to: "/case", label: "Track a request" },
  { to: "/developers", label: "Developers" },
] as const;

export function StatBridgeMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-lg border border-official/40 bg-official/12 text-official"
      >
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M4 18V11M9.5 18V6M15 18v-8.5M20.5 18v-5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-display text-[17px] font-bold uppercase tracking-tight">
        Na<span className="text-accent">ledi</span>
        <span className="block text-[9px] font-medium normal-case tracking-normal text-muted-foreground">by AddressDox</span>
      </span>
    </span>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="rounded-md" aria-label="Naledi by AddressDox home">
          <StatBridgeMark />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/staff/sign-in"
            className="ml-2 rounded-full border border-hairline px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent/50"
          >
            Staff sign in
          </Link>
          <ThemeToggle className="ml-1" />
        </nav>

        <div className="flex items-center gap-2 md:hidden">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="rounded-lg border border-hairline p-2 md:hidden"
        >
          <Menu aria-hidden className="size-5" />
          <span className="sr-only">Menu</span>
        </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-hairline bg-surface px-4 py-2 md:hidden">
          {[...NAV, { to: "/staff/sign-in", label: "Staff sign in" } as const].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-hairline bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-12 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-md">
            <StatBridgeMark className="text-foreground" />
            <p className="mt-3 leading-relaxed">
              Naledi answers questions using approved Statistics South Africa material. Anything an official has not
              approved goes to a person before it is sent.
            </p>
          </div>
          <div className="grid gap-2">
            <Link to="/ask" className="hover:text-foreground">
              Ask
            </Link>
            <Link to="/insights" className="hover:text-foreground">
              Insights
            </Link>
            <Link to="/media" className="hover:text-foreground">
              Media desk
            </Link>
            <Link to="/developers" className="hover:text-foreground">
              Developers and widget
            </Link>
            <Link to="/staff/sign-in" className="hover:text-foreground">
              Staff sign in
            </Link>
          </div>
        </div>
        <p className="mt-10 border-t border-hairline pt-6 text-xs">
          Demonstration build. Content shown here is loaded for demonstration and is not an official Statistics South
          Africa endorsement.
        </p>
      </div>
    </footer>
  );
}
