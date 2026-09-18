import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPack, officialUrl, packSchema, sha256, stableId, validateContent } from './import-knowledge-pack';
const content = 'Statistics South Africa reports that the unemployment rate was 31.4 percent in the second quarter.';
const fixture = () => ({ pack_id: 'test', assembled_at: '2026-09-18T00:00:00Z', attribution: 'Statistics South Africa', sources: [{ key: 'test', title: 'Quarterly report', topic: 'Labour', source_type: 'statistical_release', audience: 'public', url: 'https://www.statssa.gov.za/report.pdf', published_on: '2026-08-01', reference_period: '2026 Q2', page_count: 1, original_file: 'original.pdf', sha256: sha256(content), passages: [{ position: 0, page_number: 1, section_label: 'Summary', content }], observations: [{ measure: 'Unemployment rate', measure_key: 'unemployment_rate', value: 31.4, value_state: 'reported', display_value: '31.4%', unit: 'percent', geography: 'South Africa', reference_period: '2026 Q2', position: 0, page_number: 1, evidence_text: '31.4 percent' }] }] });
test('official boundary rejects deceptive hosts, insecure schemes and URL credentials', () => {
  for (const url of ['http://statssa.gov.za/a', 'https://statssa.gov.za.example.com/a', 'https://evilgov.za/a', 'https://user@statssa.gov.za/a', 'https://statssa.gov.za:8443/a']) assert.throws(() => officialUrl(url));
  assert.equal(officialUrl('https://www.statssa.gov.za/a#x'), 'https://www.statssa.gov.za/a');
});
test('identifiers are stable and scope content versions separately', () => {
  assert.equal(stableId('source:a'), stableId('source:a'));
  assert.notEqual(stableId('version:a:sha1'), stableId('version:a:sha2'));
  assert.match(stableId('a'), /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
});
test('rejects oversized, protection, duplicate and unsupported passages', () => {
  const tooLong = fixture(); tooLong.sources[0].passages[0].content = 'a'.repeat(1801); assert.throws(() => packSchema.parse(tooLong));
  const protection = fixture(); protection.sources[0].passages[0].content = 'Please verify you are human before accessing this statistics page.'; assert.throws(() => validateContent(packSchema.parse(protection)));
  const duplicate = fixture(); duplicate.sources[0].passages.push(duplicate.sources[0].passages[0]); assert.throws(() => validateContent(packSchema.parse(duplicate)));
  const falseEvidence = fixture(); falseEvidence.sources[0].observations[0].evidence_text = '99.9'; assert.throws(() => validateContent(packSchema.parse(falseEvidence)));
});
test('never accepts importer-supplied approval or verification', () => {
  const approved = fixture(); Object.assign(approved.sources[0], { status: 'approved' }); assert.throws(() => packSchema.parse(approved));
  const verified = fixture(); Object.assign(verified.sources[0].observations[0], { verified_at: '2026-09-18T00:00:00Z' }); assert.throws(() => packSchema.parse(verified));
});
test('validates originals offline and rejects changed bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'knowledge-pack-test-'));
  try {
    const path = join(root, 'pack.json'); await writeFile(path, JSON.stringify(fixture())); await writeFile(join(root, 'original.pdf'), content);
    const result = await loadPack(path); assert.equal(result.pack.sources.length, 1);
    await writeFile(join(root, 'original.pdf'), 'altered'); await assert.rejects(loadPack(path), /checksum/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
