import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Loader2, ShieldAlert } from "lucide-react";
import { z } from "zod";

import { SiteFooter, SiteHeader } from "@/components/statbridge/SiteChrome";
import { readCaseStatus } from "@/lib/statbridge/public.functions";

const title = "Request status — StatBridge";
const description = "The private status page for a request sent to Statistics South Africa through StatBridge.";

export const Route = createFileRoute("/case/$ref")({
  validateSearch: z.object({ token: z.string().optional() }),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaseStatusPage,
});

const STEPS = ["received", "in_review", "approved", "released"] as const;

function CaseStatusPage() {
  const { ref } = Route.useParams();
  const { token } = Route.useSearch();

  const query = useQuery({
    queryKey: ["case-status", ref, token],
    enabled: Boolean(token),
    retry: false,
    queryFn: () => readCaseStatus({ data: { reference: ref, token: token as string } }),
  });

  const status = query.data;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Private status page</p>
        <h1 className="mt-1 font-mono text-2xl font-semibold tracking-tight">{ref}</h1>

        {!token && <Refusal />}

        {token && query.isPending && (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Checking this request…
          </p>
        )}

        {token && query.isError && (
          <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            This page could not be loaded just now. Please refresh and try again.
          </div>
        )}

        {token && query.isSuccess && !status && <Refusal />}

        {status && (
          <div className="mt-8 space-y-6">
            <div className="surface-panel p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {status.status === "released" ? (
                  <CheckCircle2 aria-hidden className="size-4 text-accent" />
                ) : (
                  <Clock aria-hidden className="size-4 text-warn" />
                )}
                {status.statusLabel}
              </p>

              <ol className="mt-4 grid gap-2 sm:grid-cols-4">
                {STEPS.map((step) => {
                  const order = STEPS.indexOf(step);
                  const currentOrder =
                    status.status === "released"
                      ? 3
                      : status.status === "approved"
                        ? 2
                        : status.status === "received"
                          ? 0
                          : 1;
                  const done = order <= currentOrder && status.status !== "rejected";
                  return (
                    <li key={step} className="flex items-center gap-2 text-xs">
                      <span
                        aria-hidden
                        className={`size-2 rounded-full ${done ? "bg-accent" : "bg-border"}`}
                      />
                      <span className={done ? "font-medium text-foreground" : "text-muted-foreground"}>
                        {step === "received"
                          ? "Received"
                          : step === "in_review"
                            ? "With an official"
                            : step === "approved"
                              ? "Approved"
                              : "Released"}
                      </span>
                    </li>
                  );
                })}
              </ol>

              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Received</dt>
                  <dd>{new Date(status.receivedAt).toLocaleString("en-ZA")}</dd>
                </div>
                {status.deadlineAt && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Your deadline</dt>
                    <dd>{new Date(status.deadlineAt).toLocaleString("en-ZA")}</dd>
                  </div>
                )}
                {status.releasedAt && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Released</dt>
                    <dd>{new Date(status.releasedAt).toLocaleString("en-ZA")}</dd>
                  </div>
                )}
              </dl>
            </div>

            {status.releasedBody ? (
              <div className="rounded-lg border border-official/25 bg-official-surface p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-official-foreground">
                  Released response
                </p>
                <div className="mt-3 whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-foreground">
                  {status.releasedBody}
                </div>
                {status.releasedReferences.length > 0 && (
                  <ol className="mt-4 space-y-1.5 border-t border-official/20 pt-3 text-xs text-muted-foreground">
                    {status.releasedReferences.map((r, i) => (
                      <li key={i}>
                        <span className="font-medium text-foreground">{r.title}</span> — {r.publisher}
                        {r.published_on ? `, ${r.published_on}` : ""} ({r.version_label})
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : status.status === "rejected" ? (
              <div className="rounded-lg border border-border bg-surface p-5 text-sm">
                <p className="font-medium">This request was closed without a reply.</p>
                {status.closedReason && <p className="mt-2 text-muted-foreground">{status.closedReason}</p>}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground">
                A communications official is handling this request. Nothing is shown here until a reply has been
                approved and released. Drafts and internal notes are never shown on this page.
              </div>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Refusal() {
  return (
    <div className="mt-8 rounded-lg border border-border bg-surface p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ShieldAlert aria-hidden className="size-4 text-warn" />
        This request cannot be shown
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        A valid reference and private code are both needed. If you have the private link you were given, open it again
        in full.
      </p>
      <Link to="/case" className="mt-4 inline-block text-sm font-medium text-accent underline underline-offset-2">
        Enter the reference and code
      </Link>
    </div>
  );
}
