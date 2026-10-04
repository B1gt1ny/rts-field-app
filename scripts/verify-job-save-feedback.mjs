// Execute the real photo component with synthetic hooks/transport; no browser/provider writes.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
let states = [], cursor = 0, uploads = 0, attempts = 0, savedPatch;
const jsx = (type, props) => ({ type, props });
const react = { useEffect() {}, useState(initial) {
  const index = cursor++;
  if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
  return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
} };
const code = ts.transpileModule(readFileSync('components/JobDetail.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
}).outputText + '\nexports.PhotoUploadPanel = PhotoUploadPanel;';
const exports = {};
vm.runInNewContext(code, { exports, console, FormData, File, Date, Math, Map, Set,
  require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/lib/client-auth') return { authFetch: async () => {
      uploads++;
      return new Response(JSON.stringify({ id: 'fixture-photo', category: 'Before', fileName: 'fixture.jpg', dataUrl: '/api/files/view?path=fixture', storagePath: 'fixture' }), { status: 201 });
    } };
    return new Proxy({}, { get: () => () => ({}) });
  }
});
const job = { jobId: 'fixture-job', jobType: 'Setup', scopeNotes: '', workOrderFiles: [], activityLog: [] };
let failSave = true;
function render() {
  cursor = 0;
  return exports.PhotoUploadPanel({ job, saving: false, onSave: async patch => {
    attempts++; savedPatch = patch;
    return failSave ? undefined : { ...job, ...patch };
  } });
}
function nodes(root) {
  if (!root || typeof root !== 'object') return [];
  if (Array.isArray(root)) return root.flatMap(nodes);
  return [root, ...nodes(root.props?.children)];
}
let tree = render();
nodes(tree).find(node => node.type === 'input' && node.props.type === 'file').props.onChange({ target: { files: [new File(['synthetic'], 'fixture.jpg', { type: 'image/jpeg' })] } });
tree = render();
await nodes(tree).find(node => node.props?.onClick?.name === 'uploadSelectedPhotos').props.onClick();
assert.equal(uploads, 1); assert.equal(attempts, 1);
assert.equal(states[1].length, 1, 'Failed job save retains selected photo');
assert.equal(states[2].length, 1, 'Failed job save retains uploaded reference');
assert.match(states[6], /could not be attached/, 'Failure is not announced as success');
assert.ok(nodes(render()).filter(node => node.type === 'input' && node.props.type === 'file').every(node => node.props.disabled), 'Pending attachment cannot be discarded through another file selection');
failSave = false; tree = render();
await nodes(tree).find(node => node.props?.onClick?.name === 'uploadSelectedPhotos').props.onClick();
assert.equal(uploads, 1, 'Retry reuses uploaded object instead of duplicating it');
assert.equal(attempts, 2); assert.equal(savedPatch.workOrderFiles.length, 1);
assert.equal(states[1].length, 0); assert.equal(states[2].length, 0);
assert.match(states[6], /1 photo uploaded/, 'Success follows a confirmed job save');
console.log('Photo save feedback fixtures passed: failure retains inputs/upload, retry has no duplicate upload, success clears only after job save.');

// Execute real field handlers against unsuccessful responses and network interruption.
const fieldSource = readFileSync('components/FieldAppView.tsx', 'utf8');
const fieldAst = ts.createSourceFile('FieldAppView.tsx', fieldSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const fieldFunction = fieldAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'FieldAppView');
const handlers = fieldFunction.body.statements.filter(node => ts.isFunctionDeclaration(node) && ['startJob', 'saveTravelLeg'].includes(node.name?.text));
const handlerCode = ts.transpileModule(handlers.map(node => node.getText(fieldAst)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020 }
}).outputText;
for (const failure of ['server', 'conflict', 'network']) {
  let notice = '', saving = '', stateWrites = 0;
  const context = {
    employee: { name: 'Fixture Worker' }, user: { employeeName: 'Fixture Worker' }, Date,
    getWorkSession: () => ({ active: false }),
    setFieldSaveError: value => { notice = value; }, setSavingJobId: value => { saving = value; },
    setJobs: () => { stateWrites++; }, jobUpdateBody: (_job, patch) => JSON.stringify(patch),
    authFetch: async () => {
      if (failure === 'network') throw new Error('Synthetic network interruption');
      return new Response(JSON.stringify({ error: 'Synthetic save rejected' }), { status: failure === 'conflict' ? 409 : 500 });
    }
  };
  vm.runInNewContext(handlerCode + '\nthis.startJob = startJob; this.saveTravelLeg = saveTravelLeg;', context);
  await context.startJob({ jobId: 'fixture', status: 'Scheduled' });
  assert.ok(notice); assert.equal(stateWrites, 0); assert.equal(saving, '');
  const result = await context.saveTravelLeg({ jobId: 'fixture' }, { date: '2026-10-04', from: 'A', to: 'B', miles: '0' });
  assert.equal(result, false); assert.ok(notice); assert.equal(stateWrites, 0); assert.equal(saving, '');
}

