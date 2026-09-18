/** Retire two pending extraction versions after their corrected versions exist. */
import { readFile, writeFile } from 'node:fs/promises';
import { supabaseAdmin as db } from '../src/integrations/supabase/client.server';
import { stableId } from './import-knowledge-pack';

const root = '../output/knowledge-base';
const apply = process.argv.includes('--apply');
const oldReport = JSON.parse(await readFile(`${root}/import-batch-1-result.json`, 'utf8'));
const newReport = JSON.parse(await readFile(`${root}/import-batch-3-result.json`, 'utf8'));
const oldPack = JSON.parse(await readFile(`${root}/import-batch-1.json`, 'utf8'));
const newPack = JSON.parse(await readFile(`${root}/import-batch-3.json`, 'utf8'));
const fixes = [
  { key: 'statssa-corporate', reason: 'Preserved the complete corporate document directory in one extract; the previous extraction discarded short directory labels.' },
  { key: 'portal-2f17c57e7af2c8f7', reason: 'Removed a CSS display rule from the FAQ extraction; source wording is unchanged.' },
];
const results = [];
function check(result: { error: { message: string } | null }) { if (result.error) throw new Error(result.error.message); }
for (const fix of fixes) {
  const old = oldReport.sources.find((s: any) => s.key === fix.key);
  const replacement = newReport.sources.find((s: any) => s.key === fix.key);
  const oldSource = oldPack.sources.find((s: any) => s.key === fix.key);
  const newSource = newPack.sources.find((s: any) => s.key === fix.key);
  if (!old || !replacement || old.sourceId !== replacement.sourceId || old.versionId === replacement.versionId || !replacement.originalChecksumVerified) throw new Error('Replacement identity mismatch');
  const versions = await db.from('source_versions').select('*').in('id', [old.versionId, replacement.versionId]); check(versions);
  const previous = versions.data!.find(v => v.id === old.versionId);
  const current = versions.data!.find(v => v.id === replacement.versionId);
  if (!previous || !current || !['pending','superseded'].includes(previous.status) || current.status !== 'pending' || previous.ingest_state !== 'done' || current.ingest_state !== 'done' || previous.file_fingerprint !== oldSource.sha256 || current.file_fingerprint !== newSource.sha256 || previous.approved_at || current.approved_at) throw new Error('Pending extraction guard failed');
  const figures = await db.from('observations').select('id', { count: 'exact', head: true }).in('source_version_id', [old.versionId, replacement.versionId]); check(figures);
  if (figures.count !== 0) throw new Error('Unexpected figures in web extraction');
  const rows = await db.from('passages').select('source_version_id,position,content').in('source_version_id', [old.versionId, replacement.versionId]); check(rows);
  for (const [id, source] of [[old.versionId, oldSource],[replacement.versionId,newSource]]) {
    const actual = rows.data!.filter(p => p.source_version_id === id);
    if (actual.length !== source.passages.length || source.passages.some((p: any) => !actual.some(r => r.position === p.position && r.content === p.content))) throw new Error('Immutable evidence differs');
  }
  if (apply) {
    if (previous.status === 'pending') {
      const changed = await db.from('source_versions').update({ status: 'superseded', change_note: fix.reason }).eq('id', old.versionId).eq('status', 'pending').eq('file_fingerprint', oldSource.sha256).is('approved_at', null).select('id'); check(changed);
      if (changed.data?.length !== 1) throw new Error('Old version changed during correction');
    }
    check(await db.from('knowledge_ingestion_jobs').update({ state: 'superseded' }).eq('id', old.jobId).eq('source_version_id', old.versionId));
    check(await db.from('source_versions').update({ supersedes_version_id: old.versionId, change_note: fix.reason }).eq('id', replacement.versionId).eq('status', 'pending'));
    check(await db.from('audit_events').upsert({ id: stableId(`extraction-correction:${old.versionId}:${replacement.versionId}`), action: 'knowledge_extraction_corrected', entity_kind: 'source_version', entity_id: old.versionId, actor_id: null, actor_role: 'system', origin: 'system', from_state: 'pending', to_state: 'superseded', detail: { pack_id: newPack.pack_id, reason: fix.reason, replacement_version_id: replacement.versionId, old_evidence_preserved: true } }, { onConflict: 'id', ignoreDuplicates: true }));
  }
  results.push({ key: fix.key, supersededVersionId: old.versionId, currentVersionId: replacement.versionId, preservedPassages: oldSource.passages.length, currentPassages: newSource.passages.length, reason: fix.reason });
}
if (apply) await writeFile(`${root}/extraction-corrections.json`, JSON.stringify({ mode: 'applied', corrections: results }, null, 2));
console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', corrections: results }));
