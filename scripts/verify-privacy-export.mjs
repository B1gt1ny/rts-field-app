// Execute production helpers against synthetic browser storage and hostile CSV text.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function execute(source, requireMock = () => ({}), additions = {}) {
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: requireMock, ...additions });
  return exports;
}
const drafts = execute(readFileSync('lib/client-drafts.ts', 'utf8'), undefined, { crypto: { randomUUID: () => `fixture-${++noteCounter}` } });
let noteCounter = 0;
function storage() {
  const values = new Map();
  return { get length() { return values.size; }, key(index) { return [...values.keys()][index] ?? null; }, getItem(key) { return values.get(key) ?? null; }, setItem(key, value) { values.set(key, value); }, removeItem(key) { values.delete(key); } };
}
const local = storage(), session = storage();
const adminKey = drafts.accountDraftKey('admin', 'job-new');
const employeeKey = drafts.accountDraftKey('employee', 'job-new');
assert.notEqual(adminKey, employeeKey); assert.equal(drafts.accountDraftKey(undefined, 'job-new'), null);
local.setItem(adminKey, 'synthetic customer draft');
assert.equal(local.getItem(employeeKey), null, 'Another account cannot restore the first account draft');
assert.equal(local.getItem(adminKey), 'synthetic customer draft', 'Same account retains draft');
local.setItem('company-command-job-draft-new', 'unowned'); local.setItem('company-command-draft-job', 'unowned note');
local.setItem('company-command-import-draft', 'unowned import'); local.setItem('rts-theme', 'dark');
drafts.removeLegacyDrafts(local);
assert.equal(local.getItem('company-command-job-draft-new'), null); assert.equal(local.getItem('company-command-draft-job'), null);
assert.equal(local.getItem(adminKey), 'synthetic customer draft'); assert.equal(local.getItem('rts-theme'), 'dark');
session.setItem(drafts.accountDraftKey('admin', 'work-order-import'), 'synthetic proposal'); session.setItem('company-command-work-order-import', 'unowned');
drafts.clearBrowserDrafts(local, session);
assert.equal(local.getItem(adminKey), null); assert.equal(session.length, 0); assert.equal(local.getItem('rts-theme'), 'dark');
const report = execute(readFileSync('app/api/reports/export/route.ts', 'utf8') + '\nexports.csvCell = csvCell; exports.toCsv = toCsv;');
for (const text of ['=1+1', '+SUM(1,2)', '-1+2', '@SUM(1,2)', ' \t=1+1', '\r\n=1+1']) {
  assert.equal(report.csvCell(text), '"\'' + text.replaceAll('"', '""') + '"');
}
for (const value of [-12.5, 0, 42]) assert.equal(report.csvCell(value), `"${value}"`, 'Numeric values stay numeric');
assert.equal(report.csvCell('plain, "text"'), '"plain, ""text"""');
assert.equal(report.toCsv([{ name: '=1+1', miles: 0 }]), 'name,miles\n"\'=1+1","0"');
// Real browser upload helpers reject server failures instead of embedding base64 data.
for (const [file, helper] of [['components/JobDetail.tsx', 'uploadStoredFile'], ['components/WorkOrderImport.tsx', 'uploadFile']]) {
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === helper);
  const code = fn.getText(ast).replaceAll('authFetch(', 'fakeFetch(') + `\nexports.upload = ${helper};`;
  const upload = execute(code, undefined, { FormData, fakeFetch: async () => new Response(JSON.stringify({ error: 'Keep your file and retry' }), { status: 503 }) });
  await assert.rejects(() => upload.upload(new File(['synthetic'], 'fixture.pdf'), 'fixture-job', 'Work Order'), /Keep your file/);
}
console.log('Privacy/export/upload fixtures PASS: account isolation, legacy discard, logout cleanup, formula safety, numeric preservation, controlled upload failure.');

// Execute the actual paperwork callback with a retry acknowledgement for an already attached file.
const paperworkSource = readFileSync('components/JobDetail.tsx', 'utf8');
const paperworkAst = ts.createSourceFile('JobDetail.tsx', paperworkSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let paperworkHandler;
function findPaperwork(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'addPaperworkFile') paperworkHandler = node;
  ts.forEachChild(node, findPaperwork);
}
findPaperwork(paperworkAst);
assert.ok(paperworkHandler, 'Actual paperwork handler must exist');
const confirmedFile = { id: 'file-stable', fileName: 'fixture.pdf' };
let paperworkPatch;
const paperworkCallback = execute(paperworkHandler.getText(paperworkAst) + '\nexports.attach = addPaperworkFile;', undefined, {
  job: { jobId: 'fixture-job' }, workOrderFiles: [confirmedFile, { id: 'other-file', fileName: 'other.pdf' }],
  paperwork: [], uploadStoredFile: async () => confirmedFile, addActivity: () => [],
  setError: () => assert.fail('Unexpected upload error'), savePatch: async (patch) => { paperworkPatch = patch; },
});
await paperworkCallback.attach(new File(['synthetic'], 'fixture.pdf'), 'Paperwork');
assert.equal(paperworkPatch.workOrderFiles.length, 2);
assert.equal(paperworkPatch.workOrderFiles.filter(file => file.id === confirmedFile.id).length, 1);
assert.equal(paperworkPatch.workOrderFiles[1].id, 'other-file', 'Retry preserves unrelated attachments');
console.log('Actual paperwork retry callback preserves one attachment per stable upload ID PASS.');

