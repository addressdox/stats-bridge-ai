/** Run with Bun (loads .env): bun scripts/import-knowledge-pack.ts [pack.json] [--apply]. */
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { basename, dirname, extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { supabaseAdmin as db } from '../src/integrations/supabase/client.server';
import type { TablesInsert } from '../src/integrations/supabase/types';

const nullableText = z.string().nullable().optional();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const passageSchema = z.object({ position: z.number().int().nonnegative(), page_number: z.number().int().positive().nullable(), section_label: z.string().nullable(), content: z.string().trim().min(40).max(1800) }).strict();
const observationSchema = z.object({
  measure: z.string().min(1), measure_key: z.string().min(1), value: z.number().finite().nullable(),
  value_state: z.enum(['reported', 'missing', 'suppressed', 'not_applicable']), display_value: z.string().min(1), unit: z.string().min(1),
  population: nullableText, geography: z.string().min(1), reference_period: z.string().min(1), period_start: date.nullable().optional(), period_end: date.nullable().optional(),
  adjustment: nullableText, reported_change: nullableText, comparability_note: nullableText, page_number: z.number().int().positive().nullable().optional(), table_label: nullableText,
  evidence_text: z.string().min(1), position: z.number().int().nonnegative(),
}).strict().refine(o => (o.value_state === 'reported') === (o.value !== null), 'Value must match value_state');
export const packSchema = z.object({
  pack_id: z.string().min(1), assembled_at: z.string().datetime(), attribution: z.unknown(),
  sources: z.array(z.object({ key: z.string().min(1), title: z.string().min(3).max(300), topic: z.string().nullable(), source_type: z.enum(['statistical_release', 'media_release', 'methodology', 'organisational_page', 'faq_page', 'other']), audience: z.enum(['public', 'staff']), url: z.string().url(), published_on: date.nullable(), reference_period: z.string().nullable(), page_count: z.number().int().positive().nullable(), original_file: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/), passages: z.array(passageSchema).min(1), observations: z.array(observationSchema) }).strict()).min(1),
}).strict();
export type Pack = z.infer<typeof packSchema>;
export const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export function stableId(key: string) { const h = sha256(`statbridge-knowledge-pack:v1:${key}`); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; }
export function officialUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !(u.hostname === 'gov.za' || u.hostname.endsWith('.gov.za'))) throw new Error('Source URL must be official HTTPS gov.za without credentials or a custom port');
  u.hash = ''; return u.toString();
}
export function validateContent(pack: Pack) {
  const keys = new Set<string>(); const urls = new Set<string>();
  for (const s of pack.sources) {
    s.url = officialUrl(s.url);
    if (keys.has(s.key) || urls.has(s.url)) throw new Error(`Duplicate source key or URL: ${s.key}`);
    keys.add(s.key); urls.add(s.url);
    const positions = new Set<number>();
    for (const p of s.passages) {
      if (positions.has(p.position)) throw new Error(`${s.key}: duplicate passage position`);
      positions.add(p.position);
      if (p.page_number && s.page_count && p.page_number > s.page_count) throw new Error(`${s.key}: page beyond page count`);
      if (/\x00|\ufffd|verify (?:you are|that you are) human|just a moment\.\.\.|enable javascript and cookies|cloudflare ray id|access denied|captcha challenge/i.test(p.content) || (p.content.match(/[a-zA-Z]{2,}/g)?.length ?? 0) < 5) throw new Error(`${s.key}: unreadable or protection-page passage`);
    }
    const facts = new Set<string>();
    for (const o of s.observations) {
      const p = s.passages.find(p => p.position === o.position);
      if (!p || !p.content.includes(o.evidence_text) || (o.page_number != null && o.page_number !== p.page_number)) throw new Error(`${s.key}: observation evidence does not match its passage`);
      const fact = JSON.stringify([o.measure_key,o.geography,o.reference_period,o.population ?? null]);
      if (facts.has(fact)) throw new Error(`${s.key}: duplicate observation fact`);
      facts.add(fact);
    }
  }
  return pack;
}
export async function loadPack(path: string) {
  const root = await realpath(dirname(path));
  const pack = validateContent(packSchema.parse(JSON.parse(await readFile(path, 'utf8'))));
  const originals = new Map<string, Buffer>();
  for (const s of pack.sources) {
    const file = await realpath(resolve(root, s.original_file));
    if (!file.startsWith(root + sep)) throw new Error(`${s.key}: original must be within pack directory`);
    const bytes = await readFile(file);
    if (!bytes.length || bytes.length > 25_000_000 || sha256(bytes) !== s.sha256) throw new Error(`${s.key}: original checksum or size validation failed`);
    originals.set(s.key, bytes);
  }
  return { pack, originals };
}
function check(result: { error: { message: string } | null }) { if (result.error) throw new Error(result.error.message); }
function same(row: Record<string, unknown>, expected: Record<string, unknown>, label: string) {
  for (const [key, value] of Object.entries(expected)) if (JSON.stringify(row[key] ?? null) !== JSON.stringify(value ?? null)) throw new Error(`${label}: existing ${key} differs; refusing to overwrite`);
}
async function rowsFor(table: 'passages' | 'observations', versionId: string) {
  const out: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 500) { const r = await db.from(table).select('*').eq('source_version_id', versionId).order('id').range(offset, offset + 499); check(r); out.push(...r.data!); if (r.data!.length < 500) return out; }
}
async function applySource(pack: Pack, s: Pack['sources'][number], bytes: Buffer) {
  const canonical = await db.from('sources').select('*').eq('canonical_url', s.url); check(canonical);
  if (canonical.data!.length > 1) throw new Error(`${s.key}: ambiguous canonical source; manual review required`);
  const sourceId = canonical.data![0]?.id ?? stableId(`source:${s.url}`);
  if (!canonical.data!.length) {
    check(await db.from('sources').upsert({ id: sourceId, title: s.title, topic: s.topic, source_type: s.source_type, audience: s.audience, canonical_url: s.url, created_by: null }, { onConflict: 'id', ignoreDuplicates: true }));
    const sourceCheck = await db.from('sources').select('*').eq('id', sourceId).single(); check(sourceCheck); same(sourceCheck.data!, { canonical_url: s.url, audience: s.audience }, 'Source');
  }
  const versions = await db.from('source_versions').select('*').eq('source_id', sourceId).eq('file_fingerprint', s.sha256); check(versions);
  if (versions.data!.length > 1) throw new Error(`${s.key}: ambiguous fingerprint versions`);
  const existing = versions.data![0];
  const versionId = existing?.id ?? stableId(`version:${sourceId}:${s.sha256}`);
  if (existing && existing.status !== 'pending') return { key: s.key, sourceId, versionId, status: 'preserved_existing', existingStatus: existing.status };
  const storagePath = existing?.file_path ?? `curated/${s.sha256}/${basename(s.original_file).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const extension = extname(s.original_file).toLowerCase();
  const mime = extension === '.pdf' ? 'application/pdf' : extension === '.html' ? 'text/html' : 'text/plain';
  const upload = await db.storage.from('knowledge-files').upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw new Error('Private original upload failed');
  const downloaded = await db.storage.from('knowledge-files').download(storagePath);
  if (downloaded.error || !downloaded.data || sha256(new Uint8Array(await downloaded.data.arrayBuffer())) !== s.sha256) throw new Error('Stored original checksum verification failed');
  check(await db.from('source_versions').upsert({ id: versionId, source_id: sourceId, version_label: s.published_on ?? `Curated ${pack.assembled_at.slice(0,10)}`, published_on: s.published_on, reference_period: s.reference_period, page_count: s.page_count, file_path: storagePath, original_url: s.url, file_fingerprint: s.sha256, status: 'pending', ingest_state: 'waiting', created_by: null }, { onConflict: 'id', ignoreDuplicates: true }));
  const version = await db.from('source_versions').select('*').eq('id', versionId).single(); check(version);
  same(version.data!, { source_id: sourceId, file_fingerprint: s.sha256, status: 'pending', published_on: s.published_on, reference_period: s.reference_period }, 'Version');
  const jobId = stableId(`job:${versionId}`);
  check(await db.from('knowledge_ingestion_jobs').upsert({ id: jobId, source_version_id: versionId, kind: 'file', state: 'uploaded', file_name: basename(s.original_file), mime_type: mime, file_size: bytes.length, source_url: s.url, storage_path: storagePath, checksum: s.sha256, created_by: null }, { onConflict: 'id', ignoreDuplicates: true }));
  const job = await db.from('knowledge_ingestion_jobs').select('*').eq('id', jobId).single(); check(job);
  same(job.data!, { source_version_id: versionId, checksum: s.sha256, storage_path: storagePath }, 'Ingestion job');
  try {
    const oldPassages = await rowsFor('passages', versionId);
    const passageRows: TablesInsert<'passages'>[] = s.passages.map(p => ({ ...p, id: stableId(`passage:${versionId}:${p.position}`), source_version_id: versionId }));
    const passageIds = new Map<number, string>();
    for (const p of passageRows) {
      const matches = oldPassages.filter(old => old.position === p.position);
      if (matches.length > 1) throw new Error('Duplicate existing passage position');
      if (matches[0]) { const { id: _id, ...fields } = p; same(matches[0], fields, 'Passage'); p.id = matches[0].id as string; }
      passageIds.set(p.position, p.id!);
    }
    if (oldPassages.some(old => !passageRows.some(p => p.id === old.id))) throw new Error('Existing version contains additional passages; refusing mixed extraction');
    for (let i = 0; i < passageRows.length; i += 100) check(await db.from('passages').upsert(passageRows.slice(i, i + 100), { onConflict: 'id', ignoreDuplicates: true }));
    const observations: TablesInsert<'observations'>[] = s.observations.map(o => { const { evidence_text: _e, position, ...fields } = o; return { ...fields, id: stableId(`observation:${versionId}:${JSON.stringify([o.measure_key,o.geography,o.reference_period,o.population ?? null])}`), source_version_id: versionId, passage_id: passageIds.get(position), verified_at: null, verified_by: null }; });
    const oldObservations = await rowsFor('observations', versionId);
    for (const o of observations) {
      const matches = oldObservations.filter(old => old.measure_key === o.measure_key && old.geography === o.geography && old.reference_period === o.reference_period && (old.population ?? null) === (o.population ?? null));
      if (matches.length > 1) throw new Error('Duplicate existing observation');
      if (matches[0]) { const { id: _id, verified_at: _at, verified_by: _by, ...fields } = o; same(matches[0], fields, 'Observation'); o.id = matches[0].id as string; }
    }
    if (oldObservations.some(old => !observations.some(o => o.id === old.id))) throw new Error('Existing version contains additional observations');
    for (let i = 0; i < observations.length; i += 100) check(await db.from('observations').upsert(observations.slice(i, i + 100), { onConflict: 'id', ignoreDuplicates: true }));
    const finalPassages = await rowsFor('passages', versionId); const finalObservations = await rowsFor('observations', versionId);
    if (finalPassages.length !== passageRows.length || finalObservations.length !== observations.length) throw new Error('Final row counts differ');
    for (const p of passageRows) same(finalPassages.find(row => row.id === p.id) ?? {}, p, 'Final passage');
    for (const o of observations) { const { verified_at: _at, verified_by: _by, ...fields } = o; same(finalObservations.find(row => row.id === o.id) ?? {}, fields, 'Final observation'); }
    const state = finalObservations.some(o => !o.verified_at) ? 'needs_verification' as const : 'ready_for_approval' as const;
    const detail = { pack_id: pack.pack_id, sha256: s.sha256, passages: passageRows.length, observations: observations.length, attribution: JSON.parse(JSON.stringify(pack.attribution ?? null)), extraction_sha256: sha256(JSON.stringify({ passages: s.passages, observations: s.observations })) };
    check(await db.from('knowledge_ingestion_events').upsert({ id: stableId(`event:${jobId}:complete`), job_id: jobId, state, message: 'Curated extraction imported. Human verification and approval remain required.', detail, actor_id: null }, { onConflict: 'id', ignoreDuplicates: true }));
    check(await db.from('audit_events').upsert({ id: stableId(`audit:${jobId}:complete`), action: 'knowledge_pack_imported', entity_kind: 'source_version', entity_id: versionId, actor_id: null, actor_role: 'system', origin: 'system', to_state: 'pending', detail }, { onConflict: 'id', ignoreDuplicates: true }));
    const finished = await db.from('source_versions').update({ ingest_state: 'done', file_path: storagePath, page_count: s.page_count, ingest_note: `${passageRows.length} curated passages; ${observations.length} figures. Human verification and approval required.` }).eq('id', versionId).eq('status', 'pending').select('id'); check(finished); if (!finished.data?.length) throw new Error('Version no longer pending');
    check(await db.from('knowledge_ingestion_jobs').update({ state, progress: 100, error_message: null, completed_at: new Date().toISOString(), detected_metadata: detail }).eq('id', jobId));
    return { key: s.key, sourceId, versionId, jobId, storagePath, status: 'pending', state, passages: passageRows.length, observations: observations.length, addedPassages: passageRows.length - oldPassages.length, addedObservations: observations.length - oldObservations.length, originalChecksumVerified: true };
  } catch (error) {
    // Leave successfully inserted immutable rows in place; the next run validates and resumes them.
    const message = error instanceof Error ? error.message : 'Import failed';
    await db.from('knowledge_ingestion_jobs').update({ state: 'failed', error_message: message }).eq('id', jobId);
    await db.from('source_versions').update({ ingest_state: 'failed', ingest_note: message }).eq('id', versionId).eq('status', 'pending');
    throw error;
  }
}
export async function main(args = process.argv.slice(2)) {
  if (args.some(arg => arg.startsWith('--') && arg !== '--apply' && arg !== '--dry-run')) throw new Error('Supported flags: --apply or --dry-run');
  if (args.includes('--apply') && args.includes('--dry-run')) throw new Error('Choose --apply or --dry-run');
  const files = args.filter(arg => !arg.startsWith('--')); if (files.length > 1) throw new Error('Provide one pack path');
  const { pack, originals } = await loadPack(resolve(files[0] ?? '../output/knowledge-base/pack.json'));
  const report = { mode: args.includes('--apply') ? 'apply' : 'dry-run', pack_id: pack.pack_id, checks: { officialHttpsUrls: true, localOriginalChecksums: true, passageLimits: true, observationEvidence: true, noAutomaticApproval: true }, sources: [] as unknown[], errors: [] as { key: string; message: string }[] };
  if (report.mode === 'apply') { const bucket = await db.storage.getBucket('knowledge-files'); check(bucket); if (bucket.data?.public !== false) throw new Error('knowledge-files must already exist and be private'); }
  // Separate sources have no dependent writes; keep bulk ingestion bounded.
  let nextSource = 0;
  const results = new Array<unknown>(pack.sources.length);
  await Promise.all(Array.from({ length: report.mode === 'apply' ? 8 : 1 }, async () => {
    while (nextSource < pack.sources.length) {
      const index = nextSource++;
      const s = pack.sources[index]!;
      if (report.mode === 'dry-run') results[index] = { key: s.key, url: s.url, sha256: s.sha256, passages: s.passages.length, observations: s.observations.length };
      else try { results[index] = await applySource(pack, s, originals.get(s.key)!); } catch (error) { report.errors.push({ key: s.key, message: error instanceof Error ? error.message : 'Import failed' }); }
    }
  }));
  report.sources = results.filter(Boolean);
  console.log(JSON.stringify(report, null, 2)); if (report.errors.length) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(JSON.stringify({ error: error instanceof Error ? error.message : 'Import failed' })); process.exitCode = 1; });
