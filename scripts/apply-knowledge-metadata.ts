/** Exact reviewed metadata correction. Default: read-only; --apply performs guarded updates. */
import {readFile} from 'node:fs/promises';
import {supabaseAdmin as db} from '../src/integrations/supabase/client.server';
import {stableId} from './import-knowledge-pack';

const root='../output/knowledge-base';
const plan=JSON.parse(await readFile(`${root}/metadata-correction-plan.json`,'utf8'));
const pack=JSON.parse(await readFile(`${root}/import-pack.json`,'utf8'));
const apply=process.argv.includes('--apply');
const expectedKeys=['portal-9a58ae2fe70c857f','portal-e008756d7c037de4','portal-bb8b7ac9dad20789','portal-6ad6689ed7f70443','portal-8dac39d1672026e5','portal-8a72dd2b83562023'];
if(plan.pack_id!==pack.pack_id||plan.changes.length!==6||expectedKeys.some(k=>plan.changes.filter((c:any)=>c.key===k).length!==1))throw Error('Unexpected correction scope');
const assert=(condition:unknown,message:string)=>{if(!condition)throw Error(message)};
const check=(result:any)=>{if(result.error)throw Error(result.error.message);return result.data;};
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const eq=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
async function rows(table:'passages'|'observations',versionId:string){const all:any[]=[];for(let from=0;;from+=500){const part=check(await db.from(table).select('*').eq('source_version_id',versionId).order('id').range(from,from+499));all.push(...part);if(part.length<500)return all;}}
function eventDetail(c:any){return {pack_id:plan.pack_id,source_key:c.key,sha256:c.sha256,before:c.before,after:c.after,reason:c.reason,passages_unchanged:true,figures_unchanged:true};}
function eventId(c:any){return stableId(`metadata-correction:v1:${plan.pack_id}:${c.versionId}:${JSON.stringify(c.after)}`);}
async function inspect(c:any){
 const source=pack.sources.find((s:any)=>s.key===c.key);
 assert(source&&source.sha256===c.sha256&&source.url===c.url&&source.title===c.after.title&&source.reference_period===c.after.reference_period,`${c.key}: corrected local pack mismatch`);
 const [sr,vr,jr,versions,importAudit,audit,passages,observations]=await Promise.all([
  db.from('sources').select('*').eq('id',c.sourceId).single(),
  db.from('source_versions').select('*').eq('id',c.versionId).single(),
  db.from('knowledge_ingestion_jobs').select('*').eq('id',c.jobId).single(),
  db.from('source_versions').select('id').eq('source_id',c.sourceId),
  db.from('audit_events').select('*').eq('entity_id',c.versionId).eq('action','knowledge_pack_imported'),
  db.from('audit_events').select('*').eq('id',eventId(c)),rows('passages',c.versionId),rows('observations',c.versionId)
 ]);
 const s=check(sr),v=check(vr),j=check(jr); const prior=check(audit);
 assert(check(versions).length===1,`${c.key}: additional source versions`);
 assert(s.canonical_url===c.url&&[c.before.title,c.after.title].includes(s.title),`${c.key}: source identity/title changed`);
 assert(v.source_id===c.sourceId&&v.status==='pending'&&v.ingest_state==='done'&&v.file_fingerprint===c.sha256&&v.original_url===c.url,`${c.key}: version status/fingerprint changed`);
 assert(v.approved_by===null&&v.approved_at===null&&v.approval_basis===null,`${c.key}: approval exists`);
 assert([c.before.reference_period,c.after.reference_period].includes(v.reference_period),`${c.key}: unexpected period`);
 assert(j.source_version_id===c.versionId&&j.checksum===c.sha256&&j.progress===100&&['ready_for_approval','needs_verification'].includes(j.state),`${c.key}: ingestion incomplete`);
 assert((j.detected_metadata as any)?.pack_id===plan.pack_id&&(j.detected_metadata as any)?.sha256===c.sha256,`${c.key}: ingestion provenance changed`);
 assert(check(importAudit).some((a:any)=>a.detail?.pack_id===plan.pack_id&&a.detail?.sha256===c.sha256),`${c.key}: import audit missing`);
 assert(passages.length===c.passages&&observations.length===c.observations,`${c.key}: evidence counts changed`);
 assert(observations.every(o=>o.verified_by===null&&o.verified_at===null),`${c.key}: figures verified meanwhile`);
 for(const p of source.passages){const saved=passages.find(r=>r.position===p.position);assert(saved&&['position','page_number','section_label','content'].every(f=>eq(saved[f],p[f])),`${c.key}: passage differs from reviewed pack`);}
 for(const o of source.observations){const saved=observations.find(r=>r.measure_key===o.measure_key&&r.reference_period===o.reference_period&&r.geography===o.geography&&(r.population??null)===(o.population??null));assert(saved&&saved.value===o.value&&saved.unit===o.unit,`${c.key}: figure differs from reviewed pack`);}
 assert(prior.length<=1,`${c.key}: duplicate audit`);
 if(prior.length)assert(prior[0].action==='knowledge_source_metadata_corrected'&&eq(prior[0].detail,eventDetail(c)),`${c.key}: correction audit identity changed`);
 return {s,v,j,passages,observations,audited:prior.length===1};
}
// Finish every read/guard before the first write. Six targets, bounded sequential inspection.
const snapshots=new Map<string,Awaited<ReturnType<typeof inspect>>>();
for(const c of plan.changes)snapshots.set(c.key,await inspect(c));
console.log(JSON.stringify({mode:apply?'apply':'dry-run',validated:snapshots.size,pending:true,changes:plan.changes.map((c:any)=>({key:c.key,before:c.before,after:c.after,audited:snapshots.get(c.key)!.audited}))}));
if(apply){
 for(const c of plan.changes){
  const before=snapshots.get(c.key)!;
  // Recheck the live guard immediately before each target; REST writes cannot be transactional.
  const fresh=await inspect(c);
  assert(eq(before.passages,fresh.passages)&&eq(before.observations,fresh.observations),`${c.key}: evidence changed during correction`);
  const note=(fresh.v.change_note??'').includes(c.reason)?fresh.v.change_note:[fresh.v.change_note,c.reason].filter(Boolean).join('\n');
  let update=db.from('source_versions').update({reference_period:c.after.reference_period,change_note:note}).eq('id',c.versionId).eq('source_id',c.sourceId).eq('status','pending').eq('ingest_state','done').eq('file_fingerprint',c.sha256).is('approved_by',null).is('approved_at',null).is('approval_basis',null);
  update=fresh.v.reference_period===null?update.is('reference_period',null):update.eq('reference_period',fresh.v.reference_period);
  update=fresh.v.change_note===null?update.is('change_note',null):update.eq('change_note',fresh.v.change_note);
  assert(check(await update.select('id')).length===1,`${c.key}: version compare-and-set failed`);
  const still=check(await db.from('source_versions').select('status,ingest_state,file_fingerprint,approved_at').eq('id',c.versionId).single());
  assert(still.status==='pending'&&still.ingest_state==='done'&&still.file_fingerprint===c.sha256&&still.approved_at===null,`${c.key}: version became non-pending; stop before title update`);
  assert(check(await db.from('sources').update({title:c.after.title}).eq('id',c.sourceId).eq('canonical_url',c.url).eq('title',fresh.s.title).select('id')).length===1,`${c.key}: source compare-and-set failed`);
  check(await db.from('audit_events').upsert({id:eventId(c),action:'knowledge_source_metadata_corrected',entity_kind:'source_version',entity_id:c.versionId,actor_role:'system',origin:'system',from_state:'pending',to_state:'pending',detail:eventDetail(c)},{onConflict:'id',ignoreDuplicates:true}));
  const after=await inspect(c);
  assert(after.s.title===c.after.title&&after.v.reference_period===c.after.reference_period&&after.audited,`${c.key}: after verification failed`);
  assert(eq(before.passages,after.passages)&&eq(before.observations,after.observations),`${c.key}: evidence changed`);
  console.log(JSON.stringify({key:c.key,corrected:true,pending:true,passagesUnchanged:true,figuresUnchanged:true}));
 }
}