// A lost response must not duplicate a durable note or overwrite newer history.
let noteJob = { jobId: 'fixture-job', revision: 'r1', activityLog: [{ id: 'office-note', message: 'New office note' }] };
let noteWrites = 0, loseResponse = true, conflict = false, actor = 'worker';
const pending = { id: 'stable-note', text: 'Synthetic field note' };
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const fetchNote = async (url, init) => {
  if (url === '/api/auth/me') return response({ user: { id: actor } });
  if (!init) return response(noteJob);
  const body = JSON.parse(init.body);
  assert.equal(body.expectedUserId, 'worker');
  assert.equal(body.expectedRevision, noteJob.revision);
  if (conflict) return response({}, 409);
  noteWrites++;
  noteJob = { ...noteJob, revision: 'r2', activityLog: body.activityLog };
  if (loseResponse) throw new Error('Lost response after server save');
  return response(noteJob);
};
await assert.rejects(drafts.pushFieldNote(fetchNote, 'worker', 'fixture-job', pending));
assert.equal(noteWrites, 1);
loseResponse = false;
await drafts.pushFieldNote(fetchNote, 'worker', 'fixture-job', pending);
assert.equal(noteWrites, 1, 'Retry recognizes the original ID without another write');
assert.equal(noteJob.activityLog.filter(item => item.id === 'stable-note').length, 1);
assert.ok(noteJob.activityLog.some(item => item.id === 'office-note'), 'Existing office history survives');
conflict = true;
await assert.rejects(drafts.pushFieldNote(fetchNote, 'worker', 'fixture-job', { id: 'second-note', text: 'Second' }), /changed/);
assert.equal(noteWrites, 1);
actor = 'other';
await assert.rejects(drafts.pushFieldNote(fetchNote, 'worker', 'fixture-job', pending), /account/);
assert.equal(noteWrites, 1);
console.log('Offline note recovery PASS: lost-response deduplication, latest-revision merge, conflict retention, account guard.');

// Serialize two tabs through the production helper; stale tab must not recreate a sent note.
let chain = Promise.resolve();
const locks = { request(key, action) { const next = chain.then(action); chain = next.catch(() => {}); return next; } };
actor = 'worker'; conflict = false; loseResponse = false;
const noteStorage = storage(); noteStorage.setItem('draft', 'Two tab fixture');
const writesBeforeTabs = noteWrites;
const tabResults = await Promise.all([
  drafts.sendStoredFieldNote(noteStorage, locks, 'draft', 'pending', 'Two tab fixture', fetchNote, 'worker', 'fixture-job'),
  drafts.sendStoredFieldNote(noteStorage, locks, 'draft', 'pending', 'Two tab fixture', fetchNote, 'worker', 'fixture-job')
]);
assert.equal(noteWrites, writesBeforeTabs + 1, 'Two tabs create exactly one note');
assert.equal(tabResults[1].job, undefined, 'Stale tab does not send after draft cleared');
assert.equal(noteStorage.getItem('draft'), null);
await assert.rejects(drafts.sendStoredFieldNote(noteStorage, undefined, 'draft', 'pending', 'text', fetchNote, 'worker', 'fixture-job'), /browser/);
console.log('Cross-tab note submission and unsupported-lock fallback PASS.');

noteStorage.setItem('draft', 'Lost response persisted fixture');
loseResponse = true;
const beforeLostStored = noteWrites;
await assert.rejects(drafts.sendStoredFieldNote(noteStorage, locks, 'draft', 'pending', 'Lost response persisted fixture', fetchNote, 'worker', 'fixture-job'));
assert.equal(noteStorage.getItem('draft'), 'Lost response persisted fixture');
assert.ok(noteStorage.getItem('pending'), 'Pending identity survives a failed response');
loseResponse = false;
await drafts.sendStoredFieldNote(noteStorage, locks, 'draft', 'pending', 'Lost response persisted fixture', fetchNote, 'worker', 'fixture-job');
assert.equal(noteWrites, beforeLostStored + 1, 'Stored pending identity survives reload/retry without duplicate write');
assert.equal(noteStorage.getItem('draft'), null);
console.log('Durable pending note identity survives lost response and retry PASS.');
