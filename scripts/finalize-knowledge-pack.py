"""Merge captured findings and evidence-linked figures into the existing import format.
Run after prepare-knowledge-pack.py; repeat safely as a larger web batch finishes.
"""
import calendar
import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, parse_qsl, urlencode, urlunsplit

ROOT = Path(__file__).resolve().parents[2] / 'output/knowledge-base'
pack = json.loads((ROOT / 'pack.json').read_text())


def canonical(url):
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc.lower(), p.path, urlencode(sorted(parse_qsl(p.query))), ''))


def clean(text):
    text = re.sub(r'cite\d+†([^]+)', lambda m: m[1].split('†')[0], text)
    return re.sub(r'[ \t\xa0]+',' ',text).strip()


def chunks(text, maximum=1800):
    while len(text) > maximum:
        end = text.rfind(' ',0,maximum+1)
        if end < maximum//2: end = maximum
        yield text[:end].strip()
        text = text[end:].strip()
    if len(text) >= 40: yield text


def period(value):
    m = re.fullmatch(r'([1-4])(?:st|nd|rd|th) Quarter (20\d{2})',value or '')
    return f'Q{m[1]} {m[2]}' if m else value


def dates(value):
    m=re.fullmatch(r'Q([1-4]) (20\d{2})',value or '')
    if m:
        q,y=map(int,m.groups()); month=(q-1)*3+1
        return f'{y}-{month:02}-01',f'{y}-{month+2:02}-{calendar.monthrange(y,month+2)[1]}'
    try:
        d=datetime.strptime(value,'%B %Y')
        return d.strftime('%Y-%m-01'),f'{d.year}-{d.month:02}-{calendar.monthrange(d.year,d.month)[1]}'
    except (ValueError,TypeError):return None,None


existing={canonical(s['url']):s for s in pack['sources']}
bulk_path=ROOT/'web-bulk-index.json'
bulk=json.loads(bulk_path.read_text()) if bulk_path.exists() else []
for item in bulk:
    url=canonical(item['url'])
    date=None
    try:date=datetime.strptime(item['published_on'],'%d %B %Y').date().isoformat()
    except (ValueError,TypeError,KeyError):pass
    if url in existing:
        if not existing[url]['published_on']:existing[url]['published_on']=date
        continue
    if not item.get('body') or 'Key findings:' not in item['body']:
        continue
    title=clean(item['title'])
    ppn=dict(parse_qsl(urlsplit(url).query)).get('PPN','')
    topics={'P0211':'Labour market','P0141':'Prices and inflation','P0441':'Economic growth','P0277':'Formal employment and earnings','P0302':'Population','P0318':'Household services and living conditions','P4141':'Electricity','P2041':'Mining','P3041.2':'Manufacturing','P6242.1':'Retail trade'}
    # Keep source wording intact. Main findings only; no interface or sidebars.
    body=clean(item['body'])
    body=body.split('#### Key findings:',1)[1]
    body='\n'.join(body.splitlines()[1:]).strip()
    body=re.split(r'\n#+ (?:Publications|Media Contact|Press Room)',body)[0].strip()
    if len(body)<40:continue
    digest=hashlib.sha256(body.encode()).hexdigest()
    filename=f'web-bulk/{hashlib.sha256(url.encode()).hexdigest()}.evidence.txt'
    (ROOT/filename).write_text(body)
    passages=[]
    for paragraph in re.split(r'\n\s*\n',body):
        paragraph=clean(paragraph)
        if not paragraph or paragraph.startswith('#'):continue
        for chunk in chunks(paragraph):
            passages.append({'position':len(passages),'page_number':None,'section_label':title+' — published web findings','content':chunk})
    if not passages:continue
    s={'key':'release-'+hashlib.sha256(url.encode()).hexdigest()[:16], 'title':title,'topic':topics.get(ppn,'Official statistical findings'),
       'source_type':'statistical_release','audience':'public','url':url,'published_on':date,'reference_period':period(item.get('reference_period')),
       'page_count':None,'original_file':filename,'capture_file':str(Path(item['file']).relative_to(ROOT)),
       'capture_method':item['method'],'sha256':digest,'passages':passages,'observations':[]}
    pack['sources'].append(s);existing[url]=s