// Travel form retains zero-mile input when rejected; clears only on confirmed save.
states = []; cursor = 0;
const fieldExports = {};
const fieldModule = ts.transpileModule(fieldSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
}).outputText + '\nexports.StructuredTravelLegs = StructuredTravelLegs;';
vm.runInNewContext(fieldModule, { exports: fieldExports, Date, Map, Set,
  require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    return new Proxy({}, { get: () => () => ({}) });
  }
});
let travelAccepted = false, travelValue;
function travelRender() {
  cursor = 0;
  return fieldExports.StructuredTravelLegs({ job: { travelLegs: [] }, saving: false,
    onSave: async value => { travelValue = value; return travelAccepted; } });
}
let travelTree = travelRender();
for (const [placeholder, value] of [['From / origin', 'Fixture A'], ['To / destination', 'Fixture B'], ['Miles', '0']]) {
  nodes(travelTree).find(node => node.type === 'input' && node.props.placeholder === placeholder).props.onChange({ target: { value } });
  travelTree = travelRender();
}
await nodes(travelTree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
assert.equal(travelValue.miles, '0'); assert.equal(states[0].from, 'Fixture A');
travelAccepted = true; travelTree = travelRender();
await nodes(travelTree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
assert.equal(states[0].from, ''); assert.equal(states[0].miles, '');
console.log('Field save fixtures passed: server/conflict/network failures show feedback, no false state updates, zero-mile travel draft retained until confirmed.');

// Real repository helpers against an in-memory local file; integration metadata must not replay stale job fields.
let localJobs = [];
const jobExports = {};
const jobCode = ts.transpileModule(readFileSync('lib/jobs.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
}).outputText;
vm.runInNewContext(jobCode, { exports: jobExports, crypto, Date, Math, Map, Set,
  process: { cwd: () => '/synthetic-fixture', env: {} },
  require(name) {
    if (name === 'fs') return { promises: {
      readFile: async () => JSON.stringify(localJobs), writeFile: async (_path, value) => { localJobs = JSON.parse(value); }
    } };
    if (name === 'path') return require('node:path');
    if (name === '@supabase/supabase-js') return { createClient() { throw new Error('No live database permitted'); } };
    throw new Error(`Unexpected module ${name}`);
  }
});
const localCreated = await Promise.all([jobExports.createJob({ jobId: '', customerName: 'Fixture A' }), jobExports.createJob({ jobId: '', customerName: 'Fixture B' })]);
assert.notEqual(localCreated[0].jobId, localCreated[1].jobId);
const original = localCreated[0];
const otherId = localCreated[1].jobId;
const otherBefore = JSON.stringify(localJobs.find(job => job.jobId === otherId));
const localSaves = await Promise.allSettled([jobExports.saveJob(original, { completionNotes: 'One' }), jobExports.saveJob(original, { completionNotes: 'Two' })]);
assert.deepEqual(localSaves.map(result => result.status).sort(), ['fulfilled', 'rejected']);
const latest = await jobExports.getJob(original.jobId);
const integrated = await jobExports.saveJobIntegration({ ...original, companyCamProjectId: 'synthetic-project', companyCamProjectUrl: 'https://example.invalid/fixture' });
assert.equal(integrated.completionNotes, latest.completionNotes, 'Delayed integration preserves newer job changes');
assert.equal(JSON.stringify(localJobs.find(job => job.jobId === otherId)), otherBefore, 'Other records are untouched');
await assert.rejects(jobExports.saveJobIntegration({ ...original, companyCamProjectId: 'different-project' }), /changed/);
assert.equal((await jobExports.getJob(original.jobId)).companyCamProjectId, 'synthetic-project');
console.log('Repository helper fixtures passed: local concurrent writes/creates and delayed integration metadata preserve newer and unrelated records.');
