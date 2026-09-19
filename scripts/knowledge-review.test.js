import { beforeEach, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const calls = [];
let responses = [];
let allowed = true;
let rpcCalls = [];
let rpcError = null;
let rpcResults = {};
let storageError = null;
let embeddingCalls = [];
let storageCalls = [];
let fileContents = 'Official South African statistical publication. This text is ready for human review.';
const context = { userId: 'human-reviewer', supabase: { rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: name === 'has_permission' ? allowed : (rpcResults[name] ?? 1), error: name === 'has_permission' ? null : rpcError }; } } };
const db = { from(table) {
  const call = { table, operations: [] }; calls.push(call);
  const chain = new Proxy({}, { get(_target, operation) {
    if (operation === 'then') return (resolve, reject) => { const response = responses.shift(); if (!response) return reject(new Error(`Unexpected query: ${table}`)); return Promise.resolve(response).then(resolve, reject); };
    return (...args) => { call.operations.push([operation, ...args]); return chain; };
  } });
  return chain;
}, storage: { from: bucket => ({
  download: async path => { storageCalls.push({ bucket, path, operation: 'download' }); return { data: new Blob([fileContents]), error: null }; },
  remove: async paths => { storageCalls.push({ bucket, paths, operation: 'remove' }); return { data: [], error: storageError }; },
  createSignedUrl: async (path, seconds) => { storageCalls.push({ bucket, path, seconds, operation: 'sign' }); return { data: { signedUrl: 'https://storage.example/signed-private-original' }, error: null }; },
}) } };
mock.module('@tanstack/react-start', () => ({ createServerFn: () => {
  let validator;
  const builder = { middleware: () => builder, inputValidator: fn => { validator = fn; return builder; }, handler: fn => async ({ data }) => fn({ context, data: validator ? validator(data) : data }) };
  return builder;
} }));
mock.module('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
mock.module('@/integrations/supabase/client.server', () => ({ supabaseAdmin: db }));
mock.module('@/lib/statbridge/embeddings.server', () => ({ backfillEmbeddings: async (...args) => { embeddingCalls.push(args); return {}; } }));
const { deleteKnowledgeSource, decideKnowledgeSource, verifyFigures, reviewKnowledgeSource, listKnowledgeSources, openKnowledgeOriginal, ingestKnowledgeFile } = await import('../src/lib/statbridge/knowledge.functions');
const versionId = '11111111-1111-4111-a111-111111111111';
const observationId = '22222222-2222-4222-a222-222222222222';
const sourceId = '33333333-3333-4333-a333-333333333333';
const result = (data = null, count = null) => ({ data, count, error: null });
beforeEach(() => { calls.length = 0; responses = []; allowed = true; rpcCalls = []; rpcError = null; rpcResults = {}; storageError = null; embeddingCalls = []; storageCalls = []; });
const upload = { title: 'Gender statistics', storagePath: 'human-reviewer/document.txt', fileName: 'document.txt', mimeType: 'text/plain', fileSize: 85 };

test('denies review, approval and private original access without permission', async () => {
  allowed = false;
  await expect(reviewKnowledgeSource({ data: { versionId } })).rejects.toThrow('sources.view');
  await expect(decideKnowledgeSource({ data: { versionId, action: 'approve' } })).rejects.toThrow('sources.approve');
  await expect(openKnowledgeOriginal({ data: { versionId } })).rejects.toThrow('sources.view');
  expect(calls).toHaveLength(0); expect(storageCalls).toHaveLength(0);
});

test('approval uses the authenticated atomic lifecycle and defaults to demonstration', async () => {
  await decideKnowledgeSource({ data: { versionId, action: 'approve' } });
  expect(rpcCalls).toContainEqual({ name: 'approve_source', args: { _version_id: versionId, _basis: 'demonstration' } });
  expect(calls).toHaveLength(0);
  expect(embeddingCalls[0][2]).toBe(versionId);
});

test('failed database verification or changed version never falls back to an admin write', async () => {
  for (const message of ['Every recorded figure must be checked by a person before approval', 'Only a pending version can be approved']) {
    rpcError = { message };
    await expect(decideKnowledgeSource({ data: { versionId, action: 'approve' } })).rejects.toThrow(message);
    expect(calls).toHaveLength(0);
  }
});

test('withdrawal and rejection use authenticated state-checked audited RPCs', async () => {
  for (const action of ['withdraw', 'reject']) {
    await decideKnowledgeSource({ data: { versionId, action, reason: 'Corrected release' } });
    expect(rpcCalls).toContainEqual({ name: `${action}_source`, args: { _version_id: versionId, _reason: 'Corrected release' } });
  }
  await expect(decideKnowledgeSource({ data: { versionId, action: 'withdraw', reason: ' ' } })).rejects.toThrow('reason');
  expect(calls).toHaveLength(0);
});

test('explicit figure checking uses authenticated RPC rather than admin verification fields', async () => {
  responses = [result([{ id: observationId, source_version_id: versionId, source_versions: { status: 'pending' } }])];
  await verifyFigures({ data: { observationIds: [observationId] } });
  expect(rpcCalls).toContainEqual({ name: 'verify_observations', args: { _ids: [observationId] } });
  expect(calls.flatMap(call => call.operations).some(op => op[0] === 'update')).toBe(false);
});

test('authorised reviewer can check timestamp-only demonstration figures but cannot edit approved official figures', async () => {
  responses = [result([{ id: observationId, source_version_id: versionId, verified_at: '2026-09-18', verified_by: null, source_versions: { status: 'approved', approval_basis: 'demonstration' } }])];
  await verifyFigures({ data: { observationIds: [observationId] } });
  expect(rpcCalls).toContainEqual({ name: 'verify_observations', args: { _ids: [observationId] } });
  rpcCalls = [];
  responses = [result([{ id: observationId, source_version_id: versionId, verified_at: '2026-09-18', verified_by: null, source_versions: { status: 'approved', approval_basis: 'official' } }])];
  await expect(verifyFigures({ data: { observationIds: [observationId] } })).rejects.toThrow('unchecked demonstration');
  expect(rpcCalls.some(call => call.name === 'verify_observations')).toBe(false);
});

test('register uses the source ownership foreign key and loads versions beyond 500', async () => {
  const versions = Array.from({ length: 500 }, (_, i) => ({ id: `version-${i}` }));
  const jobs = Array.from({ length: 500 }, (_, i) => ({ id: `new-job-${i}`, source_version_id: i === 0 ? 'version-0' : null }));
  responses = [result(versions), result([]), result([]), result(jobs), result([{ id: 'version-500' }]), result([{ id: 'older-job', source_version_id: 'version-0' }])];
  const rows = await listKnowledgeSources({});
  expect(rows).toHaveLength(501); expect(rows[0].job.id).toBe('new-job-0');
  const versionQueries = calls.filter(call => call.table === 'source_versions');
  expect(versionQueries).toHaveLength(2);
  expect(versionQueries[0].operations.find(op => op[0] === 'select')[1]).toContain('sources!source_versions_source_id_fkey(');
  expect(calls.filter(call => call.table === 'knowledge_ingestion_jobs')).toHaveLength(2);
});

test('uploaded originals receive short-lived private access using stored path only', async () => {
  responses = [result({ file_path: 'curated/original.pdf', original_url: null })];
  const original = await openKnowledgeOriginal({ data: { versionId, filePath: 'attacker-path' } });
  expect(original.url).toBe('https://storage.example/signed-private-original');
  expect(storageCalls).toEqual([{ bucket: 'knowledge-files', path: 'curated/original.pdf', seconds: 300, operation: 'sign' }]);
});

test('identical document reports existing status without duplicate creation or approval', async () => {
  responses = [result([{ id: versionId, source_id: sourceId, status: 'pending', sources: { title: 'Gender statistics' } }]), result(null, 3)];
  const existing = await ingestKnowledgeFile({ data: upload });
  expect(existing).toMatchObject({ duplicate: true, versionId, passages: 3, status: 'pending', sourceTitle: 'Gender statistics' });
  expect(calls.flatMap(call => call.operations).some(op => op[0] === 'update' || op[0] === 'insert')).toBe(false);
  expect(rpcCalls.some(call => call.name === 'approve_source')).toBe(false);
  expect(calls[0].operations).toContainEqual(['eq', 'sources.audience', 'public']);
});

test('replacement preserves source audience and creates pending version linked to old approval', async () => {
  responses = [result([]), result({ id: sourceId, current_version_id: versionId, audience: 'staff' }), result({ id: observationId }), result({ id: 'job' }), result(), result(), result(), result(), result()];
  const ingested = await ingestKnowledgeFile({ data: { ...upload, sourceId, audience: 'staff', versionLabel: 'Corrected edition' } });
  expect(ingested.duplicate).toBe(false);
  expect(calls.find(call => call.table === 'sources').operations.some(op => op[0] === 'insert' || op[0] === 'update')).toBe(false);
  const version = calls.find(call => call.table === 'source_versions' && call.operations.some(op => op[0] === 'insert')).operations.find(op => op[0] === 'insert')[1];
  expect(version).toMatchObject({ source_id: sourceId, supersedes_version_id: versionId, status: 'pending', version_label: 'Corrected edition' });
  expect(version.file_fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(rpcCalls.some(call => call.name === 'approve_source')).toBe(false);
});

test('failed extraction status update is not reported as an upload success', async () => {
  responses = [result([]), result({ id: sourceId, audience: 'public' }), result({ id: versionId }), result({ id: 'job' }), result(), result(), { data: null, error: { message: 'database write failed' } }, result(), result()];
  await expect(ingestKnowledgeFile({ data: upload })).rejects.toThrow('source status');
  expect(calls.filter(call => call.table === 'source_versions').flatMap(call => call.operations).some(op => op[0] === 'update' && op[1].ingest_state === 'failed')).toBe(true);
});

test('lifecycle migration restores guarded outer RPCs while retaining source-change audit path', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260918180001_knowledge_lifecycle.sql', import.meta.url), 'utf8');
  expect(migration.match(/require_access\('sources.approve'\)/g)).toHaveLength(3);
  expect(migration).toContain("PERFORM public.flag_source_change(_version_id, 'source_withdrawn', uid)");
  expect(migration).toContain("PERFORM public.flag_source_change(v.supersedes_version_id, 'source_superseded', uid)");
  expect(migration).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.(flag_source_change|write_audit|require_access)[^;]+TO[^;]*(?:authenticated|anon|PUBLIC)/);
  expect(migration).toContain('REVOKE ALL ON FUNCTION public.flag_source_change(uuid, public.void_reason, uuid) FROM PUBLIC, anon, authenticated');
});


