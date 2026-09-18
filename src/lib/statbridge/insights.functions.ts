/**
 * South Africa-only insights dashboard data.
 *
 * Everything returned here is counted from records already in StatBridge:
 * approved South African source versions, human-verified observations, and
 * the questions the public has asked. Nothing is estimated or invented.
 */
import { createServerFn } from "@tanstack/react-start";

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
};

export type TopicCount = { topic: string; total: number; answered: number; escalated: number; gaps: number };
export type GapRow = { topic: string; count: number; example: string | null; mostRecent: string | null };

export type PublicInsights = {
  generatedAt: string;
  coverage: { approvedSources: number; verifiedFigures: number; publishers: string[] };
  trends: TrendSeries[];
  announcements: Announcement[];
  emergingTopics: TopicCount[];
  gaps: GapRow[];
  followUps: string[];
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
    sources: { title: string; publisher: string; topic: string | null } | null;
  } | null;
};

export const getPublicInsights = createServerFn({ method: "GET" }).handler(async (): Promise<PublicInsights> => {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();

  const [obsResult, versionResult, answerResult] = await Promise.all([
    db
      .from("observations")
      .select(
        "measure, measure_key, unit, geography, display_value, value, value_state, reference_period, period_end, verified_at, source_versions!observations_source_version_id_fkey!inner(version_label, original_url, published_on, status, sources!source_versions_source_id_fkey!inner(title, publisher, topic))",
      )
      .eq("source_versions.status", "approved")
      .not("verified_at", "is", null)
      .limit(500),
    db
      .from("source_versions")
      .select("version_label, published_on, reference_period, original_url, status, sources!source_versions_source_id_fkey!inner(title, publisher, topic)")
      .eq("status", "approved")
      .order("published_on", { ascending: false, nullsFirst: false })
      .limit(12),
    db
      .from("answers")
      .select("topic, outcome, question_text, follow_ups, created_at, is_demo_seed")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const observations = (obsResult.data ?? []) as unknown as ObsRow[];
  const answers = answerResult.data ?? [];

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

  const announcements: Announcement[] = (versionResult.data ?? []).map((v) => {
    const source = (v as unknown as { sources: { title: string; publisher: string; topic: string | null } }).sources;
    return {
      title: source.title,
      publisher: source.publisher,
      publishedOn: v.published_on,
      referencePeriod: v.reference_period,
      versionLabel: v.version_label,
      topic: source.topic,
      url: v.original_url,
    };
  });

  // --- Emerging topics and gaps, counted from real questions ---
  const topicMap = new Map<string, TopicCount>();
  const gapMap = new Map<string, GapRow>();
  for (const a of answers) {
    const topic = a.topic ?? "Not classified";
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

  const publishers = [...new Set(announcements.map((a) => a.publisher))];

  return {
    generatedAt: new Date().toISOString(),
    coverage: {
      approvedSources: announcements.length,
      verifiedFigures: observations.length,
      publishers,
    },
    trends: trends.slice(0, 6),
    announcements: announcements.slice(0, 8),
    emergingTopics,
    gaps,
    followUps,
    includesDemonstrationRecords: answers.some((a) => a.is_demo_seed === true),
  };
});
