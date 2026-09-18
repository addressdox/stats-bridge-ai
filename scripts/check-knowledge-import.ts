/** Read-only reconciliation of the final curated pack and the live retrieval boundary. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pack } from './import-knowledge-pack';
import { supabaseAdmin as db } from '../src/integrations/supabase/client.server';

type ImportRow = { key: string; sourceId: string; versionId: string; jobId?: string; storagePath?: string; status: string; passages?: number; observations?: number; originalChecksumVerified?: boolean; reportFile: string };
type Report = { mode: string; pack_id: string; sources: Omit<ImportRow, 'reportFile'>[]; errors: { key: string; message: string }[] };
const root = resolve('../output/knowledge-base');
const pack = JSON.parse(await readFile(`${root}/import-pack.json`, 'utf8')) as Pack;
const reportFiles = (await readdir(root)).filter(name => /^import-batch-\d+-result\.json$/.test(name)).sort((a,b) => Number(a.match(/batch-(\d+)/)![1]) - Number(b.match(/batch-(\d+)/)![1]));
if (!reportFiles.length) throw new Error('No completed import batch reports found');
const reports = await Promise.all(reportFiles.map(async file => ({ file, report: JSON.parse(await readFile(`${root}/${file}`, 'utf8')) as Report })));
if (reports.some(({report}) => report.mode !== 'apply' || report.pack_id !== pack.pack_id)) throw new Error('Import report mode or pack ID does not match the final pack');
// A later successful batch supersedes a previous extraction or resumable attempt.
const reported = reports.flatMap(({file, report}) => report.sources.map(row => ({ ...row, reportFile: file })));
const latestByKey = new Map<string, ImportRow>();
for (const row of reported) latestByKey.set(row.key, row);
const imported = pack.sources.flatMap(source => { const row = latestByKey.get(source.key); return row ? [row] : []; });
const ids = new Set(imported.map(row => row.versionId));
const allReportedIds = new Set(reported.map(row => row.versionId));
const historicalIds = new Set([...allReportedIds].filter(id => !ids.has(id)));
const counts: Record<string,number> = {};
for (const name of ['sources','source_versions','passages','observations','kb_embeddings','knowledge_ingestion_jobs'] as const) {
  const result = await db.from(name).select('id',{count:'exact',head:true});
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  counts[name] = result.count ?? 0;
}
async function all(table:'source_versions'|'passages'|'observations'|'sources') {
  const rows:any[]=[];
  for (let from=0; ; from+=500) {
    const result = await db.from(table).select('*').order('id').range(from,from+499);
    if (result.error) throw new Error(result.error.message);
    rows.push(...result.data);
    if (result.data.length<500) return rows;
  }
}
const [versions,passages,figures,sources,bucket] = await Promise.all([all('source_versions'),all('passages'),all('observations'),all('sources'),db.storage.getBucket('knowledge-files')]);
if (bucket.error) throw new Error('Private original bucket could not be inspected');
const versionById = new Map(versions.map(row => [row.id,row]));
const sourceById = new Map(sources.map(row => [row.id,row]));
const passageById = new Map(passages.map(row => [row.id,row]));
const currentVersions = versions.filter(row => ids.has(row.id));
const currentPassages = passages.filter(row => ids.has(row.source_version_id));
const currentFigures = figures.filter(row => ids.has(row.source_version_id));
const historicalVersions = versions.filter(row => historicalIds.has(row.id));
const historicalPassages = passages.filter(row => historicalIds.has(row.source_version_id));
const historicalFigures = figures.filter(row => historicalIds.has(row.source_version_id));
const equal = (a:unknown,b:unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const checks:Record<string,boolean>={};
checks.everyFinalPackSourceHasSuccessfulReport = imported.length === pack.sources.length && new Set(imported.map(row => row.key)).size === pack.sources.length;
checks.distinctCurrentVersionPerSource = ids.size === pack.sources.length;
checks.allImportedVersionsPresent = imported.every(row => versionById.has(row.versionId));
checks.allReportedVersionsRetained = [...allReportedIds].every(id => versionById.has(id));
checks.latestSuccessfulReportsMatchCurrentFingerprint = pack.sources.every(source => {
  const row = latestByKey.get(source.key); const version = row && versionById.get(row.versionId);
  return version && version.source_id === row!.sourceId && version.file_fingerprint === source.sha256 && version.original_url === source.url;
});
checks.allImportedPending = currentVersions.length === pack.sources.length && currentVersions.every(version => version.status==='pending' && version.ingest_state==='done' && version.approved_by===null && version.approved_at===null && version.approval_basis===null);
checks.historicalVersionsSuperseded = historicalVersions.every(version => version.status === 'superseded' && version.approved_by === null && version.approved_at === null && version.approval_basis === null);
checks.noPretendVerification = figures.filter(row => allReportedIds.has(row.source_version_id)).every(row => row.verified_by===null && row.verified_at===null);
checks.exactPassageCounts = pack.sources.every(source => { const row=latestByKey.get(source.key); return row && currentPassages.filter(p=>p.source_version_id===row.versionId).length===source.passages.length; });
checks.exactFigureCounts = pack.sources.every(source => { const row=latestByKey.get(source.key); return row && currentFigures.filter(o=>o.source_version_id===row.versionId).length===source.observations.length; });
checks.privateOriginalChecksums = bucket.data?.public === false && pack.sources.every(source => {
  const row=latestByKey.get(source.key); const version=row && versionById.get(row.versionId);
  return row?.originalChecksumVerified===true && version?.file_fingerprint===source.sha256 && version.file_path===row.storagePath && Boolean(row.storagePath);
});
checks.sourceMetadataMatchesFinalPack = pack.sources.every(source => {
  const row=latestByKey.get(source.key); const registered=row && sourceById.get(row.sourceId); const version=row && versionById.get(row.versionId);
  return registered && version && registered.title===source.title && registered.canonical_url===source.url && registered.source_type===source.source_type && registered.audience===source.audience && equal(registered.topic,source.topic) && equal(version.published_on,source.published_on) && equal(version.reference_period,source.reference_period) && equal(version.page_count,source.page_count);
});
checks.passageContentMatchesFinalPack = pack.sources.every(source => {
  const row=latestByKey.get(source.key); if (!row) return false;
  const current=currentPassages.filter(p=>p.source_version_id===row.versionId);
  return source.passages.every(expected => { const matches=current.filter(p=>p.position===expected.position); return matches.length===1 && Object.entries(expected).every(([key,value])=>equal(matches[0][key],value)); });
});
checks.figureContentMatchesFinalPack = pack.sources.every(source => {
  const row=latestByKey.get(source.key); if (!row) return false;
  const current=currentFigures.filter(o=>o.source_version_id===row.versionId);
  return source.observations.every(expected => {
    const matches=current.filter(o=>o.measure_key===expected.measure_key && o.geography===expected.geography && o.reference_period===expected.reference_period && equal(o.population,expected.population));
    if (matches.length!==1) return false;
    const figure=matches[0]; const evidence=passageById.get(figure.passage_id);
    const {evidence_text,position,...fields}=expected;
    return Object.entries(fields).every(([key,value])=>equal(figure[key],value)) && evidence?.source_version_id===row.versionId && evidence.position===position && evidence.content.includes(evidence_text);
  });
});
checks.figuresLinkToSameVersion = figures.filter(row=>allReportedIds.has(row.source_version_id)).every(row=>passageById.get(row.passage_id)?.source_version_id===row.source_version_id);
for (const [name,current] of [['sources',sources],['source_versions',versions],['observations',figures]] as const) {
  const before=JSON.parse(await readFile(resolve(`../tmp/knowledge/${name}-before.json`),'utf8'));
  checks[`existing_${name}_unchanged`]=before.every((row:any)=>{const now=current.find(r=>r.id===row.id);return now&&Object.entries(row).every(([key,value])=>equal(now[key],value));});
}
const retrieval=[];
for (const question of ['unemployment Q2 2026','consumer price inflation July 2026','population 2026','households piped water','electricity generation']) {
  const [p,o]=await Promise.all([db.rpc('search_passages',{_q:question,_limit:40}),db.rpc('search_observations',{_q:question,_limit:40})]);
  if (p.error||o.error) throw new Error('Live retrieval query failed');
  const hits=[...(p.data??[]),...(o.data??[])];
  retrieval.push({ question, existingApprovedHits:hits.filter(hit=>!allReportedIds.has(hit.source_version_id)).length, pendingImportedHits:hits.some(hit=>ids.has(hit.source_version_id)), supersededImportedHits:hits.some(hit=>historicalIds.has(hit.source_version_id)) });
}
// Exercise the exact-ID retrieval paths too, so exclusion is checked for every
// imported passage and figure, not only the five keyword probes above.
const byIdRetrieval = { passagesChecked: 0, figuresChecked: 0, pendingHits: 0, supersededHits: 0 };
for (const [kind, rows] of [['passages', [...currentPassages, ...historicalPassages]], ['figures', [...currentFigures, ...historicalFigures]]] as const) {
  for (let offset = 0; offset < rows.length; offset += 200) {
    const batch = rows.slice(offset, offset + 200).map(row => row.id as string);
    const result = kind === 'passages' ? await db.rpc('search_passages_by_id', { _ids: batch }) : await db.rpc('search_observations_by_id', { _ids: batch });
    if (result.error) throw new Error('Exact-ID retrieval boundary query failed');
    byIdRetrieval[kind === 'passages' ? 'passagesChecked' : 'figuresChecked'] += batch.length;
    for (const hit of result.data ?? []) {
      if (ids.has(hit.source_version_id)) byIdRetrieval.pendingHits++;
      if (historicalIds.has(hit.source_version_id)) byIdRetrieval.supersededHits++;
    }
  }
}
checks.allImportedEvidenceExcludedFromIdRetrieval = byIdRetrieval.pendingHits === 0 && byIdRetrieval.supersededHits === 0;
checks.pendingExcludedFromPublicRetrieval = retrieval.every(row=>!row.pendingImportedHits);
checks.supersededExcludedFromPublicRetrieval = retrieval.every(row=>!row.supersededImportedHits);
const result={
  checked_at:new Date().toISOString(), pack_id:pack.pack_id,
  imported:{sources:pack.sources.length,passages:pack.sources.reduce((n,s)=>n+s.passages.length,0),figures:pack.sources.reduce((n,s)=>n+s.observations.length,0)},
  currentCorpus:{sources:new Set(imported.map(row=>row.sourceId)).size,versions:currentVersions.length,passages:currentPassages.length,figures:currentFigures.length},
  historicalSuperseded:{sources:new Set(historicalVersions.map(row=>row.source_id)).size,versions:historicalVersions.length,passages:historicalPassages.length,figures:historicalFigures.length,versionIds:[...historicalIds]},
  batchReports:reportFiles,reportErrors:reports.flatMap(({file,report})=>report.errors.map(error=>({reportFile:file,...error}))),
  originalChecksumEvidence:'Each current version matches its latest successful import report, stored fingerprint and private bucket path. The importer verified stored bytes by download during ingestion; this checker does not re-download every original.',
  liveCounts:counts,checks,retrieval,byIdRetrieval,passed:Object.values(checks).every(Boolean),
};
await writeFile(`${root}/live-validation.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
if (!result.passed) process.exitCode=1;
