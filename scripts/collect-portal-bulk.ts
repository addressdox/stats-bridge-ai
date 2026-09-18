/** Public ISIbalo corpus crawler. No DB writes. Run: bun scripts/collect-portal-bulk.ts ../output/knowledge-base
 * Resume automatically; --retry-failures requeues failed URLs. Limits apply per invocation.
 */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { extractText, getDocumentProxy } from 'unpdf';

const root = resolve(process.argv[2] ?? '../output/knowledge-base');
const host = 'isibaloweb.statssa.gov.za';
const limits = { html: 300, pdf: 500 };
const now = new Date();
const discoverOnly = process.argv.includes('--discover-only');
type Item = { url: string; title: string; parentUrl?: string; kind: 'html' | 'pdf' };
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const clean = (text: string) => text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
await mkdir(`${root}/bulk`, { recursive: true });
let state: any;
try { state = JSON.parse(await readFile(`${root}/bulk-checkpoint.json`, 'utf8')); }
catch (e: any) { if (e.code !== 'ENOENT') throw e; state = { queue: [], seen: [], sources: [], failures: [], excluded: [], duplicates: [] }; }
const seen = new Set<string>(state.seen);
const sources: any[] = state.sources;
const failures: any[] = state.failures;
const excluded: any[] = state.excluded;
const duplicates: any[] = state.duplicates;
const queue: Item[] = state.queue;
const bytesSeen = new Map<string, any>(sources.map(s => [s.sha256, s]));
const textSeen = new Map<string, any>(sources.map(s => [s.textSha256, s]));
const cache = new Map<string, any>();
try { const old = JSON.parse(await readFile(`${root}/portal-index.json`, 'utf8')); for (const s of old.sources) cache.set(s.url, s); } catch (e: any) { if (e.code !== 'ENOENT') throw e; }
function classify(href: string, parentUrl: string, title = ''): Item | null {
  let u: URL;
  try { u = new URL(href, parentUrl); } catch { return null; }
  if (u.hostname !== host || !['http:', 'https:'].includes(u.protocol)) return null;
  u.protocol = 'https:'; u.hash = '';
  const path = decodeURIComponent(u.pathname);
  if (/signin|signup|login|logout|password|admin|questionn?aires?|\/microdata\/|\.(zip|rar|7z|csv|xlsx?|sav|dta|sas7bdat)$/i.test(path)) return null;
  if (u.search) return null;
  const futureYear = path.match(/(?:^|\D)(20\d{2})(?:\D|$)/g)?.some(v => Number(v.replace(/\D/g, '')) > now.getFullYear());
  if (futureYear || /forthcoming|not yet (available|published)|coming soon/i.test(title)) return null;
  if (/\.pdf$/i.test(path)) {
    if (!/metadata|methodolog|framework|policy|policies|technical|concept|definition|classification|report|guide/i.test(path + ' ' + title)) return null;
    return { url: u.href, title: title || path.split('/').pop()!, parentUrl, kind: 'pdf' };
  }
  if (!(path === '/' || /\.(php|html?)$/i.test(path))) return null;
  return { url: u.href, title, parentUrl, kind: 'html' };
}
function enqueue(item: Item | null) { if (item && !seen.has(item.url)) { seen.add(item.url); queue.push(item); } }
if (!seen.size) {
  enqueue({ url: `https://${host}/`, title: 'ISIbalo Data Portal', kind: 'html' });
  // Prior successful downloads are observed source URLs, never guessed paths.
  for (const s of cache.values()) enqueue(classify(s.url, s.parentUrl || `https://${host}/`, s.title));
}
// Optional URLs observed by a browser/web reader, with their real linking page.
try {
  const observed = JSON.parse(await readFile(`${root}/bulk-seeds.json`, 'utf8'));
  for (const entry of observed) {
    if (!entry.parentUrl) throw new Error('Browser seed requires parentUrl provenance');
    enqueue(classify(entry.url, entry.parentUrl, entry.title));
  }
} catch (e: any) { if (e.code !== 'ENOENT') throw e; }
if (process.argv.includes('--rediscover-cached')) {
  for (const s of cache.values()) if (s.kind === 'html') { seen.delete(s.url); enqueue({url:s.url,title:s.title,kind:'html'}); }
}
if (process.argv.includes('--retry-failures')) { for (const f of failures.splice(0)) { seen.delete(f.url); enqueue(f); } }
// Apply tightened exclusions to prior checkpoints too.
for (const list of [queue, failures]) for (let i = list.length - 1; i >= 0; i--) {
  if (!classify(list[i].url, list[i].parentUrl || `https://${host}/`, list[i].title)) { excluded.push({...list[i],reason:'Excluded by public corpus scope'}); list.splice(i,1); }
}
const counts = { html: 0, pdf: 0 };
async function checkpoint() {
  const summary = { discovered: seen.size, sources: sources.length, html: sources.filter(s => s.kind === 'html').length, pdf: sources.filter(s => s.kind === 'pdf').length, failures: failures.length, duplicates: duplicates.length, remaining: queue.length };
  const data = { retrievedAt: new Date().toISOString(), sources, failures, duplicates, excluded, summary, frontier: queue, limits, boundary: host };
  await writeFile(`${root}/bulk-index.json.tmp`, JSON.stringify(data, null, 2));
  await rename(`${root}/bulk-index.json.tmp`, `${root}/bulk-index.json`);
  await writeFile(`${root}/bulk-checkpoint.json.tmp`, JSON.stringify({ ...state, queue, seen: [...seen], sources, failures, excluded, duplicates }, null, 2));
  await rename(`${root}/bulk-checkpoint.json.tmp`, `${root}/bulk-checkpoint.json`);
  console.log(JSON.stringify(summary));
}
async function download(url: string, redirects = 0): Promise<{ bytes: Uint8Array; finalUrl: string; reused: boolean }> {
  const existing = cache.get(url);
  if (existing) {
    const cached = new Uint8Array(await readFile(resolve(root, existing.originalFile)));
    if (cached.length > 100 && (existing.kind !== 'pdf' || new TextDecoder().decode(cached.slice(0, 5)) === '%PDF-')) return { bytes: cached, finalUrl: url, reused: true };
  }
  if (new URL(url).hostname !== host || new URL(url).protocol !== 'https:') throw new Error('Redirect outside allowed host');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await sleep(300);
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'StatBridge-Knowledge/1.0 (public statistical source curation)' } });
      if ([301,302,303,307,308].includes(response.status)) {
        if (redirects >= 4) throw new Error('Too many redirects');
        return download(new URL(response.headers.get('location')!, url).href, redirects + 1);
      }
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < 2) { await sleep(Math.min(30000, Number(response.headers.get('retry-after') || 0) * 1000 || 1500 * 2 ** attempt)); continue; }
        throw new Error(`HTTP ${response.status}`);
      }
      const chunks: Uint8Array[] = []; let length = 0;
      for await (const chunk of response.body!) { length += chunk.length; if (length > 25_000_000) throw new Error('Exceeds 25 MB document limit'); chunks.push(chunk); }
      return { bytes: new Uint8Array(Buffer.concat(chunks)), finalUrl: url, reused: false };
    } catch (error) {
      if (attempt === 2 || /HTTP [34]|outside allowed|40 MB/.test(String(error))) throw error;
      await sleep(1500 * 2 ** attempt);
    }
  }
  throw new Error('Retry exhausted');
}
async function processItem(item: Item) {
  try {
    const { bytes, finalUrl, reused } = await download(item.url);
    const sha256 = hash(bytes);
    const key = hash(item.url).slice(0, 16);
    let body: any; let text = ''; let title = item.title;
    if (item.kind === 'html') {
      const html = new TextDecoder().decode(bytes).replace(/<!--[\s\S]*?-->/g, '');
      let documentTitle = ''; let mainTitle = ''; let main = ''; let fallback = '';
      const links: { href: string; text: string }[] = [];
      let active: { href: string; text: string } | null = null;
      await new HTMLRewriter()
        .on('script,style', { element(e) { e.remove(); } })
        .on('title', { text(t) { documentTitle += t.text; } })
        .on('.page-contents h3,main h1', { text(t) { mainTitle += t.text; } })
        .on('.page-contents, main', { text(t) { main += t.text; } })
        .on('body', { text(t) { fallback += t.text; } })
        .on('p,h1,h2,h3,h4,li,tr,summary', { element(e) { e.onEndTag(() => { main += '\n'; fallback += '\n'; }); } })
        .on('option[value]', { element(e) { active = { href: e.getAttribute('value')!, text: '' }; const a = active; links.push(a); e.onEndTag(() => { if (active === a) active = null; }); }, text(t) { if (active) active.text += t.text; } })
        .on('a[href]', { element(e) { active = { href: e.getAttribute('href')!, text: '' }; const a = active; links.push(a); e.onEndTag(() => { if (active === a) active = null; }); }, text(t) { if (active) active.text += t.text; } })
        .transform(new Response(html)).text();
      text = clean(main.trim().length > 100 ? main : fallback);
      if (text.length < 100 || /Incapsula incident ID|Request unsuccessful|Access Denied/i.test(text)) throw new Error('No readable public page; possible access protection');
      title = clean(mainTitle || documentTitle || title);
      const observed = links.map(l => ({ url: (() => { try { return new URL(l.href, finalUrl).href; } catch { return l.href; } })(), text: clean(l.text) }));
      for (const l of links) enqueue(classify(l.href, finalUrl, clean(l.text)));
      body = { text, links: observed };
    } else {
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('Response is not a PDF; possible access protection');
      // Copy before pdf.js transfers the buffer so the original stays intact.
      const doc = await getDocumentProxy(bytes.slice());
      const metadata = await doc.getMetadata().catch(() => null);
      const extracted = await extractText(doc, { mergePages: false });
      const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
      await doc.destroy();
      text = pages.map(clean).join('\n\f\n');
      if (text.trim().length < 100) throw new Error('PDF needs OCR; no adequate readable text');
      const embedded = (metadata?.info as any)?.Title;
      if (embedded && !/^(untitled|Microsoft Word|Microsoft PowerPoint)/i.test(embedded)) title = clean(embedded);
      body = { pages, pageCount: extracted.totalPages, pdfMetadata: metadata?.info ?? null, linkedTitle: item.title };
    }
    const textSha256 = hash(text);
    const duplicate = bytesSeen.get(sha256) ?? textSeen.get(textSha256);
    if (duplicate) { if (duplicate.url === item.url) return; duplicates.push({ ...item, sha256, textSha256, duplicateOf: duplicate.key, canonicalUrl: duplicate.url }); return; }
    const originalFile = `bulk/${key}.${item.kind === 'html' ? 'html' : 'pdf'}`;
    const file = `bulk/${key}.json`;
    const record = { ...item, title, key, file, originalFile, sha256, textSha256 };
    // Reserve identity synchronously before writes, including against siblings in this batch.
    bytesSeen.set(sha256, record); textSeen.set(textSha256, record);
    await writeFile(resolve(root, originalFile), bytes);
    await writeFile(resolve(root, file), JSON.stringify({ ...item, title, ...body, finalUrl, retrievedAt: new Date().toISOString(), sourceMethod: reused ? 'Previously downloaded public HTTPS original; re-extracted for bulk crawl' : 'Direct public HTTPS; page-preserving PDF extraction', sha256, textSha256 }, null, 2));
    sources.push(record);
    console.log(`${item.kind.toUpperCase()}: ${title} (${text.length} characters)`);
  } catch (error) { failures.push({ ...item, error: String(error), failedAt: new Date().toISOString() }); console.log(`FAILED ${item.url}: ${String(error)}`); }
}
await checkpoint();
const eligible = (item: Item) => counts[item.kind] < limits[item.kind] && (!discoverOnly || (item.kind === 'html' && cache.has(item.url)));
while (queue.some(eligible)) {
  const batch: Item[] = [];
  for (let i = 0; i < queue.length && batch.length < 4;) {
    const item = queue[i];
    if (!eligible(item)) { i++; continue; }
    queue.splice(i, 1); counts[item.kind]++; batch.push(item);
  }
  // Persist in-flight items before network work, then remove them only after completion.
  queue.unshift(...batch); await checkpoint(); queue.splice(0, batch.length);
  await Promise.all(batch.map(processItem));
  await checkpoint();
}
await checkpoint();