test('deletion requires approval access and stops before storage on permission failure', async () => {
  allowed = false;
  await expect(deleteKnowledgeSource({ data: { versionId, reason: 'Synthetic removal' } })).rejects.toThrow('sources.approve');
  expect(storageCalls).toHaveLength(0);
  expect(rpcCalls.some(call => call.name === 'delete_knowledge_source')).toBe(false);
});

test('deletion excludes evidence first and removes only the canonical private original', async () => {
  rpcResults.delete_knowledge_source = 'reviewer/official-upload.pdf';
  await deleteKnowledgeSource({ data: { versionId, reason: 'Synthetic removal', filePath: 'another-users-document' } });
  expect(rpcCalls.map(call => call.name)).toEqual(['has_permission', 'delete_knowledge_source', 'finalize_knowledge_deletion']);
  expect(storageCalls).toEqual([{ bucket: 'knowledge-files', operation: 'remove', paths: ['reviewer/official-upload.pdf'] }]);
  expect(calls).toHaveLength(0);
});

test('failure to exclude evidence prevents any file deletion', async () => {
  rpcError = { message: 'The source changed' };
  await expect(deleteKnowledgeSource({ data: { versionId, reason: 'Synthetic removal' } })).rejects.toThrow('could not be removed');
  expect(storageCalls).toHaveLength(0);
  expect(rpcCalls.some(call => call.name === 'finalize_knowledge_deletion')).toBe(false);
});

test('storage failure retains a retryable deletion rather than reporting success', async () => {
  rpcResults.delete_knowledge_source = 'reviewer/official-upload.pdf';
  storageError = { message: 'Storage unavailable' };
  await expect(deleteKnowledgeSource({ data: { versionId, reason: 'Synthetic removal' } })).rejects.toThrow('Retry file deletion');
  expect(rpcCalls.some(call => call.name === 'finalize_knowledge_deletion')).toBe(false);
});

test('a fresh upload saves searchable extracts but requires human approval', async () => {
  responses = [result([]), result({ id: sourceId, audience: 'public' }), result({ id: versionId }), result({ id: 'job' }), result(), result(), result(), result(), result()];
  const ingested = await ingestKnowledgeFile({ data: upload });
  expect(ingested.status).toBe('pending');
  expect(ingested.passages).toBe(1);
  const extract = calls.find(call => call.table === 'passages').operations.find(op => op[0] === 'insert')[1][0];
  expect(extract.content).toBe(fileContents);
  expect(extract.source_version_id).toBe(versionId);
  expect(rpcCalls.some(call => call.name === 'approve_source')).toBe(false);
});
