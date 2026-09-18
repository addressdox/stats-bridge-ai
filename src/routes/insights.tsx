import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Download, Loader2, Printer, X } from "lucide-react";
import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { z } from "zod";

import { SiteFooter, SiteHeader } from "@/components/statbridge/SiteChrome";
import { exportInsightsCsv, getPublicInsights } from "@/lib/statbridge/insights.functions";

const searchSchema = z.object({
  publisher: z.string().optional(),
  topic: z.string().optional(),
  measureKey: z.string().optional(),
  geography: z.string().optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
});

const title = "Insights — what South Africa is asking and what was just published";
const description =
  "A South Africa-only view of verified Stats SA trends, recent official announcements, emerging question topics, coverage gaps and likely follow-up questions.";

export const Route = createFileRoute("/insights")({
  validateSearch: searchSchema,
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
  component: InsightsPage,
});

function Panel({ heading, note, children }: { heading: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="surface-panel p-5">
      <h2 className="font-display text-base font-semibold">{heading}</h2>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function InsightsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/insights" });
  const load = useServerFn(getPublicInsights);
  const csv = useServerFn(exportInsightsCsv);
  const [drillDown, setDrillDown] = useState<string | null>(null);

  const filters = {
    publisher: search.publisher ?? null,
    topic: search.topic ?? null,
    measureKey: search.measureKey ?? null,
    geography: search.geography ?? null,
    days: search.days ?? 30,
  };

  const insights = useQuery({
    queryKey: ["public-insights", filters],
    queryFn: () => load({ data: filters }),
  });

  const download = useMutation({
    mutationFn: () => csv({ data: filters }),
    onSuccess: ({ fileName, csv: body }) => {
      const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });

  const setFilter = (key: keyof typeof search, value: string | number | undefined) =>
    void navigate({ search: (old) => ({ ...old, [key]: value || undefined }) });

  const data = insights.data;
  const drillRows = data && drillDown ? data.figures.filter((f) => f.measureKey === drillDown) : [];


  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <header className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">South Africa only</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Insights</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Every figure below is counted from approved South African publications and human-verified figures already in
            StatBridge, together with the questions the public has asked in the last 30 days. Nothing here is estimated,
            forecast or explained — the numbers are shown with the publication they came from.
          </p>
        </header>

        {data && (
          <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-hairline bg-surface/60 p-4 print:hidden">
            <Choice
              label="Publisher"
              value={search.publisher ?? ""}
              options={data.choices.publishers}
              onChange={(value) => setFilter("publisher", value)}
            />
            <Choice
              label="Topic"
              value={search.topic ?? ""}
              options={data.choices.topics}
              onChange={(value) => setFilter("topic", value)}
            />
            <Choice
              label="Measure"
              value={search.measureKey ?? ""}
              options={data.choices.measures.map((m) => m.key)}
              labels={Object.fromEntries(data.choices.measures.map((m) => [m.key, m.label]))}
              onChange={(value) => setFilter("measureKey", value)}
            />
            <Choice
              label="Geography"
              value={search.geography ?? ""}
              options={data.choices.geographies}
              onChange={(value) => setFilter("geography", value)}
            />
            <Choice
              label="Question window"
              value={String(search.days ?? 30)}
              options={["7", "30", "90", "365"]}
              labels={{ "7": "7 days", "30": "30 days", "90": "90 days", "365": "12 months" }}
              allowAny={false}
              onChange={(value) => setFilter("days", Number(value))}
            />
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => download.mutate()}
                disabled={download.isPending}
                className="inline-flex items-center gap-1.5 rounded-full border border-input px-3 py-1.5 text-xs font-semibold transition-colors hover:border-accent disabled:opacity-60"
              >
                <Download aria-hidden className="size-3.5" />
                CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-full border border-input px-3 py-1.5 text-xs font-semibold transition-colors hover:border-accent"
              >
                <Printer aria-hidden className="size-3.5" />
                PDF
              </button>
            </div>
            <p className="w-full text-[11px] text-muted-foreground">
              Generated {new Date(data.generatedAt).toLocaleString("en-ZA")}
              {data.coverage.lastCheckedAt
                ? ` · sources last checked ${new Date(data.coverage.lastCheckedAt).toLocaleString("en-ZA")}`
                : " · sources not yet checked by the crawler"}
              . Exports carry these filters, the time above and the full citation for every figure.
            </p>
          </div>
        )}


        {insights.isPending && (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Counting the records…
          </p>
        )}

        {insights.isError && (
          <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            The insights could not be loaded just now. Please try again shortly.
          </div>
        )}

        {data && (
          <div className="mt-8 space-y-6">
            {data.includesDemonstrationRecords && (
              <p className="inline-block rounded bg-warn/15 px-2 py-1 text-xs font-semibold text-warn-foreground">
                These counts include demonstration records.
              </p>
            )}

            <section className="grid gap-3 sm:grid-cols-3">
              <Stat label="Approved publications" value={String(data.coverage.approvedSources)} />
              <Stat label="Verified figures" value={String(data.coverage.verifiedFigures)} />
              <Stat
                label="Official publishers"
                value={String(data.coverage.publishers.length)}
                note={data.coverage.publishers.slice(0, 3).join(", ")}
              />
            </section>

            <Panel
              heading="Current trends"
              note="The latest verified figures. A line is drawn where more than one period has been verified."
            >
              {data.trends.length === 0 ? (
                <Empty>No measure yet has more than one verified period.</Empty>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {data.trends.map((t) => (
                    <article key={`${t.measureKey}-${t.geography}`} className="rounded-lg border border-border p-4">
                      <p className="text-sm font-medium">{t.measure}</p>
                      <p className="mt-1 font-serif text-3xl font-semibold tabular-nums text-official-foreground">
                        {t.latestDisplay}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.geography} · {t.latestPeriod}
                      </p>
                      <button
                        type="button"
                        onClick={() => setDrillDown(t.measureKey)}
                        className="mt-1 text-xs font-semibold text-accent underline underline-offset-2 print:hidden"
                      >
                        See every verified figure
                      </button>
                      {t.points.length >= 2 && (
                        <div className="mt-3 h-28 w-full" role="img" aria-label={`${t.measure} over time`}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={t.points} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
                              <YAxis tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
                              <Tooltip
                                formatter={(_v, _n, item) =>
                                  (item?.payload as { displayValue?: string })?.displayValue ?? ""
                                }
                                contentStyle={{
                                  background: "var(--color-surface)",
                                  border: "1px solid var(--color-border)",
                                  borderRadius: 8,
                                  fontSize: 12,
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="value"
                                stroke="var(--color-chart-1)"
                                strokeWidth={2}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t.source.title} — {t.source.publisher}
                        {t.source.url && (
                          <>
                            {" "}
                            <a
                              href={t.source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-accent underline underline-offset-2"
                            >
                              Open source
                            </a>
                          </>
                        )}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </Panel>

            <Panel heading="Recently published" note="The newest approved South African publications in StatBridge.">
              {data.announcements.length === 0 ? (
                <Empty>No approved publication has been recorded yet.</Empty>
              ) : (
                <ul className="space-y-3">
                  {data.announcements.map((a, i) => (
                    <li key={`${a.title}-${i}`} className="rounded-md border border-border p-3">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[
                          a.publisher,
                          a.referencePeriod,
                          a.publishedOn ? new Date(a.publishedOn).toLocaleDateString("en-ZA", { dateStyle: "medium" }) : null,
                          a.versionLabel,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {a.lastCheckedAt
                          ? `Last checked ${new Date(a.lastCheckedAt).toLocaleDateString("en-ZA", { dateStyle: "medium" })}`
                          : "Not yet checked by the crawler"}
                        {a.lastChangedAt
                          ? ` · last change ${new Date(a.lastChangedAt).toLocaleDateString("en-ZA", { dateStyle: "medium" })}`
                          : ""}
                        {a.stale && <span className="ml-1.5 rounded bg-warn/15 px-1.5 py-0.5 font-semibold text-warn">Needs a fresh check</span>}
                      </p>
                      {a.url && (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent underline underline-offset-2"
                        >
                          Open the publication
                          <ArrowUpRight aria-hidden className="size-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="grid gap-6 md:grid-cols-2">
              <Panel heading="Emerging topics" note="What people asked in the last 30 days.">
                {data.emergingTopics.length === 0 ? (
                  <Empty>No questions have been recorded in this period.</Empty>
                ) : (
                  <ul className="space-y-2">
                    {data.emergingTopics.map((t) => (
                      <li key={t.topic} className="flex items-center justify-between gap-3 text-sm">
                        <span>{t.topic}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {t.total} asked · {t.answered} answered · {t.escalated} to an official
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel heading="Where we could not answer" note="Questions no approved source covers yet.">
                {data.gaps.length === 0 ? (
                  <Empty>No unanswered question has been recorded in this period.</Empty>
                ) : (
                  <ul className="space-y-3">
                    {data.gaps.map((g) => (
                      <li key={g.topic} className="rounded-md border border-border p-3">
                        <p className="text-xs font-semibold">
                          {g.topic} <span className="font-mono font-normal text-muted-foreground">{g.count}</span>
                        </p>
                        {g.example && <p className="mt-1 text-sm text-muted-foreground">“{g.example}”</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <Panel heading="Likely next questions" note="Answerable from figures already approved in StatBridge.">
              {data.followUps.length === 0 ? (
                <Empty>No follow-up questions can be suggested yet.</Empty>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {data.followUps.map((q) => (
                    <li key={q}>
                      <Link
                        to="/ask"
                        className="inline-block rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent"
                      >
                        {q}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="surface-panel p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
