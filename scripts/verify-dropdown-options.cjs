const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const filename = path.resolve(relative);
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
  return loaded.exports;
}
let stored, role = 'Admin', writes = 0;
const db = { from() { return {
  select() { return this; }, eq() { return this; },
  async maybeSingle() { return { data: stored ? { data: stored } : null, error: null }; },
  async upsert(row) { writes++; stored = row.data; return { error: null }; }
}; } };
const types = load('lib/types.ts');
const dropdown = load('lib/dropdown-options.ts', { './types': types });
const settings = load('lib/settings.ts', { './dropdown-options': dropdown, './types': types, '@supabase/supabase-js': { createClient: () => db }, fs: { promises: { readFile: async () => '{}' } } });
const route = load('app/api/dropdown-options/route.ts', {
  '@/lib/auth': { requireRole: async (_request, allowed) => allowed.includes(role) ? { ok: true, role } : { ok: false, error: 'Forbidden', status: 403 } },
  '@/lib/settings': settings,
  '@/lib/dropdown-options': dropdown,
});
const req = (key, option) => new Request('https://example.test/api/dropdown-options', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, option }) });
(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-only-key';
  const seed = { jobType: [{ label: 'Existing', value: 'Existing' }] };
  const appended = dropdown.appendDropdownOption(seed, 'jobType', { label: 'Repair', value: 'Repair' });
  assert.equal(seed.jobType.length, 1, 'Append must not mutate previous registry');
  assert.equal(appended.jobType.length, 2);
  assert.equal(dropdown.appendDropdownOption(appended, 'jobType', { label: 'repair', value: 'Repair' }), appended, 'Case-insensitive duplicates reuse stored choice');
  assert.throws(() => dropdown.appendDropdownOption({ userRole: [{ label: 'Lead', value: 'Manager' }] }, 'userRole', { label: 'Lead', value: 'Admin' }));
  assert.throws(() => dropdown.appendDropdownOption({ jobType: Array.from({ length: 100 }, (_, i) => ({ label: String(i), value: String(i) })) }, 'jobType', { label: 'Overflow', value: 'Overflow' }));
  const initialSettings = await settings.getBusinessSettings();
  stored = { ...initialSettings, companyName: 'Protected Company', employeeCanUploadFiles: false, factoryCostDefaults: { ...initialSettings.factoryCostDefaults, hourlyRate: '44' }, dropdownOptions: seed };
  const protectedSettings = structuredClone(stored);
  for (const allowedRole of ['Admin', 'Manager']) {
    role = allowedRole;
    assert.equal((await route.GET(new Request('https://example.test/api/dropdown-options'))).status, 200);
    assert.equal((await route.POST(req('jobType', { label: allowedRole + ' repair', value: allowedRole + ' repair' }))).status, 200);
  }
  assert.equal(stored.dropdownOptions.jobType.length, 3);
  for (const [key, value] of Object.entries(protectedSettings)) if (key !== 'dropdownOptions') assert.deepEqual(stored[key], value, 'Dropdown append must preserve setting ' + key);
  role = 'Admin';
  assert.equal((await route.POST(req('userRole', { label: 'Lead', value: 'Manager' }))).status, 200);
  assert.equal(stored.dropdownOptions.userRole[0].value, 'Manager');
  assert.equal((await route.POST(req('customerSatisfied', { label: 'Satisfied', value: 'yes' }))).status, 200);
  assert.equal(stored.dropdownOptions.customerSatisfied[0].value, 'yes');
  const before = writes;
  for (const [key, option] of [
    ['userRole', { label: 'Root', value: 'SuperAdmin' }],
    ['customerSatisfied', { label: 'Maybe', value: 'maybe' }],
    ['jobStatus', { label: 'Invented', value: 'Invented' }],
    ['jobType', { label: 'Valid', value: '__rts_add_new__' }],
    ['jobType', { label: 'Different', value: 'Meaning' }],
    ['employee', { label: 'Unauthorized record', value: 'Unauthorized record' }],
    ['unknown', { label: 'Unknown', value: 'Unknown' }],
    ['__proto__', { label: 'Prototype', value: 'Prototype' }],
  ]) assert.equal((await route.POST(req(key, option))).status, 400, key + ' must reject invalid input');
  assert.equal((await route.POST(new Request('https://example.test/api/dropdown-options', { method: 'POST', body: '{' }))).status, 400);
  assert.equal(writes, before, 'Rejected input must never write');
  role = 'Employee';
  assert.equal((await route.GET(new Request('https://example.test/api/dropdown-options'))).status, 403);
  assert.equal((await route.POST(req('jobType', { label: 'Denied', value: 'Denied' }))).status, 403);
  assert.equal(writes, before, 'Employee must never write dropdown registry');
  console.log('DROPDOWN_OPTIONS_PASS: append, deduplication, capacity, canonical roles/booleans/statuses, malformed input, role-gated API contract and preservation of all company settings. Synthetic database only; no provider requests.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
