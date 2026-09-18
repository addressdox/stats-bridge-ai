import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { SiteFooter, SiteHeader } from "@/components/statbridge/SiteChrome";
import { Button } from "@/components/ui/button";

const title = "Track a request — Naledi";
const description =
  "Open the private status page for a request you sent to Statistics South Africa using your case reference and private link.";

export const Route = createFileRoute("/case/")({
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
  component: CaseLookupPage,
});

function CaseLookupPage() {
  const navigate = useNavigate();
  const [reference, setReference] = useState("");
  const [token, setToken] = useState("");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Track a request</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Enter the reference and the private code from the link you were given. Both are needed — the reference on its
          own does not open anything.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reference.trim() || !token.trim()) return;
            navigate({
              to: "/case/$ref",
              params: { ref: reference.trim().toUpperCase() },
              search: { token: token.trim() },
            });
          }}
        >
          <div>
            <label htmlFor="ref" className="text-sm font-medium">
              Case reference
            </label>
            <input
              id="ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="SB-2026-0001"
              className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <label htmlFor="token" className="text-sm font-medium">
              Private code
            </label>
            <input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              This is the part after <code>token=</code> in your private link.
            </p>
          </div>
          <Button type="submit" disabled={!reference.trim() || !token.trim()}>
            Open status page
          </Button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
