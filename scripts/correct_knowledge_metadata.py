"""Plan six evidence-backed metadata fixes. Default is dry-run; never connects to a DB.

--apply-files updates only rich/import JSON metadata after both are validated.
Generated SQL is separately reviewable: read-only assertions first, transactional apply
with pending/version/fingerprint/ingestion/audit guards. No passages or figures change.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path

CORRECTIONS = {
 'portal-9a58ae2fe70c857f': {'reference_period':'2022/23', 'reason':'Survey title explicitly identifies the 2022/23 reference period.'},
 'portal-e008756d7c037de4': {'reference_period':'2024/25', 'reason':'Survey title explicitly identifies the 2024/25 reference period.'},
 'portal-bb8b7ac9dad20789': {'reference_period':'2024/25', 'reason':'Metadata title explicitly identifies the 2024_2025 survey period.'},
 'portal-6ad6689ed7f70443': {'title':'Quarterly Labour Force Survey Guide — August 2008 edition', 'reference_period':None, 'edition':'August 2008', 'reason':'Document first page identifies August 2008; Q2 2026 in the hosting URL is not its edition or statistical reference period.'},
 'portal-8dac39d1672026e5': {'title':'Quarterly Labour Force Survey Concepts and Definitions — August 2008 edition', 'reference_period':None, 'edition':'August 2008', 'reason':'Document first page identifies August 2008; Q2 2026 in the hosting URL is not its edition or statistical reference period.'},
 'portal-8a72dd2b83562023': {'title':'Labour Market Dynamics in South Africa Concepts and Definitions — 2019 edition', 'reference_period':None, 'edition':'2019', 'reason':'Document first page identifies 2019; the hosting year is not its edition or a statistical reference period.'},
}

def metadata_for(key, title, period, first_page):
    change = CORRECTIONS.get(key)
    if not change:
        return title, period, None
    edition = change.get('edition')
    if edition and edition not in ' '.join(first_page.split()):
        raise ValueError(f'{key}: expected first-page edition evidence missing')
    return change.get('title', title), change['reference_period'], change['reason']

def q(value):
    return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]/'output/knowledge-base')
    parser.add_argument('--apply-files',action='store_true')
    args=parser.parse_args(); root=args.root
    originals={n:json.loads((root/n).read_text()) for n in ['pack.json','import-pack.json']}
    updated=copy.deepcopy(originals)
    records={}
    for report in sorted(root.glob('import-batch-*-result.json')):
        data=json.loads(report.read_text())
        for row in data.get('sources',[]):
            if row['key'] in CORRECTIONS:
                if row['key'] in records and records[row['key']] != row: raise ValueError('Conflicting import identity')
                records[row['key']]=row
    prior_path=root/'metadata-correction-plan.json'
    prior={c['key']:c for c in json.loads(prior_path.read_text()).get('changes',[])} if prior_path.exists() else {}
    plan=[]
    for key,correction in CORRECTIONS.items():
        pair=[]
        for filename in originals:
            matches=[s for s in updated[filename]['sources'] if s['key']==key]
            if len(matches)!=1: raise ValueError(f'{filename}: expected one {key}')
            pair.append(matches[0])
        rich,imp=pair
        for field in ['url','sha256','title','reference_period','passages','observations']:
            if rich[field]!=imp[field]: raise ValueError(f'{key}: rich/import {field} mismatch')
        first_page=' '.join(p['content'] for p in rich['passages'] if p['page_number']==1)
        title,period,note=metadata_for(key,rich['title'],rich['reference_period'],first_page)
        record=records.get(key)
        if not record or not record.get('originalChecksumVerified'): raise ValueError(f'{key}: no verified imported identity')
        if hashlib.sha256((root/rich['original_file']).read_bytes()).hexdigest()!=rich['sha256']: raise ValueError(f'{key}: original checksum mismatch')
        before={k:rich[k] for k in ['title','reference_period']}
        after={'title':title,'reference_period':period}
        previous=prior.get(key)
        if previous and previous['sha256']==rich['sha256'] and previous['after']==after:
            if before not in [previous['before'],previous['after']]: raise ValueError(f'{key}: metadata changed outside correction plan')
            before=previous['before']  # Keep the reviewed DB precondition after local files are corrected.
        entry={'key':key,'url':rich['url'],'sha256':rich['sha256'],'before':before,'after':after,'reason':note,
               'sourceId':record['sourceId'],'versionId':record['versionId'],'jobId':record['jobId'],
               'passages':len(rich['passages']),'observations':len(rich['observations'])}
        plan.append(entry)
        for source in pair: source.update(after)
        if note not in rich.get('capture_method',''): rich['capture_method']=rich.get('capture_method','')+'; metadata correction: '+note
    # Guard that payloads/evidence and source membership stay byte-for-byte equivalent as JSON objects.
    for filename,pack in updated.items():
        for old,new in zip(originals[filename]['sources'],pack['sources']):
            assert old['key']==new['key'] and old['passages']==new['passages'] and old['observations']==new['observations'] and old['sha256']==new['sha256']
    checks=[]; mutations=[]
    pack_id=originals['import-pack.json']['pack_id']
    for item in plan:
        s,v,j=map(q,[item['sourceId'],item['versionId'],item['jobId']]); before=item['before'];after=item['after'];fingerprint=q(item['sha256'])
        guard=f"""
  SELECT id INTO checked_id FROM public.sources WHERE id={s} AND canonical_url={q(item['url'])} AND title={q(before['title'])} FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source identity/title changed: {item['key']}'; END IF;
  IF (SELECT count(*) FROM public.source_versions WHERE source_id={s}) <> 1 THEN RAISE EXCEPTION 'Source has other versions: {item['key']}'; END IF;
  SELECT id INTO checked_id FROM public.source_versions WHERE id={v} AND source_id={s}
    AND status='pending' AND ingest_state='done' AND file_fingerprint={fingerprint}
    AND original_url={q(item['url'])} AND reference_period IS NOT DISTINCT FROM {q(before['reference_period'])}
    AND approved_by IS NULL AND approved_at IS NULL AND approval_basis IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending version guard failed: {item['key']}'; END IF;
  SELECT id INTO checked_id FROM public.knowledge_ingestion_jobs WHERE id={j} AND source_version_id={v}
    AND checksum={fingerprint} AND state IN ('ready_for_approval','needs_verification') AND progress=100
    AND detected_metadata->>'pack_id'={q(pack_id)} AND detected_metadata->>'sha256'={fingerprint} FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ingestion guard failed: {item['key']}'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.audit_events WHERE action='knowledge_pack_imported' AND entity_id={v}
    AND detail->>'pack_id'={q(pack_id)} AND detail->>'sha256'={fingerprint}) THEN RAISE EXCEPTION 'Import audit missing: {item['key']}'; END IF;
  IF (SELECT count(*) FROM public.passages WHERE source_version_id={v}) <> {item['passages']}
    OR (SELECT count(*) FROM public.observations WHERE source_version_id={v}) <> {item['observations']}
    THEN RAISE EXCEPTION 'Evidence counts changed: {item['key']}'; END IF;
