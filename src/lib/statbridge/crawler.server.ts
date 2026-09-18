/**
 * Continuous South African knowledge crawler.
 *
 * Harvests new publications from official South African statistical and
 * government bodies and proposes them into the knowledge base. Everything the
 * crawler finds arrives as status "pending" with ingest_state "waiting" —
 * nothing it fetches is searchable or quotable until a knowledge
 * administrator approves that exact version through the existing
 * pending -> approved lifecycle.
 *
 * Server-side only. Never imported by client code.
 */

type CrawlTarget = {
  /** Human label for logs and the staff summary. */
  label: string;
  /** The listing page that announces new publications. */
  listingUrl: string;
  /** Host used as the publisher name. */
  publisher: string;
};

type DiscoveredItem = {
  title: string;
  url: string;
  publisher: string;
  sourceType: "statistical_release" | "media_release" | "organisational_page" | "other";
  topic: string | null;
};

export type CrawlResult = {
  ranAt: string;
  targets: Array<{ label: string; listingUrl: string; found: number; error: string | null }>;
  inserted: Array<{ title: string; url: string; publisher: string }>;
  skippedExisting: number;
  errors: string[];
};

/** Official South African listing pages the crawler watches. South Africa only. */
const CRAWL_TARGETS: CrawlTarget[] = [
  {
    label: "Stats SA — statistical publications archive",
    listingUrl: "https://www.statssa.gov.za/?page_id=1859",
    publisher: "Statistics South Africa",
  },
  {
    label: "Stats SA — home page announcements",
    listingUrl: "https://www.statssa.gov.za/",
    publisher: "Statistics South Africa",
  },
  {
    label: "SA Reserve Bank — media releases",
    listingUrl: "https://www.resbank.co.za/en/home/publications/media-releases",
    publisher: "South African Reserve Bank",
  },
  {
    label: "National Treasury — media releases",
    listingUrl: "https://www.treasury.gov.za/comm_media/default.aspx",
    publisher: "National Treasury",
  },
];

/** At most this many new sources are proposed per run, keeping review load sane. */
const MAX_NEW_PER_RUN = 20;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 2_000_000;

const TOPIC_KEYWORDS: Array<[RegExp, string]> = [
  [/population|census|demograph|mid-year/i, "population"],
  [/labour|employment|unemployment|qlfs|jobs/i, "labour market"],
  [/consumer price|inflation|\bcpi\b/i, "prices"],
  [/gdp|gross domestic|economic growth/i, "economy"],
  [/povert|income|living conditions/i, "living conditions"],
  [/household|general household/i, "households"],
  [/crime|victims of crime/i, "crime"],
  [/education|school|literacy/i, "education"],
  [/health|mortality|causes of death|vital/i, "health"],
  [/migrat/i, "migration"],
  [/agricultur|farm/i, "agriculture"],
  [/budget|fiscal|debt/i, "public finances"],
  [/interest rate|repo rate|monetary polic/i, "monetary policy"],
  [/trade|export|import/i, "trade"],
  [/transport|road/i, "transport"],
];

function classifyTopic(title: string): string | null {
  for (const [pattern, topic] of TOPIC_KEYWORDS) {
    if (pattern.test(title)) return topic;
  }
  return null;
}

