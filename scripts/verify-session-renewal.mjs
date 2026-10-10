import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
let calls = [], accessError = { status: 401 }, refreshError = null;
let active = true;
const user = () => ({ id: 'worker', user_metadata: { role: 'Admin' }, app_metadata: { rtsAccessActive: active, rtsRole: 'Employee', rtsEmployeeId: 'own' } });
const authExports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/auth.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: authExports, require(name) { return name === '@supabase/supabase-js' ? {} : {}; }, Date, process });
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('middleware.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require(name) { if (name === 'next/server') return { NextRequest, NextResponse }; if (name === './lib/auth') return { hasTrustedAccess: authExports.hasTrustedAccess, authClient: () => ({ auth: { async getUser() { calls.push('getUser'); return { data: { user: user() }, error: accessError }; }, async refreshSession() { calls.push('refresh'); return { data: { user: user(), session: refreshError ? null : { access_token: 'renewed-access', refresh_token: 'rotated-refresh', expires_in: 3600 } }, error: refreshError }; } } }) }; throw new Error(name); } });
const request = (path = '/jobs/RTS-3', headers = {}) => new NextRequest(`https://fixture.invalid${path}`, { headers: { cookie: 'cc-access-token=expired; cc-refresh-token=fixture-refresh; unrelated=preserved', ...headers } });
const run = async (req = request()) => { calls = []; return exports.middleware(req); };
accessError = null;
let response = await run(); assert.deepEqual(calls, ['getUser']); assert.equal(response.cookies.getAll().length, 0);
accessError = { status: 401 };
for (const path of ['/jobs/RTS-3', '/api/jobs/RTS-3']) {
 response = await run(request(path)); assert.deepEqual(calls, ['getUser', 'refresh']);
 const forwarded = response.headers.get('x-middleware-request-cookie');
 assert.match(forwarded, /cc-access-token=renewed-access/); assert.match(forwarded, /cc-refresh-token=rotated-refresh/); assert.match(forwarded, /unrelated=preserved/);
 assert.equal(response.cookies.get('cc-access-token').value, 'renewed-access');
 for (const cookie of response.cookies.getAll()) { assert.equal(cookie.secure, true); assert.equal(cookie.httpOnly, true); assert.equal(cookie.sameSite, 'lax'); assert.equal(cookie.path, '/'); }
 assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
}
response = await run(new NextRequest('https://fixture.invalid/field', { headers: { cookie: 'cc-refresh-token=fixture-refresh' } })); assert.deepEqual(calls, ['refresh']);
for (const path of ['/api/auth/login', '/api/auth/logout']) { await run(request(path)); assert.equal(calls.length, 0); }
await run(request('/api/jobs', { authorization: 'Bearer invalid' })); assert.equal(calls.length, 0);
accessError = { status: 400, code: 'bad_jwt' }; await run(); assert.deepEqual(calls, ['getUser', 'refresh']);
accessError = { status: 503 }; response = await run(); assert.deepEqual(calls, ['getUser']); assert.equal(response.cookies.getAll().length, 0);
accessError = { status: 401 }; refreshError = { status: 503 }; response = await run(); assert.equal(response.cookies.getAll().length, 0);
refreshError = { status: 400 }; response = await run(); assert.ok(response.cookies.getAll().every(cookie => cookie.maxAge === 0)); assert.doesNotMatch(response.headers.get('x-middleware-request-cookie'), /cc-access-token|cc-refresh-token/);
refreshError = null; active = false; response = await run(); assert.ok(response.cookies.getAll().every(cookie => cookie.maxAge === 0));
active = true; const overlapping = await Promise.all([exports.middleware(request()), exports.middleware(request('/api/jobs'))]); assert.ok(overlapping.every(item => item.cookies.get('cc-access-token').value === 'renewed-access'));
assert.equal(authExports.getUserRole(user()), 'Employee'); assert.equal(authExports.canEmployeeAccessJob(user(), { assignedEmployeeIds: ['other'] }), false); assert.equal(authExports.canEmployeeAccessJob(user(), { assignedEmployeeIds: ['own'] }), true);
const logout = {};
vm.runInNewContext(ts.transpileModule(readFileSync('app/api/auth/logout/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: logout, require: () => ({ NextResponse }) });
assert.ok((await logout.POST()).cookies.getAll().every(cookie => cookie.maxAge === 0));
console.log('Session renewal fixtures PASS: pages/API forwarded cookies, valid/expired/revoked/inactive, bearer/login/logout bypass, outage retention, secure cookie rotation, trusted employee boundaries and mocked overlap. Hosted rotation remains unverified.');