"""
        checks.append(guard)
        if before!=after:
            detail=json.dumps({'pack_id':pack_id,'source_key':item['key'],'sha256':item['sha256'],'before':before,'after':after,'reason':item['reason'],'passages_unchanged':True,'figures_unchanged':True})
            mutations.append(f"""
  UPDATE public.sources SET title={q(after['title'])} WHERE id={s};
  UPDATE public.source_versions SET reference_period={q(after['reference_period'])},
    change_note=concat_ws(E'\\n',NULLIF(change_note,''),{q(item['reason'])}) WHERE id={v};
  INSERT INTO public.audit_events(action,entity_kind,entity_id,actor_role,origin,from_state,to_state,detail)
    VALUES('knowledge_source_metadata_corrected','source_version',{v},'system','system','pending','pending',{q(detail)}::jsonb);
""")
    def sql(parts): return 'BEGIN;\nDO $metadata_correction$\nDECLARE checked_id uuid;\nBEGIN\n'+''.join(parts)+'\nEND\n$metadata_correction$;\nCOMMIT;\n'
    (root/'metadata-correction-plan.json').write_text(json.dumps({'mode':'dry-run' if not args.apply_files else 'local-files-only','pack_id':pack_id,'changes':plan},indent=2,ensure_ascii=False))
    # FOR UPDATE is omitted for the genuinely read-only validation transaction.
    (root/'metadata-correction-check.sql').write_text(sql(checks).replace('BEGIN;','BEGIN READ ONLY;',1).replace(' FOR UPDATE',''))
    (root/'metadata-correction-apply.sql').write_text(sql(checks+mutations))
    if args.apply_files:
        for filename in updated:
            # Detect another worker editing the pack during this invocation.
            if json.loads((root/filename).read_text())!=originals[filename]: raise ValueError(f'{filename} changed during planning')
        for filename in updated:
            backup=root/(filename+'.before-metadata-correction')
            if not backup.exists(): backup.write_text(json.dumps(originals[filename],ensure_ascii=False,indent=2))
        for filename,pack in updated.items():
            temp=root/(filename+'.metadata-tmp');temp.write_text(json.dumps(pack,ensure_ascii=False,indent=2));temp.replace(root/filename)
    print(json.dumps({'mode':'local-files-only' if args.apply_files else 'dry-run','targets':len(plan),'changed':sum(x['before']!=x['after'] for x in plan),'database_mutated':False,'plan':str(root/'metadata-correction-plan.json')}))

if __name__=='__main__': main()