# Deterministic extraction of explicitly reported headline rates; never derive a rate.
for s in pack['sources']:
    if s['source_type']!='statistical_release':continue
    ppn=dict(parse_qsl(urlsplit(s['url']).query)).get('PPN')
    if ppn not in ['P0211','P0141']:continue
    s['reference_period']=period(s['reference_period'])
    patterns=[]
    if ppn=='P0211':
        patterns=[('unemployment_rate','Official unemployment rate (QLFS LU1)',r'(?:The )?official unemployment rate (?:was|is|remained(?: unchanged)? at|increased to|decreased to) (\d+[,.]\d+)\s*%', 'Labour force (QLFS)', 'Headline QLFS rate as published in this release; do not compare with QES formal-sector counts or combine LU1 with LU3/LU4.')]
    else:
        patterns=[('cpi_annual_inflation','Annual consumer price inflation',r'Annual consumer price inflation was (\d+[,.]\d+)\s*%', 'CPI for all urban areas','Year-on-year headline CPI; not the month-on-month rate. Basket/base revisions may affect index-level comparisons.'),
                  ('cpi_monthly_inflation','Monthly consumer price inflation',r'The CPI (increased|decreased) by (\d+[,.]\d+)\s*% month-on-month', 'CPI for all urban areas','Month-on-month headline CPI; not the annual inflation rate.')]
    for key,label,pattern,population,note in patterns:
        for p in s['passages']:
            match=re.search(pattern,p['content'],re.I)
            if not match:continue
            groups=match.groups(); numeric=groups[-1]; value=float(numeric.replace(',','.'))
            if len(groups)>1 and groups[0].lower()=='decreased':value=-value
            start,end=dates(s['reference_period'])
            if not start:break
            observation={'measure':label,'measure_key':key,'value':value,'value_state':'reported','display_value':str(value),
                         'unit':'%','population':population,'geography':'South Africa','reference_period':s['reference_period'],
                         'period_start':start,'period_end':end,'adjustment':None,'reported_change':None,'comparability_note':note,
                         'page_number':p['page_number'],'table_label':'Published key findings','evidence_text':match[0],'position':p['position']}
            if not any(o['measure_key']==key and o['reference_period']==observation['reference_period'] for o in s['observations']):
                s['observations'].append(observation)
            break

curated=ROOT/'current-observations.json'
if curated.exists():
    current=json.loads(curated.read_text())
    for s in pack['sources']:
        for o in current.get(s['key'],[]):
            # An explicit curated figure replaces a matching automatic headline.
            s['observations']=[x for x in s['observations'] if (x['measure_key'],x['geography'],x['reference_period'],x.get('population')) != (o['measure_key'],o['geography'],o['reference_period'],o.get('population'))]
            s['observations'].append(o)

# Remove extraction fragments that carry no usable prose (e.g. a solitary table row).
# Their full page text remains preserved in the capture; none become answer evidence.
for s in pack['sources']:
    # Equivalent wording for the CPI population must not create duplicate cards.
    if 'PPN=P0141&' in canonical(s['url']):
        seen_facts=set(); unique=[]
        for o in s['observations']:
            key=o['measure_key'].replace('cpi_monthly_change','cpi_monthly_inflation')
            population=(o.get('population') or '').lower().replace('cpi for ','')
            unit='%' if o['unit'] in ['percent','%'] else o['unit']
            fact=(key,population,o['geography'],o['reference_period'],o['value'],unit)
            if fact not in seen_facts:unique.append(o);seen_facts.add(fact)
        s['observations']=unique
    removed=[p for p in s['passages'] if len(p['content'])<40 or len(re.findall(r'[a-zA-Z]{2,}',p['content']))<5 or '\ufffd' in p['content'] or '\x00' in p['content']]
    if removed:
        pack['excluded'].append({'source':s['url'],'reason':'Unusable extraction fragments retained only in raw capture','positions':[p['position'] for p in removed]})
        s['passages']=[p for p in s['passages'] if p not in removed]

pack['assembled_at']=datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
(ROOT/'pack.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2))
allowed=['key','title','topic','source_type','audience','url','published_on','reference_period','page_count','original_file','sha256','passages','observations']
import_pack={k:pack[k] for k in ['pack_id','assembled_at','attribution']}
import_pack['sources']=[{k:s[k] for k in allowed} for s in pack['sources']]
(ROOT/'import-pack.json').write_text(json.dumps(import_pack,ensure_ascii=False,indent=2))
with (ROOT/'source-catalogue.csv').open('w') as f:
    w=csv.writer(f);w.writerow(['Title','Topic','Publication date','Reference period','URL','Passages','Figures','Capture method'])
    for s in pack['sources']:w.writerow([s['title'],s['topic'],s['published_on'],s['reference_period'],s['url'],len(s['passages']),len(s['observations']),s['capture_method']])
with (ROOT/'figures-for-review.csv').open('w') as f:
    w=csv.writer(f);w.writerow(['Measure','Value','Unit','Geography','Population','Period','Publication date','Source','Exact evidence','Comparability note','Verification'])
    for s in pack['sources']:
        for o in s['observations']:w.writerow([o['measure'],o['display_value'],o['unit'],o['geography'],o.get('population'),o['reference_period'],s['published_on'],s['url'],o['evidence_text'],o.get('comparability_note'),'Pending human review'])
print(json.dumps({'sources':len(pack['sources']),'passages':sum(len(s['passages']) for s in pack['sources']),'figures':sum(len(s['observations']) for s in pack['sources'])}))
