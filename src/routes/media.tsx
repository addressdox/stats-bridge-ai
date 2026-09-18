import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";

import { SiteFooter, SiteHeader } from "@/components/statbridge/SiteChrome";
import { Button } from "@/components/ui/button";
import { mediaQueryRequestSchema, type PublicAnswer } from "@/lib/statbridge/contract";
import { submitMediaQuery } from "@/lib/statbridge/public.functions";

const title = "Media desk — Naledi";
const description =
  "Send a media enquiry to Statistics South Africa. You receive a case reference and a private status link; AI-assisted drafts remain private until a communications official reviews, approves and releases the reply.";

export const Route = createFileRoute("/media")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MediaPage,
});

function MediaPage() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PublicAnswer | null>(null);

  const submit = useMutation({
    mutationFn: (values: unknown) => submitMediaQuery({ data: values as never }),
    onSuccess: (answer) => setResult(answer),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const deadlineRaw = String(form.get("deadline") ?? "");
    const parsed = mediaQueryRequestSchema.safeParse({
      name: String(form.get("name") ?? ""),
      outlet: String(form.get("outlet") ?? ""),
      contact: String(form.get("contact") ?? ""),
      deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
      question: String(form.get("question") ?? ""),
      consent: form.get("consent") === "on",
      channel: "web",
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    submit.mutate(parsed.data);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        {result?.caseReference ? (
          <div className="rounded-lg border border-official/25 bg-official-surface p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-official-foreground">
              <CheckCircle2 aria-hidden className="size-4" />
              Your request has been logged
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Naledi prepares a private draft from approved sources for a Stats SA communications official to
              review, edit and approve. Nothing below is an answer to your question yet; the reply appears only after
              an authorised official releases it.
            </p>
            <p className="mt-5 font-mono text-2xl font-semibold">{result.caseReference}</p>
            {result.statusToken && (
              <Link
                to="/case/$ref"
                params={{ ref: result.caseReference }}
                search={{ token: result.statusToken }}
                className="mt-3 inline-block text-sm font-medium text-accent underline underline-offset-2"
              >
                Open your private status page
              </Link>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Save this link now. It is the only way back to this request.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Media desk</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Every media request is handled by a Stats SA communications official. You will receive a case reference
              and a private status link. AI-assisted drafts remain internal until an authorised official reviews,
              approves and releases the response.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <Field id="name" label="Your name" error={errors["name"]}>
                <input id="name" name="name" autoComplete="name" className={inputClass} />
              </Field>
              <Field id="outlet" label="Media outlet" error={errors["outlet"]}>
                <input id="outlet" name="outlet" autoComplete="organization" className={inputClass} />
              </Field>
              <Field id="contact" label="Email address or phone number" error={errors["contact"]}>
                <input id="contact" name="contact" autoComplete="email" className={inputClass} />
              </Field>
              <Field id="deadline" label="Your deadline (optional)" error={errors["deadline"]}>
                <input id="deadline" name="deadline" type="datetime-local" className={inputClass} />
              </Field>
              <Field id="question" label="Your request" error={errors["question"]}>
                <textarea id="question" name="question" rows={6} className={inputClass} />
              </Field>

              <label className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
                <input type="checkbox" name="consent" className="mt-1 size-4" />
                <span className="text-muted-foreground">
                  I agree that Stats SA may store my name, outlet and contact details to answer this request. Contact
                  details are removed automatically 90 days after the request is closed.
                </span>
              </label>
              {errors["consent"] && <p className="text-sm text-destructive">{errors["consent"]}</p>}

              {submit.isError && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  The request could not be sent just now. Please try again.
                </p>
              )}

              <Button type="submit" disabled={submit.isPending}>
                {submit.isPending && <Loader2 aria-hidden className="size-4 animate-spin" />}
                Send to the media desk
              </Button>
            </form>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-ring";

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
