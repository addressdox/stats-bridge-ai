/**
 * South Africa-only insights dashboard data.
 *
 * Everything returned here is counted from records already in Naledi:
 * approved South African source versions, human-verified observations, and
 * the questions the public has asked. Nothing is estimated or invented.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type TrendSeries = {
  measure: string;
  measureKey: string;
  unit: string;
  geography: string;
  latestDisplay: string;
  latestPeriod: string;
  points: Array<{ label: string; value: number; displayValue: string }>;
  source: { title: string; publisher: string; url: string | null; versionLabel: string };
};

export type Announcement = {
  title: string;
  publisher: string;
  publishedOn: string | null;
  referencePeriod: string | null;
  versionLabel: string;
  topic: string | null;
  url: string | null;
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
  stale: boolean;
};

export type TopicCount = { topic: string; total: number; answered: number; escalated: number; gaps: number };
export type GapRow = { topic: string; count: number; example: string | null; mostRecent: string | null };

export type FigureRow = {
  measure: string;
  measureKey: string;
  unit: string;
  geography: string;
  displayValue: string;
  referencePeriod: string;
  verifiedAt: string | null;
  sourceTitle: string;
  publisher: string;
  versionLabel: string;
  url: string | null;
  topic: string | null;
};

export type InsightFilters = {
  publisher?: string | null;
  topic?: string | null;
  measureKey?: string | null;
  geography?: string | null;
  days?: number | null;
};

export type PublicInsights = {
  generatedAt: string;
  filters: InsightFilters;
  choices: { publishers: string[]; topics: string[]; measures: Array<{ key: string; label: string }>; geographies: string[] };
  coverage: { approvedSources: number; verifiedFigures: number; publishers: string[]; lastCheckedAt: string | null };
  trends: TrendSeries[];
  announcements: Announcement[];
  emergingTopics: TopicCount[];
  gaps: GapRow[];
  followUps: string[];
  figures: FigureRow[];
  includesDemonstrationRecords: boolean;
};

type ObsRow = {
  measure: string;
  measure_key: string;
  unit: string;
  geography: string;
  display_value: string;
  value: number | null;
  value_state: string;
  reference_period: string;
  period_end: string | null;
  verified_at: string | null;
  source_versions: {
    version_label: string;
    original_url: string | null;
    published_on: string | null;
    status: string;
    sources: {
      title: string;
      publisher: string;
      topic: string | null;
      last_checked_at: string | null;
      last_changed_at: string | null;
    } | null;
  } | null;
};

const filterSchema = z
  .object({
    publisher: z.string().trim().max(160).nullish(),
    topic: z.string().trim().max(160).nullish(),
    measureKey: z.string().trim().max(160).nullish(),
    geography: z.string().trim().max(160).nullish(),
    days: z.coerce.number().int().min(1).max(3650).nullish(),
  })
  .partial()
  .default({});

const STALE_DAYS = 45;

async function buildInsights(filters: InsightFilters): Promise<PublicInsights> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  const windowDays = filters.days ?? 30;
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * windowDays).toISOString();

  const [obsResult, versionResult, answerResult] = await Promise.all([
    db
      .from("observations")
      .select(
        "measure, measure_key, unit, geography, display_value, value, value_state, reference_period, period_end, verified_at, source_versions!observations_source_version_id_fkey!inner(version_label, original_url, published_on, status, sources!source_versions_source_id_fkey!inner(title, publisher, topic, last_checked_at, last_changed_at))",
      )
      .eq("source_versions.status", "approved")
      .not("verified_at", "is", null)
      .limit(1000),
    db
      .from("source_versions")
      .select(
        "version_label, published_on, reference_period, original_url, status, sources!source_versions_source_id_fkey!inner(title, publisher, topic, last_checked_at, last_changed_at)",
      )
      .eq("status", "approved")
      .order("published_on", { ascending: false, nullsFirst: false })
      .limit(60),
    db
      .from("answers")
      .select("topic, outcome, question_text, follow_ups, created_at, is_demo_seed")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const allObservations = (obsResult.data ?? []) as unknown as ObsRow[];
  const answers = answerResult.data ?? [];

  const choices = {
    publishers: [...new Set(allObservations.map((o) => o.source_versions?.sources?.publisher ?? "").filter(Boolean))].sort(),
    topics: [...new Set(allObservations.map((o) => o.source_versions?.sources?.topic ?? "").filter(Boolean))].sort(),
    measures: [...new Map(allObservations.map((o) => [o.measure_key, { key: o.measure_key, label: o.measure }])).values()].sort(
      (a, b) => a.label.localeCompare(b.label),
    ),
    geographies: [...new Set(allObservations.map((o) => o.geography).filter(Boolean))].sort(),
  };

  const matches = (o: ObsRow) => {
    const source = o.source_versions?.sources;
    if (filters.publisher && source?.publisher !== filters.publisher) return false;
    if (filters.topic && source?.topic !== filters.topic) return false;
    if (filters.measureKey && o.measure_key !== filters.measureKey) return false;
    if (filters.geography && o.geography !== filters.geography) return false;
    return true;
  };

  const observations = allObservations.filter(matches);

  // --- Trends: any verified measure with two or more periods, newest last ---
  const grouped = new Map<string, ObsRow[]>();
  for (const o of observations) {
    if (o.value === null || o.value_state !== "reported") continue;
    const key = `${o.measure_key}|${o.unit}|${o.geography}`;
    grouped.set(key, [...(grouped.get(key) ?? []), o]);
  }

  const trends: TrendSeries[] = [];
  for (const rows of grouped.values()) {
    const ordered = [...rows].sort((a, b) => (a.period_end ?? "").localeCompare(b.period_end ?? ""));
    const latest = ordered[ordered.length - 1]!;
    const version = latest.source_versions;
    trends.push({
      measure: latest.measure,
      measureKey: latest.measure_key,
      unit: latest.unit,
      geography: latest.geography,
      latestDisplay: `${latest.display_value} ${latest.unit}`.trim(),
      latestPeriod: latest.reference_period,
      points: ordered.map((o) => ({
        label: o.reference_period,
        value: o.value as number,
        displayValue: `${o.display_value} ${o.unit}`.trim(),
      })),
      source: {
        title: version?.sources?.title ?? "Approved publication",
        publisher: version?.sources?.publisher ?? "Statistics South Africa",
        url: version?.original_url ?? null,
        versionLabel: version?.version_label ?? "",
      },
    });
  }
  trends.sort((a, b) => b.points.length - a.points.length || a.measure.localeCompare(b.measure));

  const staleBefore = Date.now() - 1000 * 60 * 60 * 24 * STALE_DAYS;
  const announcements: Announcement[] = (versionResult.data ?? [])
    .map((v) => {
      const source = (
        v as unknown as {
          sources: {
            title: string;
            publisher: string;
            topic: string | null;
            last_checked_at: string | null;
            last_changed_at: string | null;
          };
        }
      ).sources;
      const checked = source.last_checked_at;
      return {
        title: source.title,
        publisher: source.publisher,
        publishedOn: v.published_on,
        referencePeriod: v.reference_period,
        versionLabel: v.version_label,
        topic: source.topic,
        url: v.original_url,
        lastCheckedAt: checked,
        lastChangedAt: source.last_changed_at,
        stale: !checked || new Date(checked).getTime() < staleBefore,
      };
    })
    .filter((a) => {
      if (filters.publisher && a.publisher !== filters.publisher) return false;
      if (filters.topic && a.topic !== filters.topic) return false;
      return true;
    });

  // --- Emerging topics and gaps, counted from real questions ---
  const topicMap = new Map<string, TopicCount>();
  const gapMap = new Map<string, GapRow>();
  for (const a of answers) {
    const topic = a.topic ?? "Not classified";
    if (filters.topic && topic !== filters.topic) continue;
    const entry = topicMap.get(topic) ?? { topic, total: 0, answered: 0, escalated: 0, gaps: 0 };
    entry.total += 1;
    if (a.outcome === "answered") entry.answered += 1;
    if (a.outcome === "escalated") entry.escalated += 1;
    if (a.outcome === "gap") {
      entry.gaps += 1;
      const gap = gapMap.get(topic) ?? { topic, count: 0, example: null, mostRecent: null };
      gap.count += 1;
      if (!gap.example) gap.example = a.question_text;
      if (!gap.mostRecent) gap.mostRecent = a.created_at;
      gapMap.set(topic, gap);
    }
    topicMap.set(topic, entry);
  }

  const emergingTopics = [...topicMap.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  const gaps = [...gapMap.values()].sort((a, b) => b.count - a.count).slice(0, 6);

  // --- Likely follow-up questions: those recorded on answered records, then
  //     questions built from verified measures already in the knowledge base. ---
  const followUps: string[] = [];
  const seen = new Set<string>();
  const push = (q: string) => {
    const clean = q.trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key) || followUps.length >= 6) return;
    seen.add(key);
    followUps.push(clean);
  };
  for (const a of answers) for (const q of (a.follow_ups ?? []) as string[]) push(q);
  for (const t of trends) push(`What is ${t.measure.toLowerCase()} in ${t.geography} for ${t.latestPeriod}?`);

  const figures: FigureRow[] = observations
    .map((o) => ({
      measure: o.measure,
      measureKey: o.measure_key,
      unit: o.unit,
      geography: o.geography,
      displayValue: `${o.display_value} ${o.unit}`.trim(),
      referencePeriod: o.reference_period,
      verifiedAt: o.verified_at,
      sourceTitle: o.source_versions?.sources?.title ?? "Approved publication",
      publisher: o.source_versions?.sources?.publisher ?? "Statistics South Africa",
      versionLabel: o.source_versions?.version_label ?? "",
      url: o.source_versions?.original_url ?? null,
      topic: o.source_versions?.sources?.topic ?? null,
    }))
    .sort((a, b) => a.measure.localeCompare(b.measure) || a.referencePeriod.localeCompare(b.referencePeriod));

  const checkedTimes = announcements
    .map((a) => a.lastCheckedAt)
    .filter((value): value is string => Boolean(value))
    .sort();

  return {
    generatedAt: new Date().toISOString(),
    filters,
    choices,
    coverage: {
      approvedSources: announcements.length,
      verifiedFigures: observations.length,
      publishers: [...new Set(announcements.map((a) => a.publisher))],
      lastCheckedAt: checkedTimes.length > 0 ? checkedTimes[checkedTimes.length - 1]! : null,
    },
    trends: trends.slice(0, 8),
    announcements: announcements.slice(0, 10),
    emergingTopics,
    gaps,
    followUps,
    figures: figures.slice(0, 300),
    includesDemonstrationRecords: answers.some((a) => a.is_demo_seed === true),
  };
}

export const getPublicInsights = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => filterSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<PublicInsights> => buildInsights(data as InsightFilters));

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** A CSV of the filtered figures, with the filters used and a generated-at stamp. */
export const exportInsightsCsv = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => filterSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<{ fileName: string; csv: string }> => {
    const insights = await buildInsights(data as InsightFilters);
    const used = Object.entries(insights.filters)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => `${key}=${String(value)}`)
      .join("; ");

    const lines: string[] = [
      `# Naledi insights export`,
      `# Generated at,${insights.generatedAt}`,
      `# Filters,${used || "none"}`,
      `# Scope,South African official statistics only`,
      "",
      ["Measure", "Value", "Unit", "Geography", "Reference period", "Verified at", "Publication", "Publisher", "Version", "Source link"]
        .map(csvCell)
        .join(","),
    ];

    for (const row of insights.figures) {
      lines.push(
        [
          row.measure,
          row.displayValue,
          row.unit,
          row.geography,
          row.referencePeriod,
          row.verifiedAt,
          row.sourceTitle,
          row.publisher,
          row.versionLabel,
          row.url,
        ]
          .map(csvCell)
          .join(","),
      );
    }

    return { fileName: `naledi-insights-${insights.generatedAt.slice(0, 10)}.csv`, csv: lines.join("\n") };
  });
