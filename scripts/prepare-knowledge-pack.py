"""Assemble fetched official evidence; never generate statistics or grant approval.

Run from the app: python3 scripts/prepare-knowledge-pack.py
Inputs are preserved web captures and the portal collector's page-preserving files.
"""
import hashlib
import json
import re
import shutil
from correct_knowledge_metadata import metadata_for
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/knowledge-base'
RAW = ROOT / 'tmp/knowledge'
(OUT / 'captures').mkdir(parents=True, exist_ok=True)
NOW = datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
sources, excluded = [], []


def clean(text):
    text = re.sub(r'cite\d+†([^]+)', lambda m: m[1].split('†')[0], text)
    return re.sub(r'[ \t\xa0]+', ' ', text).strip()


def web_content(name):
    raw = (RAW / f'web-{name}.txt').read_text()
    match = re.search(r'\((https://[^\s)]+)\)', raw)
    if not match or 'Total lines:' not in raw:
        raise ValueError(f'No captured source: {name}')
    rows = [(int(n), clean(t)) for n, t in re.findall(r'L(\d+):\s*(.*?)(?=L\d+:|\Z)', raw, re.S)]
    start = next((n + 1 for n,t in rows if n < 90 and 'Verify Fieldworker' in t), 49)
    main = []
    for number, text in rows:
        if number < start:
            continue
        if re.match(r'#+ (Publications$|Publication Schedule|Recently Published|Recent Articles|Categories|Related Information|Press Room|Media Contact|My Municipality)', text):
            break
        if text.startswith('Posted on '):
            break
        if text and not re.match(r'^(Facebook|Twitter|Linkedin|\* \* \*)$', text):
            main.append(text)
    return match[1], main, raw


def chunks(text, maximum=1800):
    text = text.strip()
    while len(text) > maximum:
        end = text.rfind(' ', 0, maximum + 1)
        if end < maximum // 2:
            end = maximum
        yield text[:end].strip()
        text = text[end:].strip()
    if text:
        yield text


def publication_date(catalogue):
    _, lines, _ = web_content(catalogue)
    for line in lines:
        match = re.search(r'Publication date & time: (\d+ \w+ \d{4})', line)
        if match:
            return datetime.strptime(match[1], '%d %B %Y').date().isoformat()
    return None


def add_web(name, title, topic, kind, period=None, date=None, catalogue=None, audience='public'):
    url, paragraphs, raw = web_content(name)
    if catalogue:
        date = publication_date(catalogue)
    if name == 'qlfs-2026-q1-findings':
        bad = [p for p in paragraphs if 'compared with the fourth quarter of 2026' in p]
        paragraphs = [p for p in paragraphs if p not in bad]
        excluded.append({'source': name, 'reason': 'Source comparison says Q1 2026 versus Q4 2026, an apparent date error. Entire affected LU2/LU3 paragraph withheld, not silently corrected.', 'text': bad})
    relative = f'captures/{name}.txt'
    shutil.copyfile(RAW / f'web-{name}.txt', OUT / relative)
    if catalogue:
        shutil.copyfile(RAW / f'web-{catalogue}.txt', OUT / f'captures/{catalogue}.txt')
    evidence_file = f'captures/{name}.evidence.txt'
    evidence = '\n\n'.join(paragraphs)
    (OUT / evidence_file).write_text(evidence)
    passages = []
    for paragraph in paragraphs:
        if paragraph.startswith('#') or len(paragraph) < 40:
            continue
        for chunk in chunks(paragraph):
            passages.append({'position': len(passages), 'page_number': None, 'section_label': title + ' — published web text', 'content': chunk})
    if not passages or sum(len(p['content']) for p in passages) < 80:
        excluded.append({'source':url,'reason':'Navigation-only landing page; referenced document must be collected separately'})
        return
    sources.append({'key': name, 'title': title, 'topic': topic, 'source_type': kind, 'audience': audience, 'url': url,
                    'published_on': date, 'reference_period': period, 'page_count': None, 'original_file': evidence_file,
                    'capture_file': relative, 'capture_method': 'Official web page, main content extracted from preserved web retrieval',
                    'sha256': hashlib.sha256(evidence.encode()).hexdigest(), 'passages': passages, 'observations': []})


for name, title, topic, period, catalogue in [
    ('qlfs-2025-q3-findings','QLFS Q3 2025 — key findings','Labour market','Q3 2025','qlfs-2025-q3-catalogue'),
    ('qlfs-2025-q4-findings','QLFS Q4 2025 — key findings','Labour market','Q4 2025','qlfs-2025-q4-catalogue'),
    ('qlfs-2026-q1-findings','QLFS Q1 2026 — key findings','Labour market','Q1 2026',None),
    ('qlfs-2026-q2-findings','QLFS Q2 2026 — key findings','Labour market','Q2 2026','qlfs-catalogue'),
    ('cpi-2026-07-findings','Consumer price index July 2026 — key findings','Prices and inflation','July 2026','cpi-catalogue'),
    ('gdp-2026-q2-findings','Gross domestic product Q2 2026 — key findings','Economic growth','Q2 2026','gdp-catalogue'),
    ('population-2026-findings','Mid-year population estimates 2026 — key findings','Population','2026','population-catalogue'),
    ('ghs-2025-findings','General Household Survey 2025 — key findings','Household services and living conditions','2025','ghs-catalogue'),
    ('qes-2026-q1-findings','Quarterly Employment Statistics March 2026 — key findings','Formal employment and earnings','March 2026','qes-catalogue'),
    ('ppi-2026-07-findings','Producer price index July 2026 — key findings','Prices and inflation','July 2026','ppi-catalogue'),
    ('retail-2026-07-findings','Retail trade sales July 2026 — key findings','Retail trade','July 2026','retail-catalogue'),
    ('electricity-2026-07-findings','Electricity July 2026 — key findings','Electricity','July 2026','electricity-catalogue'),
    ('mining-2026-07-findings','Mining production July 2026 — key findings','Mining','July 2026','mining-catalogue'),
    ('manufacturing-2026-07-findings','Manufacturing July 2026 — key findings','Manufacturing','July 2026','manufacturing-catalogue'),
    ('crime-2026-findings','Victims of Crime 2025/26 — key findings','Crime and safety','2025/26','crime-catalogue'),
    ('subjective-poverty-findings','Subjective poverty in South Africa 2015–2023 — key findings','Poverty','2015–2023','subjective-poverty-catalogue'),
]:
    add_web(name,title,topic,'statistical_release',period,catalogue=catalogue)

