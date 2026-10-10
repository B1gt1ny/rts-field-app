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
let stored, fallback, dedicatedReadError = false, fallbackReadError = false, dedicatedWriteError = false, writes = 0;
const db = { from(table) { return {
  select() { return this; }, eq() { return this; },
  async maybeSingle() { return { data: table === 'business_settings' ? (stored ? { data: stored } : null) : (fallback ? { data: fallback } : null), error: (table === 'business_settings' ? dedicatedReadError : fallbackReadError) ? { message: 'fixture read failure' } : null }; },
  async upsert(row) { if (table === 'business_settings' && dedicatedWriteError) return { error: { message: 'fixture missing table' } }; writes++; if (table === 'business_settings') stored = row.data; else fallback = row.data; return { error: null }; }
}; } };
const types = load('lib/types.ts');
const dropdown = load('lib/dropdown-options.ts', { './types': types });
const settings = load('lib/settings.ts', { './dropdown-options': dropdown, './types': types, '@supabase/supabase-js': { createClient: () => db }, fs: { promises: { readFile: async () => '{}' } } });
const auth = load('lib/auth.ts', { './types': types });
let role = 'Admin';
const route = load('app/api/settings/route.ts', {
  '@/lib/auth': { requireRole: async () => ({ ok: true, role, user: { id: 'fixture-admin' } }), sanitizeEmployeeFactoryCost: auth.sanitizeEmployeeFactoryCost },
  '@/lib/settings': settings,
  '@/lib/integrations/ics-calendar': { createCalendarFeedToken: () => 'fixture-rotated-token' }
});
const request = (patch) => new Request('https://example.test/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-only-key';
  stored = await settings.getBusinessSettings();
  stored = { ...stored, companyName: 'Saved Company', calendarFeedToken: 'fixture-existing-token', employeeCanUploadFiles: false, factoryCostDefaults: { ...stored.factoryCostDefaults, hourlyRate: '44' } };
  role = 'Employee';
  const employeeSettings = await (await route.GET(new Request('https://example.test/api/settings'))).json();
  assert.equal(Object.hasOwn(employeeSettings, 'calendarFeedToken'), false);
  assert.equal(employeeSettings.factoryCostDefaults.hourlyRate, '');
  role = 'Manager';
  assert.equal(Object.hasOwn(await (await route.GET(new Request('https://example.test/api/settings'))).json(), 'calendarFeedToken'), false);
  role = 'Admin';
  const response = await route.PUT(request({ city: 'New City', factoryCostDefaults: { mileageRate: '1.50' } })); assert.equal(response.status, 200);
  assert.equal(stored.city, 'New City'); assert.equal(stored.companyName, 'Saved Company'); assert.equal(stored.calendarFeedToken, 'fixture-existing-token'); assert.equal(stored.employeeCanUploadFiles, false); assert.equal(stored.factoryCostDefaults.hourlyRate, '44');
  assert.equal((await route.PUT(request({ calendarFeedToken: '' }))).status, 200); assert.equal(stored.calendarFeedToken, 'fixture-rotated-token');
  const before = writes; assert.equal((await route.PUT(request({ employeeCanUploadFiles: 'false' }))).status, 400); assert.equal(writes, before);
  assert.equal((await route.PUT(new Request('https://example.test/api/settings', { method: 'PUT', body: '{' }))).status, 400); assert.equal(writes, before);
  dedicatedReadError = fallbackReadError = true;
  assert.equal((await route.PUT(request({ companyName: 'Must Not Write' }))).status, 503); assert.equal(writes, before);
  fallbackReadError = false; fallback = undefined;
  assert.equal((await route.PUT(request({ companyName: "Must Not Reset" }))).status, 503); assert.equal(writes, before, "Missing fallback does not justify overwriting unread dedicated settings");
  fallback = stored; dedicatedWriteError = true;
  assert.equal((await route.PUT(request({ phone: 'new-fixture-phone' }))).status, 200); assert.equal(fallback.phone, 'new-fixture-phone'); assert.equal(fallback.companyName, 'Saved Company'); assert.equal(fallback.calendarFeedToken, 'fixture-rotated-token');
  console.log('Hosted settings partial-patch, token rotation, malformed input and read-failure checks passed. No provider requests made.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
