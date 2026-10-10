// Execute production photo component + recovery helper with durable synthetic storage.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
let states = [], cursor = 0, effects = new Map(), effectCursor = 0;
const jsx = (type, props) => ({ type, props });
const react = { useEffect(fn, deps) { const id = effectCursor++; const key = JSON.stringify(deps); if (effects.get(id) !== key) { effects.set(id, key); fn(); } },
useRef(initial) { const index = cursor++; if (!(index in states)) states[index] = { current: initial }; return states[index]; },
useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; } };
const pending = new Map();
let quota = false, uploads = 0, attempts = 0, failSave = true, lostSave = false, actor = 'fixture-worker';
const store = { async list(owner, job) { return [...pending.values()].filter(r => r.ownerId === owner && r.jobId === job).map(r => ({ ...r })); }, async put(r) { pending.set(r.id, { ...r }); }, async putBatch(records) { if (quota) throw new Error('quota failure'); for (const r of records) pending.set(r.id, { ...r }); }, async remove(id) { pending.delete(id); } };
const helper = {};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/client-uploads.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: helper, Blob, Map, Set, localStorage: { getItem: () => null } });
const locks = { request: async (_name, fn) => fn() };
let job = { jobId: 'fixture-job', jobType: 'Setup', scopeNotes: '', revision: 'r1', workOrderFiles: [], activityLog: [] };
const fetcher = async (url, init) => {
 if (url === '/api/auth/me') return Response.json({ user: { id: actor } });
 if (url === '/api/files/upload') { uploads++; assert.equal(init.body.get('expectedUserId'), actor); return Response.json({ id: 'fixture-photo', category: 'Before', fileName: 'fixture.jpg', fileType: 'image/jpeg', dataUrl: '/api/files/view?path=fixture', storagePath: 'fixture' }, { status: 201 }); }
 if (!init) return Response.json(job);
 attempts++; const patch = JSON.parse(init.body); assert.equal(patch.expectedUserId, actor); assert.equal(patch.expectedRevision, job.revision);
 if (failSave) return Response.json({ error: 'conflict' }, { status: 409 });
 job = { ...job, ...patch, revision: 'r2' };
 if (lostSave) { lostSave = false; throw new Error('lost job response'); }
 return Response.json(job);
};
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('components/JobDetail.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText + '\nexports.PhotoUploadPanel = PhotoUploadPanel;', {
 exports, console, FormData, File, Date, Math, Map, Set, crypto, navigator: { locks },
 require(name) { if (name === 'react') return react; if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }; if (name === './AuthGate') return { useAuthUser: () => ({ id: actor }) }; if (name === '@/lib/client-uploads') return { ...helper, browserUploadStore: store }; if (name === '@/lib/client-auth') return { authFetch: fetcher }; return new Proxy({}, { get: () => () => ({}) }); }
});
function nodes(root) { if (!root || typeof root !== 'object') return []; if (Array.isArray(root)) return root.flatMap(nodes); return [root, ...nodes(root.props?.children)]; }
async function renderPhoto() { cursor = 0; effectCursor = 0; exports.PhotoUploadPanel({ job, saving: false, onSave: async () => undefined, onSynced: value => { job = value; } }); await Promise.resolve(); cursor = 0; effectCursor = 0; return exports.PhotoUploadPanel({ job, saving: false, onSave: async () => undefined, onSynced: value => { job = value; } }); }
function remount() { states = []; effects = new Map(); }
const photo = new File(['synthetic'], 'fixture.jpg', { type: 'image/jpeg' });
let tree = await renderPhoto();
nodes(tree).find(n => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { files: [photo, photo] } });
tree = await renderPhoto(); await nodes(tree).find(n => n.props?.onClick?.name === 'uploadSelectedPhotos').props.onClick();
assert.equal(pending.size, 2); assert.equal(uploads, 2); assert.equal(attempts, 1);
assert.ok([...pending.values()].every(r => r.acknowledged && r.file.size === photo.size));
remount(); tree = await renderPhoto(); assert.match(JSON.stringify(tree), /Retry saved photos/);
failSave = false; await nodes(tree).find(n => n.props?.onClick?.name === 'uploadSelectedPhotos').props.onClick();
assert.equal(uploads, 2, 'Reload retry reuses confirmed objects'); assert.equal(job.workOrderFiles.length, 1); assert.equal(pending.size, 0);
// Lost job response: fresh job read confirms attachment without a second write.
job.workOrderFiles = []; remount(); tree = await renderPhoto(); nodes(tree).find(n => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { files: [photo] } }); tree = await renderPhoto(); lostSave = true;
await nodes(tree).find(n => n.props?.onClick?.name === 'uploadSelectedPhotos').props.onClick(); assert.equal(pending.size, 1); const before = attempts;
remount(); tree = await renderPhoto(); await nodes(tree).find(n => n.props?.onClick?.name === 'uploadSelectedPhotos').props.onClick(); assert.equal(attempts, before); assert.equal(pending.size, 0);
// Quota failure occurs before any upload and retains selected files.
remount(); tree = await renderPhoto(); nodes(tree).find(n => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { files: [photo] } }); tree = await renderPhoto(); quota = true; const priorUploads = uploads;
await nodes(tree).find(n => n.props?.onClick?.name === 'uploadSelectedPhotos').props.onClick(); assert.equal(uploads, priorUploads); assert.equal(states[1].length, 1); quota = false;
await assert.rejects(helper.attachPendingUploads(store, undefined, fetcher, actor, job.jobId, () => assert.fail()), /coordinate/);
await assert.rejects(helper.attachPendingUploads(store, locks, fetcher, 'other-account', job.jobId, () => assert.fail()), /account/);
console.log('Actual photo recovery fixtures PASS: durable synthetic remount, stable-ID dedupe, conflict retention, lost job response, quota-before-upload, account guard and unavailable locks.');
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

