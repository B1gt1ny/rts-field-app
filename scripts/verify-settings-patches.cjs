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
const db = { from(table) {
  let operation = 'read', row, expected;
  return {
    select() { return this; },
    eq(key, value) { if (key === 'data') expected = JSON.parse(value); return this; },
    update(value) { operation = 'update'; row = value; return this; },
    async insert(value) {
      if (table === 'business_settings' && dedicatedWriteError) return { error: { message: 'fixture write failure' } };
      if (table === 'business_settings' ? stored : fallback) return { error: { code: '23505', message: 'duplicate' } };
      writes++; if (table === 'business_settings') stored = structuredClone(value.data); else fallback = structuredClone(value.data);
      return { error: null };
    },
    async maybeSingle() {
      const value = table === 'business_settings' ? stored : fallback;
      if (operation === 'read') return { data: value ? { data: structuredClone(value) } : null, error: (table === 'business_settings' ? dedicatedReadError : fallbackReadError) ? { code: table === 'business_settings' ? '42P01' : 'XX000', message: 'fixture read failure' } : null };
      if (table === 'business_settings' && dedicatedWriteError) return { data: null, error: { message: 'fixture write failure' } };
      if (JSON.stringify(value) !== JSON.stringify(expected)) return { data: null, error: null };
      writes++; if (table === 'business_settings') stored = structuredClone(row.data); else fallback = structuredClone(row.data);
      return { data: { data: structuredClone(row.data) }, error: null };
    }
  };
} };
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
  fallback = stored;
  assert.equal((await route.PUT(request({ phone: 'new-fixture-phone' }))).status, 200); assert.equal(fallback.phone, 'new-fixture-phone'); assert.equal(fallback.companyName, 'Saved Company'); assert.equal(fallback.calendarFeedToken, 'fixture-rotated-token');
  dedicatedReadError = fallbackReadError = false;
  for (const useFallback of [false, true]) {
    dedicatedReadError = useFallback;
    if (useFallback) fallback = { ...stored, dropdownOptions: {} };
    else stored = { ...stored, dropdownOptions: {} };
    await Promise.all([
      settings.saveBusinessSettings({ dropdownOptions: { jobType: [{ label: 'Concurrent A', value: 'Concurrent A' }] } }),
      settings.saveBusinessSettings({ dropdownOptions: { jobType: [{ label: 'Concurrent B', value: 'Concurrent B' }] } }),
      settings.saveBusinessSettings({ city: 'Concurrent City', factoryCostDefaults: { mileageRate: '2' } })
    ]);
    const saved = useFallback ? fallback : stored;
    assert.deepEqual(saved.dropdownOptions.jobType.map(x => x.label).sort(), ['Concurrent A', 'Concurrent B']);
    assert.equal(saved.city, 'Concurrent City'); assert.equal(saved.factoryCostDefaults.mileageRate, '2');
    assert.equal(saved.companyName, 'Saved Company'); assert.equal(saved.calendarFeedToken, 'fixture-rotated-token');
  }
  dedicatedReadError = false; stored = undefined;
  await Promise.all([settings.saveBusinessSettings({ city: 'Created City' }), settings.saveBusinessSettings({ phone: 'Created Phone' })]);
  assert.equal(stored.city, 'Created City'); assert.equal(stored.phone, 'Created Phone');
  dedicatedWriteError = true;
  const beforeFailure = writes;
  assert.equal((await route.PUT(request({ city: 'No Write' }))).status, 503);
  assert.equal(writes, beforeFailure, 'Dedicated write failure must not fork settings into fallback');
  dedicatedWriteError = false; dedicatedReadError = fallbackReadError = true;
  assert.equal((await route.PUT(request({ city: 'No Read' }))).status, 503); assert.equal(writes, beforeFailure);
  fallbackReadError = false; dedicatedReadError = true;
  // Force fallback write error independently of its readable snapshot.
  const originalFrom = db.from;
  db.from = (table) => {
    const query = originalFrom(table);
    if (table === 'jobs') query.update = () => ({ eq() { return this; }, select() { return this; }, maybeSingle: async () => ({ data: null, error: { message: 'fallback write failure' } }) });
    return query;
  };
  assert.equal((await route.PUT(request({ city: 'No Fallback Write' }))).status, 503); assert.equal(writes, beforeFailure);
  db.from = originalFrom;
  let fallbackAttempts = 0;
  db.from = (table) => {
    if (table === 'jobs') fallbackAttempts++;
    const query = originalFrom(table);
    if (table === 'business_settings') query.maybeSingle = async () => ({ data: null, error: { code: 'XX000', message: 'ordinary storage error' } });
    return query;
  };
  assert.equal((await route.PUT(request({ city: 'Must Not Fork' }))).status, 503);
  assert.equal(fallbackAttempts, 0, 'Ordinary dedicated read errors cannot use fallback');
  assert.equal(writes, beforeFailure);
  db.from = originalFrom;
  dedicatedReadError = fallbackReadError = false;
  for (const useFallback of [false, true]) {
    dedicatedReadError = useFallback;
    let reads = 0, conflicts = 0;
    db.from = (table) => {
      const query = originalFrom(table);
      if (table === (useFallback ? 'jobs' : 'business_settings')) {
        const read = query.maybeSingle;
        query.maybeSingle = async () => { reads++; return read.call(query); };
        query.update = () => ({ eq() { return this; }, select() { return this; }, maybeSingle: async () => { conflicts++; return { data: null, error: null }; } });
      }
      return query;
    };
    assert.equal((await route.PUT(request({ city: 'Conflict Exhaustion' }))).status, 503);
    assert.equal(reads, 8, 'Each retry must read a fresh snapshot');
    assert.equal(conflicts, 8, 'Conflict attempts are bounded to eight');
    assert.equal(writes, beforeFailure, 'Exhaustion must not write stale settings');
    db.from = originalFrom;
  }
  console.log('Hosted settings partial patches, concurrent append/update/create, token rotation and fail-closed storage checks passed. No provider requests made.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
