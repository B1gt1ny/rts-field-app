// Real modules and route handlers, synthetic Auth/storage/provider only. No network writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url), ts = require('typescript');
function load(path, imports, extras = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { if (!(name in imports)) throw new Error(`Unexpected dependency ${name}`); return imports[name]; }, URL, Date, Set, Request, Response, AbortSignal, ...extras });
  return exports;
}
const helper = load('lib/job-cover.ts', {});
const job = { jobId: 'fixture', customerName: 'Synthetic Customer', revision: 'r1', phone: '+1 (555) 010-1234', address: '100 Example Road', city: 'Test City', companyCamProjectId: 'fixture-project', workOrderFiles: [
  { id: 'new', fileType: 'image/jpeg', fileName: 'new.jpg', uploadedAt: '2026-10-04', storagePath: 'jobs/fixture/new.jpg', dataUrl: '' },
  { id: 'first', fileType: 'image/jpeg', fileName: 'first.jpg', uploadedAt: '2026-10-01', storagePath: 'jobs/fixture/first.jpg', dataUrl: '' },
  { id: 'document', fileType: 'application/pdf', storageUrl: 'https://example.invalid/document' }
], beforePhotos: ['javascript:alert(1)'], history: ['preserved'] };
assert.equal(helper.jobContact(job).phoneHref, 'tel:+15550101234');
assert.equal(new URL(helper.jobContact(job).mapHref).searchParams.get('query'), '100 Example Road, Test City');
assert.equal(helper.jobContact({}).phoneHref, undefined);
assert.equal(helper.coverPhotos(job).length, 2);
assert.equal(helper.currentCover(job, helper.coverPhotos(job)).reference.id, 'first');
assert.equal(helper.currentCover({ ...job, coverPhoto: { source: 'file', id: 'new' } }, helper.coverPhotos(job)).reference.id, 'new');
assert.equal(helper.coverPhotos({ ...job, workOrderFiles: [], beforePhotos: [] }).length, 0);
let role = 'Admin', assigned = true, writes = 0, reads = 0, providerFail = false, conflict = false;
class JobConflictError extends Error { constructor() { super('Job changed. Reload.'); } }
const route = load('app/api/jobs/[id]/cover/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
  '@/lib/auth': { requireRole: async (_, allowed) => role && allowed.includes(role) ? { ok: true, role, user: { role } } : { ok: false, error: 'Denied', status: role ? 403 : 401 }, canEmployeeAccessJob: () => role !== 'Employee' || assigned },
  '@/lib/jobs': { getJob: async () => job, JobConflictError, saveJob: async (current, patch) => { if (conflict) throw new JobConflictError(); writes++; return { ...current, ...patch, revision: 'r2' }; } },
  '@/lib/job-cover': helper,
  '@/lib/integrations/companycam': { isCompanyCamConfigured: () => true, getCompanyCamProjectPhotos: async () => { reads++; if (providerFail) throw new Error('Synthetic outage'); return [{ id: 'provider-first', thumbnailUrl: 'https://example.invalid/photo.jpg', createdAt: '2026-09-01' }]; } }
});
const context = { params: Promise.resolve({ id: 'fixture' }) };
const call = async (method, body) => route[method](new Request('http://fixture.invalid/api/jobs/fixture/cover', { method, ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}) }), context);
for (const testRole of [null, 'Employee', 'Manager']) {
  role = testRole;
  assert.equal((await call('PUT', { coverPhoto: null, expectedRevision: 'r1' })).status, role ? 403 : 401);
}
assert.equal(writes, 0); assert.equal(reads, 0, 'Denied writes never contact provider');
role = 'Employee'; assigned = false; assert.equal((await call('GET')).status, 403);
assigned = true; const employee = await (await call('GET')).json(); assert.equal(employee.photo.reference.id, 'provider-first'); assert.equal(employee.photos, undefined);
role = 'Manager'; assert.equal((await call('GET')).status, 200);
role = 'Admin'; assert.equal((await (await call('GET')).json()).photos.length, 3);
assert.equal((await route.PUT(new Request('http://fixture.invalid', { method: 'PUT', body: 'null' }), context)).status, 400);
assert.equal((await route.PUT(new Request('http://fixture.invalid', { method: 'PUT', body: '{' }), context)).status, 400);
assert.equal((await call('PUT', { coverPhoto: { source: 'file', id: 'other-job' }, expectedRevision: 'r1' })).status, 400);
assert.equal((await call('PUT', { coverPhoto: { source: 'companycam', id: 'provider-first', projectId: 'foreign' }, expectedRevision: 'r1' })).status, 400);
assert.equal((await call('PUT', { coverPhoto: null, expectedRevision: 'stale' })).status, 409);
assert.equal(writes, 0);
const saved = await (await call('PUT', { coverPhoto: { source: 'file', id: 'new' }, expectedRevision: 'r1' })).json();
assert.equal(saved.photo.reference.id, 'new'); assert.equal(saved.revision, 'r2'); assert.equal(writes, 1); assert.equal(job.history[0], 'preserved');
assert.equal((await (await call('PUT', { coverPhoto: null, expectedRevision: 'r1' })).json()).photo.reference.id, 'provider-first');
conflict = true; assert.equal((await call('PUT', { coverPhoto: null, expectedRevision: 'r1' })).status, 409); conflict = false;
providerFail = true; assert.equal((await call('PUT', { coverPhoto: { source: 'companycam', id: 'provider-first', projectId: 'fixture-project' }, expectedRevision: 'r1' })).status, 503);
assert.equal((await (await call('GET')).json()).photo.reference.id, 'first', 'Provider outage preserves native fallback');
let pages = [];
const provider = load('lib/integrations/companycam.ts', {}, { process: { env: { COMPANYCAM_ACCESS_TOKEN: 'synthetic-only' } }, fetch: async url => {
  const page = Number(new URL(url).searchParams.get('page')); pages.push(page);
  const photos = page === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: `new-${i}`, captured_at: 2000, uris: [{ type: 'web', url: 'https://example.invalid/new.jpg' }] })) : [{ id: 'oldest', captured_at: 1000, uris: [{ type: 'web', url: 'https://example.invalid/first.jpg' }] }];
  return Response.json(photos);
} });
const providerPhotos = await provider.getCompanyCamProjectPhotos('fixture-project', true);
assert.equal(pages.join(','), '1,2');
assert.equal(helper.currentCover(job, helper.coverPhotos(job, providerPhotos)).reference.id, 'oldest');
assert.equal(providerPhotos[100].createdAt, new Date(1000 * 1000).toISOString());
console.log('PASS: contact links; image sources/ordering; provider pagination; assigned reads; Admin-only writes; membership; revision conflicts; outages; no integration writes.');