function classifyType(url: string, title: string): DiscoveredItem["sourceType"] {
  if (/\/(P0\d{3})(\/|\.|$)/i.test(url) || /\bP0\d{3}\b/.test(title)) return "statistical_release";
  if (/media|statement|release/i.test(url) || /statement|media release/i.test(title)) return "media_release";
  if (/\/(about|organisation|contact)/i.test(url)) return "organisational_page";
  return "other";
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/** Extract candidate publication links from a listing page without a DOM parser. */
function extractLinks(html: string, base: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  const anchor = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) !== null) {
    const rawHref = match[1] ?? "";
    const text = decodeEntities((match[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text.length < 12 || text.length > 300) continue;
    if (/^(javascript:|mailto:|#)/i.test(rawHref)) continue;
    try {
      const href = new URL(rawHref, base).toString();
      if (!href.startsWith("http")) continue;
      out.push({ href, text });
    } catch {
      // malformed URL — skip
    }
  }
  return out;
}

const INTERESTING = [
  { host: /statssa\.gov\.za$/i, keep: /\/(publications\/|\?p=\d)/i },
  { host: /resbank\.co\.za$/i, keep: /media-release|statement|publication/i },
  { host: /treasury\.gov\.za$/i, keep: /media|press|budget/i },
];

async function fetchListing(target: CrawlTarget): Promise<{ items: DiscoveredItem[]; error: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(target.listingUrl, {
      signal: controller.signal,
      headers: { "user-agent": "Naledi-Crawler/1.0 (knowledge-base; official-source discovery)" },
      redirect: "follow",
    });
    if (!res.ok) return { items: [], error: `HTTP ${res.status}` };
    const html = (await res.text()).slice(0, MAX_BODY_BYTES);
    const baseHost = new URL(target.listingUrl).hostname;
    const rules = INTERESTING.filter((r) => r.host.test(baseHost));
    const seen = new Set<string>();
    const items: DiscoveredItem[] = [];
    for (const link of extractLinks(html, target.listingUrl)) {
      const host = new URL(link.href).hostname;
      const rule = rules.find((r) => r.host.test(host));
      if (!rule || !rule.keep.test(link.href)) continue;
      if (seen.has(link.href)) continue;
      seen.add(link.href);
      items.push({
        title: link.text,
        url: link.href,
        publisher: target.publisher,
        sourceType: classifyType(link.href, link.text),
        topic: classifyTopic(link.text),
      });
    }
    return { items, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { items: [], error: message.includes("abort") ? "Timed out" : message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run one crawl pass: fetch every listing, propose genuinely new publications
 * as pending sources, and record an audit event for each proposal.
 */
export async function runCrawl(): Promise<CrawlResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const result: CrawlResult = { ranAt: new Date().toISOString(), targets: [], inserted: [], skippedExisting: 0, errors: [] };

  // What is already known, by the URL the crawler would see.
  const [byCanonical, byOriginal] = await Promise.all([
    supabaseAdmin.from("sources").select("canonical_url").not("canonical_url", "is", null).limit(5000),
    supabaseAdmin.from("source_versions").select("original_url").not("original_url", "is", null).limit(5000),
  ]);
  const known = new Set<string>();
  for (const row of byCanonical.data ?? []) if (row.canonical_url) known.add(row.canonical_url);
  for (const row of byOriginal.data ?? []) if (row.original_url) known.add(row.original_url);

  for (const target of CRAWL_TARGETS) {
    const listing = await fetchListing(target);
    result.targets.push({
      label: target.label,
      listingUrl: target.listingUrl,
      found: listing.items.length,
      error: listing.error,
    });
    if (listing.error) result.errors.push(`${target.label}: ${listing.error}`);

    for (const item of listing.items) {
      if (result.inserted.length >= MAX_NEW_PER_RUN) break;
      if (known.has(item.url)) {
        result.skippedExisting += 1;
        continue;
      }
      known.add(item.url);

      const { data: source, error: sourceError } = await supabaseAdmin
        .from("sources")
        .insert({
          title: item.title.slice(0, 300),
          source_type: item.sourceType,
          publisher: item.publisher,
          topic: item.topic,
          canonical_url: item.url,
          last_checked_at: result.ranAt,
          last_changed_at: result.ranAt,
        })
        .select("id")
        .single();
      if (sourceError || !source) {
        result.errors.push(`Insert failed for ${item.url}: ${sourceError?.message ?? "unknown"}`);
        continue;
      }

      const { data: version, error: versionError } = await supabaseAdmin
        .from("source_versions")
        .insert({
          source_id: source.id,
          version_label: `Crawled ${result.ranAt.slice(0, 10)}`,
          original_url: item.url,
          ingest_state: "waiting",
          ingest_note: "Discovered by the crawler. A person must fetch the document, check its figures and approve it before it can be quoted.",
          status: "pending",
        })
        .select("id")
        .single();
      if (versionError || !version) {
        result.errors.push(`Version insert failed for ${item.url}: ${versionError?.message ?? "unknown"}`);
        continue;
      }

      await supabaseAdmin.from("audit_events").insert({
        actor_role: "system",
        action: "source_proposed_by_crawler",
        entity_kind: "source_version",
        entity_id: version.id,
        detail: { listing: target.listingUrl, url: item.url, title: item.title },
        origin: "system",
      });

      result.inserted.push({ title: item.title, url: item.url, publisher: item.publisher });
    }

    // Everything this listing covers has now been looked at.
    const seen = listing.items.map((item) => item.url).filter(Boolean);
    if (seen.length > 0) {
      await supabaseAdmin.from("sources").update({ last_checked_at: result.ranAt }).in("canonical_url", seen);
    }
  }

  return result;
}
