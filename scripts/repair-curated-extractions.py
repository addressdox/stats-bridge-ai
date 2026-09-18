"""Correct two extracted web bodies before finalize-knowledge-pack.py.

Creates new capture fingerprints; never changes an uploaded immutable passage.
The full original retrieval/HTML remains in the corpus alongside these extracts.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'output/knowledge-base'
pack = json.loads((ROOT / 'pack.json').read_text())
for source in pack['sources']:
    if source['key'] == 'statssa-corporate':
        # Exact main-directory labels from page_id=627, retrieved 18 September 2026.
        # Keep them together: dropping individual short labels loses useful context.
        body = '\n'.join([
            'Corporate Information',
            'Annual report', 'Copyright and disclaimer',
            'Fundamental principles of statistics', 'Privacy statement',
            'Standardisation', 'Statistics council', 'Work programme', 'Strategic plan',
            'Statistics South Africa Service Charter',
            'Statistics South Africa Services Standards',
            'Statistics South Africa Service Delivery Improvement Plan',
        ])
        section = 'Corporate Information — public document directory'
        method = 'Official web page; exact main directory labels grouped together, not the contents of the linked documents'
    elif source['key'] == 'portal-2f17c57e7af2c8f7':
        raw = json.loads((ROOT / source['capture_file']).read_text())
        # Use the preserved extraction rather than changing spelling in source text.
        text = raw.get('text') or raw.get('content') or source['passages'][0]['content']
        body = re.sub(r'#more\s*\{\s*display:\s*none;?\s*\}', '', text).strip()
        section = 'Frequently Asked Questions'
        method = 'Official portal main content; CSS rule removed, source wording retained'
    else:
        continue
    if not 40 <= len(body) <= 1800:
        raise ValueError(f"Unexpected corrected body size for {source['key']}: {len(body)}")
    file = f"captures/{source['key']}.clean-v2.evidence.txt"
    (ROOT / file).write_text(body)
    source.update(original_file=file, sha256=hashlib.sha256(body.encode()).hexdigest(),
                  capture_method=method,
                  passages=[dict(position=0, page_number=None, section_label=section, content=body)])
(ROOT / 'pack.json').write_text(json.dumps(pack, ensure_ascii=False, indent=2))
print('Prepared two corrected web extracts as new fingerprint versions.')
