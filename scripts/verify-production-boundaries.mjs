// Exercise the built application against loopback fixtures, never real accounts/data.
import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { emptyJob, defaultFactoryCost } = require('../node_modules/.cache/rts-auth-boundaries-check/lib/types.js');
const users = Object.fromEntries(['Admin', 'Manager', 'Employee'].map(role => [role.toLowerCase(), { id: role.toLowerCase(), email: `${role.toLowerCase()}@example.invalid`, user_metadata: { role: 'Admin', employeeId: 'other' }, app_metadata: { rtsRole: role, rtsEmployeeId: 'own', rtsEmployeeName: 'Worker', rtsAccessActive: true } }]));
users.disabled = { ...users.employee, id: 'disabled', app_metadata: { ...users.employee.app_metadata, rtsAccessActive: false } };
const roster = [{ id: 'own', name: 'Worker', active: true }, { id: 'other', name: 'Other', active: true }];
const privateNote = { id: 'private', audience: 'Manager', type: 'Note', message: 'Private fixture', createdBy: 'Manager', createdAt: '2026-10-01' };
let jobs = ['own-job', 'other-job'].map((jobId, index) => ({ ...emptyJob, jobId, assignedCrew: index ? 'Other' : 'Worker', assignedEmployeeIds: [index ? 'other' : 'own'], customerName: 'Fixture', activityLog: [privateNote], factoryCost: { ...defaultFactoryCost(), workRate: '50' } }));
let writes = 0;
let readGate = null;
let waitingReads = [];
const mock = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture');
  const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (url.pathname === '/auth/v1/user') return send(users[req.headers.authorization?.replace(/^Bearer /, '')] || { message: 'Not authenticated' }, users[req.headers.authorization?.replace(/^Bearer /, '')] ? 200 : 401);
  if (url.pathname === '/auth/v1/admin/users' && req.method === 'GET') return send({ users: Object.values(users), aud: 'authenticated', total: Object.keys(users).length });
  const readBody = async () => { let body = ''; for await (const chunk of req) body += chunk; return JSON.parse(body); };
  if (url.pathname === '/auth/v1/token') {
    const input = await readBody(); const user = Object.values(users).find(u => u.email === input.email);
    if (!user) return send({ message: 'Unknown fixture identity' }, 401);
    return send({ user, access_token: user.id, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600 });
  }
  if (url.pathname === '/auth/v1/admin/users' && req.method === 'POST') {
    const input = await readBody();
    users['new-worker'] = { id: '00000000-0000-4000-8000-000000000001', email: input.email, app_metadata: input.app_metadata, user_metadata: {} };
    writes++; return send(users['new-worker']);
  }
  if (url.pathname.startsWith('/auth/v1/admin/users/')) {
    const user = Object.values(users).find(u => u.id === url.pathname.split('/').at(-1));
    if (!user) return send({ message: 'Not found' }, 404);
    if (req.method === 'PUT') { const input = await readBody(); user.app_metadata = { ...user.app_metadata, ...input.app_metadata }; if (input.ban_duration) user.banned_until = input.ban_duration === 'none' ? undefined : '2999-01-01T00:00:00Z'; writes++; }
    return send(user);
  }
  if (url.pathname === '/rest/v1/employees') return send(roster);
  if (url.pathname === '/rest/v1/business_settings') return send([{ data: { calendarFeedToken: 'fixture-calendar', factoryCostDefaults: { ...defaultFactoryCost(), workRate: '50' } } }]);
  if (url.pathname === '/rest/v1/jobs' && req.method === 'GET') {
    const id = url.searchParams.get('job_id');
    const rows = jobs.filter(j => !id?.startsWith('eq.') || j.jobId === id.slice(3)).map(j => ({ job_id: j.jobId, data: j }));
    if (readGate === (id?.slice(3) || 'all')) {
      waitingReads.push(() => send(rows));
      if (waitingReads.length === 2) { readGate = null; const ready = waitingReads; waitingReads = []; ready.forEach(reply => reply()); }
      return;
    }
    return send(rows);
  }
  if (url.pathname === '/rest/v1/jobs' && req.method === 'POST') {
    const row = await readBody();
    if (jobs.some(job => job.jobId === row.job_id)) return send({ code: '23505', message: 'Duplicate fixture job' }, 409);
    jobs.push(row.data); writes++; return send(null, 201);
  }
  if (url.pathname === '/rest/v1/jobs' && req.method === 'PATCH') {
    const row = await readBody();
    const index = jobs.findIndex(job => job.jobId === url.searchParams.get('job_id')?.slice(3));
    const guard = url.searchParams.get('data->>revision');
    if (index < 0 || (guard === 'is.null' ? Boolean(jobs[index].revision) : guard !== `eq.${jobs[index].revision}`)) return send(null);
    jobs[index] = row.data; writes++; return send({ data: row.data });
  }
  if (url.pathname.startsWith('/storage/v1/')) {
    if (req.method !== 'GET') writes++;
    if (url.pathname.startsWith('/storage/v1/object/sign/')) return send({ signedURL: '/object/sign/job-files/fixture' });
    return send({ id: 'job-files', name: 'job-files', public: false, Key: 'fixture' });
  }
  if (req.method !== 'GET') writes++;
  return send({ message: 'Unimplemented fixture' }, 404);
});
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => server.close(resolve));
await listen(mock);
const fixtureUrl = `http://127.0.0.1:${mock.address().port}`;
let child;
async function start(configured = true) {
  const reservation = createServer(); await listen(reservation); const port = reservation.address().port; await close(reservation);
  const env = { PATH: process.env.PATH, NODE_ENV: 'production', AUTH_SETUP_CODE: 'fixture-code', ADMIN_EMAILS: 'admin@example.invalid', ...(configured ? { NEXT_PUBLIC_SUPABASE_URL: fixtureUrl, SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-key' } : {}) };
  child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.resume(); child.stderr.resume();
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error('Fixture application exited');
    try { await fetch(base + '/login'); return base; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  throw new Error('Fixture application did not become ready');
}
async function stop() {
  if (child && child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exited; }
}
try {
  let base = await start();
  if (process.argv.includes('--serve')) {
    console.log(`Local fixture UI: ${base}`);
    await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
    process.exitCode = 0;
  } else {
  const request = (path, user, init = {}) => {
    if (init.method === 'PUT' && path.startsWith('/api/jobs/')) {
      const body = JSON.parse(init.body);
      if (!Object.hasOwn(body, 'expectedRevision')) body.expectedRevision = jobs.find(job => job.jobId === path.split('/').at(-1))?.revision || null;
      init = { ...init, body: JSON.stringify(body) };
    }
    return fetch(base + path, { ...init, redirect: 'manual', headers: { ...(user ? { Cookie: `cc-access-token=${user}` } : {}), ...init.headers } });
  };
  const json = value => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  for (const user of [undefined, 'disabled']) {
    for (const path of ['/api/employees', '/api/jobs', '/api/jobs/own-job', '/api/admin/users', '/api/files/view?path=own-job/before/a.jpg']) assert.equal((await request(path, user)).status, 401, `${user || 'anonymous'} ${path}`);
  }
  for (const user of ['admin', 'manager', 'employee']) assert.equal((await request('/api/employees', user)).status, 200, `Roster ${user}`);
  for (const user of ['employee', 'manager']) {
    assert.equal((await request('/api/admin/users', user)).status, 403);
    assert.equal((await request('/api/admin/users', user, json({ role: 'Admin' }))).status, 403);
  }
  assert.equal((await request('/api/admin/users', 'admin')).status, 200);
  assert.equal((await request('/settings', 'admin')).status, 200);
  assert.equal((await request('/employees', 'manager')).status, 200);
  for (const path of ['/', '/jobs', '/command', '/schedule', '/dispatch', '/employees', '/customers', '/documents', '/communication', '/tasks', '/reminders', '/billing', '/reports', '/settings', '/account', '/jobs/new', '/import']) {
    const page = await request(path, 'admin'); const html = await page.text();
    assert.equal(page.status, 200, `Admin page ${path}`);
    assert.ok(!html.includes('NEXT_REDIRECT') && !html.includes('NEXT_HTTP_ERROR_FALLBACK;500'), `Admin page renders ${path}`);
  }
  const restrictedPage = await request('/settings', 'employee');
  const restrictedHtml = await restrictedPage.text();
  assert.ok(restrictedPage.headers.get('location') === '/field' || (restrictedHtml.includes('NEXT_REDIRECT') && restrictedHtml.includes('/field')), 'Server must redirect Employee away from Admin settings, including streamed Next redirects');
  assert.equal((await request('/api/jobs/other-job', 'employee')).status, 403);
  assert.equal((await request('/api/files/view?path=other-job/after/fixture.jpg', 'employee')).status, 403);
  assert.equal((await request('/api/jobs/own-job', 'employee', json({ status: 'Paid' }))).status, 403);
  const visible = await (await request('/api/jobs', 'employee')).json();
  assert.deepEqual(visible.map(j => j.jobId), ['own-job']);
  assert.equal(visible[0].factoryCost.workRate, ''); assert.deepEqual(visible[0].activityLog, []);
  assert.equal((await (await request('/api/jobs/own-job', 'manager')).json()).factoryCost.workRate, '50');
  const before = writes;
  const form = new FormData(); form.set('file', new Blob(['fixture']), 'fixture.txt'); form.set('jobId', 'other-job');
  assert.equal((await request('/api/files/upload', 'employee', { method: 'POST', body: form })).status, 403); assert.equal(writes, before);
  assert.equal((await request('/api/auth/bootstrap-admin', undefined, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.invalid', password: 'fixture-only-password', setupCode: 'fixture-code' }) })).status, 409);
  assert.equal(writes, before, 'Bootstrap must not reset an existing Admin');
  const saved = await request('/api/jobs/own-job', 'employee', json({ factoryCost: { workHours: '8', workRate: '999' }, activityLog: [] }));
  assert.equal(saved.status, 200); assert.equal((await saved.json()).factoryCost.workRate, '');
  assert.equal(jobs[0].factoryCost.workRate, '50'); assert.equal(jobs[0].factoryCost.workHours, '8'); assert.deepEqual(jobs[0].activityLog, [privateNote]);
  // Complete the supported job lifecycle using only in-memory fixture records.
  const patchJob = (actor, value) => request('/api/jobs/own-job', actor, json(value));
  assert.equal((await patchJob('manager', { status: 'Scheduled', dueDate: '2026-10-04' })).status, 200);
  assert.equal((await patchJob('employee', { partsItems: [{ id: 'fixture-part', name: 'Optional trim', quantity: '1', status: 'Needed', requestedBy: 'Worker', requestedAt: '2026-10-04' }], partsNeeded: 'Optional trim' })).status, 200);
  assert.equal(jobs[0].status, 'Scheduled', 'Requesting parts must not change job status');
  assert.equal((await patchJob('employee', { partsItems: [{ ...jobs[0].partsItems[0], status: 'Ordered' }] })).status, 200);
  assert.equal(jobs[0].status, 'Scheduled', 'Updating parts must not change job status');
  assert.equal((await patchJob('employee', { status: 'In Progress' })).status, 200);
  assert.equal((await patchJob('employee', { travelLegs: [{ id: 'fixture-travel', date: '2026-10-04', from: 'Office', to: 'Fixture site', miles: '12' }] })).status, 200);
  assert.equal(jobs[0].travelLegs[0].employeeName, 'Worker');
  const ownUpload = new FormData(); ownUpload.set('file', new Blob(['fixture photo'], { type: 'image/jpeg' }), 'fixture.jpg'); ownUpload.set('jobId', 'own-job'); ownUpload.set('category', 'After');
  const uploaded = await request('/api/files/upload', 'employee', { method: 'POST', body: ownUpload }); assert.equal(uploaded.status, 201); const attachment = await uploaded.json();
  const fileView = await request(attachment.dataUrl, 'employee'); assert.equal(fileView.status, 307); assert.ok(fileView.headers.get('location').startsWith(fixtureUrl), 'Assigned file opens through fixture storage only');
  assert.equal((await patchJob('employee', { afterPhotos: [attachment.dataUrl], workOrderFiles: [attachment], completionNotes: 'Fixture field work complete', checklist: [{ id: 'complete', label: 'Work completed', complete: true }] })).status, 200);
  const handoff = { id: 'handoff', type: 'Status', audience: 'Manager', message: 'Ready for review', createdBy: 'Forged', createdAt: '2026-10-04' };
  assert.equal((await patchJob('employee', { status: 'Needs Inspection', activityLog: [handoff] })).status, 200);
  assert.equal(jobs[0].activityLog[0].createdBy, 'Worker'); assert.equal(jobs[0].activityLog[0].audience, 'Manager');
  assert.equal((await patchJob('manager', { status: 'In Progress', completionNotes: 'Correction requested' })).status, 200);
  assert.equal((await patchJob('employee', { status: 'Needs Inspection', completionNotes: 'Correction complete' })).status, 200);
  assert.equal((await patchJob('manager', { status: 'Complete', invoiceStatus: 'Ready' })).status, 200);
  assert.equal((await patchJob('manager', { status: 'Billed', invoiceStatus: 'Sent' })).status, 200);
  assert.equal((await patchJob('manager', { status: 'Paid', invoiceStatus: 'Paid' })).status, 200);
  assert.equal(jobs[0].factoryCost.workRate, '50'); assert.ok(jobs[0].activityLog.some(e => e.id === 'private'));
  const createJobInput = { jobId: 'created-job', customerName: 'Fixture intake', phone: '555-0100', serviceAddress: 'Fixture site', assignedCrew: 'Worker', assignedEmployeeIds: ['own'], dueDate: '2026-10-05', status: 'Scheduled', syncToCompanyCam: false };
  const createJob = () => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createJobInput) });
  assert.equal((await request('/api/jobs', 'employee', createJob())).status, 403);
  assert.equal((await request('/api/jobs', 'manager', createJob())).status, 201);
  assert.equal((await request('/api/jobs/created-job', 'employee')).status, 200, 'Newly assigned job is visible');
  // Exercise Auth management through the real routes, with a fake Admin API.
  const created = await request('/api/admin/users', 'admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'fixture-worker@example.invalid', password: 'fixture-only-password', role: 'Employee', employeeId: 'other' }) });
  assert.equal(created.status, 201); assert.equal((await created.json()).employeeName, 'Other');
  assert.equal(users['new-worker'].app_metadata.rtsRole, 'Employee');
  const historyBeforeDisable = JSON.stringify(jobs);
  assert.equal((await request('/api/admin/users', 'admin', json({ userId: users['new-worker'].id, role: 'Employee', employeeId: 'other', accessActive: false }))).status, 200);
  assert.equal((await request('/api/employees', 'new-worker')).status, 401);
  assert.equal((await request('/api/admin/users', 'admin', json({ userId: users['new-worker'].id, role: 'Employee', employeeId: 'other', accessActive: true }))).status, 200);
  assert.equal((await request('/api/employees', 'new-worker')).status, 200);
  assert.equal(users['new-worker'].app_metadata.rtsEmployeeId, 'other'); assert.equal(JSON.stringify(jobs), historyBeforeDisable);
  // GET on an empty hosted database must neither seed mocks nor write records.
  jobs = []; const afterSave = writes; assert.deepEqual(await (await request('/api/jobs', 'admin')).json(), []); assert.equal(writes, afterSave);
  const firstJob = await request('/api/jobs', 'admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName: 'First fixture job', syncToCompanyCam: false }) });
  assert.equal(firstJob.status, 201); assert.equal((await firstJob.json()).jobId, 'RTS-1', 'First real job must have a finite identifier');
  // Both requests carry the same browser revision. Exactly one may commit.
  const first = jobs.find(job => job.jobId === 'RTS-1');
  readGate = 'RTS-1';
  const concurrent = await Promise.all(['one', 'two'].map(completionNotes => request('/api/jobs/RTS-1', 'manager', json({ completionNotes, expectedRevision: first.revision }))));
  assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 409]);
  const kept = JSON.stringify(jobs.find(job => job.jobId === 'RTS-1'));
  const duplicate = await request('/api/jobs', 'manager', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: 'RTS-1', customerName: 'Must not overwrite' }) });
  assert.equal(duplicate.status, 409); assert.equal(JSON.stringify(jobs.find(job => job.jobId === 'RTS-1')), kept);
  readGate = 'all';
  const concurrentCreates = await Promise.all(['A', 'B'].map(customerName => request('/api/jobs', 'manager', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName }) })));
  assert.deepEqual(concurrentCreates.map(response => response.status), [201, 201]);
  const createdJobs = await Promise.all(concurrentCreates.map(response => response.json()));
  assert.notEqual(createdJobs[0].jobId, createdJobs[1].jobId);
  assert.equal(JSON.stringify(jobs.find(job => job.jobId === 'RTS-1')), kept, 'Creating other jobs preserves existing rows');
  const missingVersion = await request('/api/jobs/RTS-1', 'manager', json({ completionNotes: 'Old client', expectedRevision: null }));
  assert.equal(missingVersion.status, 409); assert.equal(JSON.stringify(jobs.find(job => job.jobId === 'RTS-1')), kept);
  await stop(); base = await start(false);
  for (const path of ['/api/employees', '/api/jobs', '/api/jobs/own-job', '/api/admin/users']) assert.equal((await request(path)).status, 503, `Unconfigured ${path}`);
  for (const path of ['/settings', '/reports', '/schedule']) {
    const res = await request(path); const html = await res.text();
    assert.ok(res.headers.get('location') === '/login' || (html.includes('NEXT_REDIRECT') && html.includes('/login')), `Unconfigured page ${path} must redirect to login`);
  }
  console.log('Production route fixtures passed: roles, assignment reads/uploads, private history/rates, job lifecycle, onboarding, disable/reactivation, bootstrap lock, empty database, missing configuration, forced same-snapshot concurrent saves/creates, stale versions and duplicate IDs.');
  }
} finally { await stop(); await close(mock); }
