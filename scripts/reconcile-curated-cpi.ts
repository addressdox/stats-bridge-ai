/** Remove two equivalent CPI figures from this task's pending import only. */
import {readFile,writeFile} from 'node:fs/promises';
import {supabaseAdmin as db} from '../src/integrations/supabase/client.server';
import {stableId} from './import-knowledge-pack';
const root='../output/knowledge-base';
const pack=JSON.parse(await readFile(`${root}/import-pack.json`,'utf8'));
const first=JSON.parse(await readFile(`${root}/import-batch-1-result.json`,'utf8'));
const source=pack.sources.find((s:any)=>s.key==='cpi-2026-07-findings');
const record=first.sources.find((s:any)=>s.key===source.key);
const {data:version,error}=await db.from('source_versions').select('status,file_fingerprint').eq('id',record.versionId).single();
if(error||version.status!=='pending'||version.file_fingerprint!==source.sha256)throw new Error('Pending imported source changed; stop');
const rows=await db.from('observations').select('*').eq('source_version_id',record.versionId);if(rows.error)throw rows.error;
// Individually read and compared before this correction. June is explicitly preserved.
const targetIds=['3309b07f-da3f-5a29-a99d-32d01826a8d4','8db84ad8-b20e-5304-a683-17f61be534a9'];
const june=rows.data.find(r=>r.id==='20bb3b9c-0a00-5fce-a54d-dd66e31f4c95');
if(!june||june.reference_period!=='June 2026'||june.value!==5)throw new Error('Expected June figure missing; stop');
const duplicate=rows.data.filter(r=>targetIds.includes(r.id));
if(duplicate.some(r=>r.reference_period!=='July 2026'||r.population!=='All urban areas'))throw new Error('Duplicate identities changed; stop');
if(duplicate.some(r=>r.verified_at||r.verified_by)||![0,2].includes(duplicate.length))throw new Error('Unexpected figures; stop');
for(const r of duplicate){const key=r.measure_key.replace('cpi_monthly_change','cpi_monthly_inflation');if(!rows.data.some(x=>x.id!==r.id&&x.measure_key===key&&x.reference_period===r.reference_period&&x.value===r.value&&['percent','%'].includes(x.unit)&&['percent','%'].includes(r.unit)&&x.population==='CPI for all urban areas'))throw new Error('No equivalent retained figure');}
if(duplicate.length){
 const removed=await db.from('observations').delete().in('id',targetIds).eq('source_version_id',record.versionId).eq('reference_period','July 2026').is('verified_at',null).select('id');if(removed.error||removed.data.length!==2)throw new Error('Deduplication failed');
 const audit=await db.from('audit_events').insert({id:stableId(`cpi-dedupe:${record.versionId}`),action:'knowledge_import_duplicate_figures_removed',entity_kind:'source_version',entity_id:record.versionId,actor_role:'system',origin:'system',detail:{pack_id:pack.pack_id,reason:'Same July 2026 CPI facts with equivalent all-urban-area population wording',removed_ids:duplicate.map(r=>r.id),retained_figures:source.observations.length}});if(audit.error)throw audit.error;
 const note=await db.from('source_versions').update({ingest_note:`${source.passages.length} curated passages; ${source.observations.length} figures. Human verification and approval required.`}).eq('id',record.versionId).eq('status','pending');if(note.error)throw note.error;
}
await writeFile(`${root}/cpi-deduplication.json`,JSON.stringify({versionId:record.versionId,removed:duplicate.map(r=>r.id),retainedFigures:source.observations.length,reason:'Equivalent duplicate figures; source text unchanged'},null,2));
console.log(JSON.stringify({removed:duplicate.length,retainedFigures:source.observations.length}));
