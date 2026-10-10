const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
function loadSource(relative) {
  const filename = require('node:path').resolve(relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths; loaded.require = (name) => name === './types' ? loadSource('lib/types.ts') : require(name); loaded._compile(compiled, filename);
  return loaded.exports;
}
const policy = loadSource('lib/file-upload.ts');
const auth = loadSource('lib/auth.ts');
let role = 'Employee', owner = 'worker-a', jobReads = 0, uploads = 0, uploadError = null;
const user = () => ({ id: 'account-a', app_metadata: { rtsAccessActive: true, rtsRole: role, rtsEmployeeId: owner, rtsEmployeeName: 'Worker A' } });
const objects = new Map();
let lostResponse = false, corruptDownload = false;
const database = { storage: { from: () => ({
  upload: async (storagePath, buffer, options) => {
    assert.equal(options.upsert, false); assert.ok(!storagePath.includes('..')); uploads++;
    if (uploadError) return { error: uploadError };
    if (objects.has(storagePath)) return { error: { message: 'fixture duplicate' } };
    objects.set(storagePath, Buffer.from(buffer));
    return { error: lostResponse ? { message: 'fixture response lost after store' } : null };
  },
  download: async (storagePath) => objects.has(storagePath) ? { data: new Blob([corruptDownload ? Buffer.from('corrupt') : objects.get(storagePath)]), error: null } : { data: null, error: { message: 'fixture missing' } }
}) } };
const filename = require('node:path').resolve('app/api/files/upload/route.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const route = new Module(filename, module);
route.filename = filename;
route.paths = module.paths;
route.require = (name) => {
  if (name === '@/lib/file-upload') return policy;
  if (name === '@/lib/auth') return { ...auth, requireRole: async () => ({ ok: true, role, user: user(), authDisabled: false }) };
  if (name === '@/lib/jobs') return { getJob: async (id) => { jobReads++; return id === 'RTS-1' ? { assignedEmployeeIds: ['worker-a'] } : undefined; } };
  if (name === '@supabase/supabase-js') return { createClient: () => database };
  return require(name);
};
route._compile(code, filename);
function request(jobId = 'RTS-1', category = 'Paperwork', type = 'text/plain', content = 'fixture', expectedUserId) {
  const data = new FormData(); data.set('jobId', jobId); data.set('category', category); data.set('file', new File([content], 'fixture.txt', { type }));
  if (expectedUserId) data.set('expectedUserId', expectedUserId);
  return new Request('https://example.test/api/files/upload', { method: 'POST', body: data });
}
(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-only-key';
  assert.equal((await route.exports.POST(request())).status, 201); assert.equal(uploads, 1);
  const beforeReads = jobReads;
  assert.equal((await route.exports.POST(request('RTS-1', 'Paperwork', 'text/plain', 'fixture', 'different-account'))).status, 403);
  assert.equal(jobReads, beforeReads); assert.equal(uploads, 1, 'Account-change rejection happens before job/storage access');
  owner = 'worker-b'; assert.equal((await route.exports.POST(request())).status, 403); assert.equal(uploads, 1);
  owner = 'worker-a'; assert.equal((await route.exports.POST(request('missing'))).status, 404); assert.equal(uploads, 1);
  const reads = jobReads; assert.equal((await route.exports.POST(request('draft', 'Work Order'))).status, 403); assert.equal(jobReads, reads);
  role = 'Manager'; assert.equal((await route.exports.POST(request('draft', 'Work Order'))).status, 201);
  assert.equal((await route.exports.POST(request('draft', 'Other'))).status, 403);
  assert.equal((await route.exports.POST(request('RTS-1', 'Unknown'))).status, 400);
  assert.equal((await route.exports.POST(request('RTS-1', 'Other', 'text/html'))).status, 415);
  assert.equal((await route.exports.POST(request('RTS-1', 'Other', 'text/plain', ''))).status, 400);
  uploadError = { message: 'fixture failure' }; const failed = await route.exports.POST(request('RTS-1', 'Paperwork', 'text/plain', 'not-stored-fixture')); assert.equal(failed.status, 503); assert.ok(!(await failed.text()).includes('data:'));
  uploadError = null;
  const retryOne = await (await route.exports.POST(request())).json();
  const count = objects.size;
  const retryTwo = await (await route.exports.POST(request())).json();
  assert.equal(retryTwo.id, retryOne.id); assert.equal(retryTwo.storagePath, retryOne.storagePath); assert.equal(objects.size, count);
  const beforeConcurrent = objects.size;
  const concurrent = await Promise.all([route.exports.POST(request('RTS-1', 'Paperwork', 'text/plain', 'concurrent fixture')), route.exports.POST(request('RTS-1', 'Paperwork', 'text/plain', 'concurrent fixture'))]);
  assert.deepEqual(concurrent.map(response => response.status), [201, 201]);
  const concurrentFiles = await Promise.all(concurrent.map(response => response.json()));
  assert.equal(concurrentFiles[0].id, concurrentFiles[1].id);
  assert.equal(objects.size, beforeConcurrent + 1, 'Concurrent retry creates one object');
  lostResponse = true;
  const recovered = await route.exports.POST(request('RTS-1', 'Paperwork', 'text/plain', 'lost response fixture'));
  assert.equal(recovered.status, 201, 'Stored bytes confirm ambiguous upload response');
  lostResponse = false; corruptDownload = true;
  assert.equal((await route.exports.POST(request())).status, 503, 'Mismatched stored bytes never acknowledge success');
  corruptDownload = false;
  assert.notEqual(policy.uploadFingerprint(Buffer.from('same'), { ownerId: 'a', jobId: 'j', category: 'Other', caption: '', fileName: 'f', fileType: 'text/plain' }), policy.uploadFingerprint(Buffer.from('same'), { ownerId: 'b', jobId: 'j', category: 'Other', caption: '', fileName: 'f', fileType: 'text/plain' }), 'Accounts have separate retry identities');
  // Chunked requests cannot evade the actual byte cap by omitting Content-Length.
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(policy.maxUploadBytes)); controller.enqueue(new Uint8Array(300 * 1024)); controller.close(); } });
  await assert.rejects(policy.readUploadForm(new Request('https://example.test/upload', { method: 'POST', body: stream, duplex: 'half' })), (error) => error.status === 413);
  const large = new File([new Uint8Array(policy.maxUploadBytes + 1)], 'large.txt', { type: 'text/plain' });
  assert.throws(() => policy.validateUpload(large, 'Other'), (error) => error.status === 413);
  await assert.rejects(policy.readUploadForm(new Request('https://example.test/upload', { method: 'POST', body: 'invalid' })), (error) => error.status === 400);
  console.log('Upload route authorization, failure and bounded-body checks passed. No provider requests made.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