// Execute the actual closeout component with real readiness helpers.
const closeoutModules = new Map();
function closeoutModule(name) {
  const key = name.replace(/^@\/lib\//, '').replace(/^\.\//, '');
  if (closeoutModules.has(key)) return closeoutModules.get(key);
  const result = {};
  closeoutModules.set(key, result);
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${key}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, { exports: result, Date, Math, Map, Set, require: closeoutModule });
  return result;
}
const completeExports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('components/JobDetail.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
}).outputText + '\nexports.CompleteJobFlow = CompleteJobFlow;', {
  exports: completeExports, Date, Math, Map, Set,
  fetch: async () => Response.json({ requireAfterPhotosToComplete: true }),
  require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (['@/lib/types', '@/lib/job-readiness', '@/lib/receipt-backup', '@/lib/field-activity', '@/lib/factory-costs'].includes(name)) return closeoutModule(name);
    return new Proxy({}, { get: () => () => ({}) });
  }
});
const readyJob = {
  jobId: 'synthetic-closeout', status: 'In Progress', invoiceStatus: 'Not Started',
  completionNotes: 'Synthetic work complete', paperworkPickedUp: true,
  paperworkItems: [{ label: 'Work order', status: 'Collected' }],
  checklist: [{ label: 'Customer/source notified', complete: false }],
  timeEntries: [{ type: 'Work started' }], afterPhotos: ['synthetic-after'],
  activityLog: [{ type: 'Note', message: 'No customer contacted. No text sent.' }],
};
for (const canManageJob of [false, true]) {
  for (const action of ['sendForManagerReview', ...(canManageJob ? ['completeJob'] : [])]) {
    remount(); let saved;
    function closeoutRender(candidate = readyJob) {
      cursor = 0; effectCursor = 0;
      return completeExports.CompleteJobFlow({ job: candidate, saving: false, canManageJob,
        onFinishWork() {}, onSave: async patch => { saved = patch; return { ...candidate, ...patch }; } });
    }
    let completeTree = closeoutRender();
    let button = nodes(completeTree).find(node => node.type === 'button' && node.props.onClick?.name === action);
    assert.equal(button.props.disabled, true, 'Unchecked notification remains blocked');
    await button.props.onClick(); assert.equal(saved, undefined, 'Unchecked action cannot fabricate notification');
    nodes(completeTree).find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
    completeTree = closeoutRender();
    button = nodes(completeTree).find(node => node.type === 'button' && node.props.onClick?.name === action);
    assert.equal(button.props.disabled, false, 'Explicit notification checkbox enables otherwise ready job');
    await button.props.onClick();
    assert.equal(saved.status, action === 'completeJob' ? 'Complete' : 'Needs Inspection');
    assert.ok(saved.activityLog.some(entry => entry.type === 'Source' && entry.message === 'Customer/source notification confirmed.'));
    const notification = closeoutModule('@/lib/job-readiness').closeoutChecks({ ...readyJob, ...saved }).find(check => check.label === 'Customer/source notified');
    assert.equal(notification.ok, true, 'Saved notification survives shared readiness evaluation');
    saved = undefined;
    completeTree = closeoutRender({ ...readyJob, paperworkPickedUp: false, paperworkItems: [] });
    button = nodes(completeTree).find(node => node.type === 'button' && node.props.onClick?.name === action);
    assert.equal(button.props.disabled, true, 'Notification does not bypass missing paperwork');
    await button.props.onClick(); assert.equal(saved, undefined);
  }
}
console.log('Actual closeout component PASS: explicit checkbox enables and persists notification for employee/manager review and manager completion; unchecked and other blockers stay blocked.');