for name, title, topic, kind, date, period in [
    ('qlfs-methodology','Quarterly Labour Force Survey — purpose and coverage','Labour market','methodology',None,None),
    ('gdp-methodology','Gross domestic product — purpose and coverage','Economic growth','methodology',None,None),
    ('statssa-corporate','Stats SA corporate information','Organisation','organisational_page',None,None),
    ('statssa-vision','Stats SA vision and mission','Organisation','organisational_page',None,None),
    ('statssa-act','Statistics Act — Stats SA overview','Statistical mandate','organisational_page',None,None),
    ('statssa-data-policy','Stats SA publications and data access policy','Data access','organisational_page',None,None),
    ('copyright','Stats SA copyright and disclaimer','Data reuse','organisational_page',None,None),
    ('statssa-contact','Stats SA published contact directory','Contact and escalation','organisational_page',None,None),
    ('qlfs-2026-q2-media','Media release: QLFS Q2 2026','Labour market','media_release','2026-08-11','Q2 2026'),
    ('census-2022-media','Media release: Census 2022 results','Population','media_release','2023-10-10','Census 2022'),
    ('fieldworker-statement','Media statement: no association with resurfaced social media warning','Fieldworker verification','media_release','2026-06-04',None),
    ('census-anniversary-release','Release: 30 years of democratic censuses','Organisation','media_release','2026-06-17',None),
    ('migration-statement','Media statement: migration and population landscape','Migration','media_release','2026-06-26',None),
    ('gdp-2026-q2-story','GDP declines by 0.2% in Q2 2026 — Stats SA data story','Economic growth','other','2026-09-08','Q2 2026'),
]:
    add_web(name,title,topic,kind,period,date)

portal = json.loads((OUT / 'portal-index.json').read_text())
seen = {}
for entry in sorted(portal['sources'], key=lambda e: e['url'], reverse=True):
    if re.search(r'questionn?aire', entry['title'], re.I):
        excluded.append({'source': entry['url'], 'reason': 'Survey questionnaire; not an answer source or aggregate dataset'})
        continue
    data = json.loads((OUT / entry['file']).read_text())
    original_file = entry['originalFile']
    raw = (OUT / original_file).read_bytes()
    if not raw:
        # Earlier extraction detached the PDF input buffer before saving it.
        # Retain the real page-preserving extract, never upload an empty PDF.
        original_file = entry['file']
        raw = (OUT / original_file).read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    # Identical definitions and guides are published at multiple quarterly URLs.
    text_digest = hashlib.sha256('\n'.join(data.get('pages', [data.get('text','')])).encode()).hexdigest()
    if text_digest in seen:
        excluded.append({'source':entry['url'],'reason':'Identical extracted document retained once','retained':seen[text_digest]})
        continue
    seen[text_digest] = entry['url']
    passages = []
    pages = data.get('pages', [data.get('text', '')])
    for page_index, page in enumerate(pages):
        for chunk in chunks(clean(page)):
            if len(chunk) < 40:
                continue
            passages.append({'position':len(passages),'page_number':page_index+1 if entry['kind']=='pdf' else None,
                             'section_label':entry['title'],'content':chunk})
    title = entry['title']
    quarter = re.search(r'/QLFS/(\d{4})/Qtr0([1-4])/', entry['url'], re.I)
    year = re.search(r'(?<!\d)(20\d{2})(?!\d)', title)
    period = f'Q{quarter[2]} {quarter[1]}' if quarter else (year[1] if year else None)
    title, period, correction_note = metadata_for('portal-'+entry['key'], title, period, pages[0] if pages else '')
    topic = 'Labour market methodology' if '/QLFS/' in entry['url'] else 'Data access and methodology'
    sources.append({'key':'portal-'+entry['key'],'title':title,'topic':topic,'source_type':'methodology' if entry['kind']=='pdf' else ('faq_page' if '/faq.' in entry['url'] else 'organisational_page'),
                    'audience':'public','url':entry['url'],'published_on':None,'reference_period':period,'page_count':data.get('pageCount'),
                    'original_file':original_file,'capture_file':entry['file'],'capture_method':data['sourceMethod'] + ('; metadata correction: '+correction_note if correction_note else '') + ('; stored artifact is extracted JSON, original PDF binary unavailable' if original_file.endswith('.json') else ''),
                    'sha256':digest,'passages':passages,'observations':[]})

pack={'pack_id':'statssa-public-2026-09-18-v1','assembled_at':NOW,'geography':'South Africa',
      'approval':'pending; administrator must verify figures and approve sources; team approval is demonstration, not departmental approval',
      'attribution':'Statistics South Africa. Extraction, selection and structuring by StatBridge; no endorsement implied. See https://www.statssa.gov.za/?page_id=425',
      'sources':sources,'excluded':excluded,'collection_failures':portal['failures']}
(OUT/'pack.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2))
print(json.dumps({'sources':len(sources),'passages':sum(len(s['passages']) for s in sources),'excluded':len(excluded)}))
