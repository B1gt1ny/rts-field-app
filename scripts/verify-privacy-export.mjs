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
const drafts = execute(readFileSync('lib/client-drafts.ts', 'utf8'));
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