// Finish Work passes its editable note and saves it atomically with departure.
const finishJob = { ...readyJob, completionNotes: 'Existing saved notes',
  timeEntries: [{ type: 'Work started', createdAt: '2026-10-10T10:00:00.000Z' }] };
remount(); let finishAccepted = false, finishDraft, finishCalls = 0;
function finishRender() {
  cursor = 0; effectCursor = 0;
  return completeExports.CompleteJobFlow({ job: finishJob, saving: false, canManageJob: false,
    onSave: async () => undefined,
    onFinishWork: async value => { finishCalls++; finishDraft = value; return finishAccepted ? finishJob : undefined; } });
}
let finishTree = finishRender();
nodes(finishTree).find(node => node.type === 'textarea').props.onChange({ target: { value: 'New editable completion draft' } });
finishTree = finishRender();
function finishButton(tree) { return nodes(tree).find(node => node.type === 'button' && node.props.children === 'Finish Work'); }
assert.equal(finishButton(finishTree).props.disabled, false);
await finishButton(finishTree).props.onClick();
assert.equal(finishDraft, 'New editable completion draft');
finishTree = finishRender();
assert.equal(nodes(finishTree).find(node => node.type === 'textarea').props.value, finishDraft, 'Failed save keeps editable draft');
assert.equal(finishButton(finishTree).props.disabled, false, 'Failed save leaves session retry available');
finishAccepted = true; await finishButton(finishTree).props.onClick(); assert.equal(finishCalls, 2);
const detailSource = readFileSync('components/JobDetail.tsx', 'utf8');
const detailAst = ts.createSourceFile('JobDetail.tsx', detailSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const detailFunction = detailAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'JobDetail');
const finishHandlers = detailFunction.body.statements.filter(node => ts.isFunctionDeclaration(node) && ['saveJobPatch', 'finishWorkSession'].includes(node.name?.text));
const finishCode = ts.transpileModule(finishHandlers.map(node => node.getText(detailAst)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
for (const mode of ['success', 'server', 'conflict', 'network', 'blank']) {
  let current = structuredClone(finishJob), payload, note = '', resolveRequest;
  const context = { job: structuredClone(finishJob), user: { employeeName: 'Synthetic worker' }, Date,
    getWorkSession: closeoutModule('@/lib/field-activity').getWorkSession,
    correctionResolutionPatch: () => ({}), setSaving() {}, setDetailMessage(value) { note = value; },
    setJob(value) { current = typeof value === 'function' ? value(current) : value; },
    jobUpdateBody: (_job, patch) => JSON.stringify(patch),
    authFetch: async (_url, init) => {
      if (!init) return Response.json(finishJob);
      payload = JSON.parse(init.body);
      await new Promise(resolve => { resolveRequest = resolve; });
      if (mode === 'network') throw new Error('Synthetic network failure');
      return Response.json(mode === 'success' || mode === 'blank' ? { ...finishJob, ...payload } : { error: 'Synthetic rejected save' }, { status: mode === 'server' ? 500 : mode === 'conflict' ? 409 : 200 });
    }
  };
  vm.runInNewContext(finishCode + '\nthis.finishWorkSession = finishWorkSession;', context);
  const pendingFinish = context.finishWorkSession(mode === 'blank' ? '   ' : finishDraft);
  assert.equal(current.timeEntries.length, 1, 'No premature closed session before save confirmation');
  assert.equal(payload.timeEntries[0].type, 'Departed');
  assert.equal(payload.activityLog[0].message, 'Finished Work');
  for (const forbidden of ['status', 'invoiceStatus', 'checklist']) assert.equal(Object.hasOwn(payload, forbidden), false);
  assert.equal(payload.activityLog.some(entry => entry.type === 'Source' || entry.type === 'Customer'), false, 'Finish Work does not assert notification');
  if (mode === 'blank') assert.equal(Object.hasOwn(payload, 'completionNotes'), false, 'Blank draft preserves saved notes');
  else assert.equal(payload.completionNotes, finishDraft);
  resolveRequest(); await pendingFinish;
  if (mode === 'success') { assert.equal(current.completionNotes, finishDraft); assert.equal(current.timeEntries[0].type, 'Departed'); }
  else if (mode === 'blank') assert.equal(current.completionNotes, finishJob.completionNotes);
  else { assert.ok(note); assert.equal(current.timeEntries.length, 1, 'Rejected finish keeps active session'); }
}
console.log('Actual Finish Work PASS: note callback/retry, atomic note+departure save, no premature closure, server/conflict/network failures, blank-note preservation and unchanged status/invoice/notification.');
