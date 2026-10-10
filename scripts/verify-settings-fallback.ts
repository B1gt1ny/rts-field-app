import assert from "node:assert/strict";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

async function main() {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rts-settings-fallback-"));
  const originalCwd = process.cwd();
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    process.chdir(testRoot);
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { createMerchRequest, getBusinessSettings, getMerchRequests, saveBusinessSettings, validateSettingsPatch } = await import("../lib/settings");
    const defaults = await getBusinessSettings();
    if (defaults.businessId !== "rts" || !defaults.jobTypeOptions.length || !defaults.checklistOptions.length) {
      throw new Error("Missing settings file did not return complete built-in defaults.");
    }
    if ((await getMerchRequests()).length !== 0) throw new Error("Missing merchandise file did not return an empty list.");

    const saved = await saveBusinessSettings({ ...defaults, companyName: "Fallback Test Company" });
    if (saved.companyName !== "Fallback Test Company") throw new Error("Local settings save did not preserve the update.");
    await fs.access(path.join(testRoot, "data", "settings.json"));

    await saveBusinessSettings({ phone: "555-fixture", calendarFeedToken: "fixture-token", employeeCanUploadFiles: false, factoryCostDefaults: { ...defaults.factoryCostDefaults, mileageRate: "1.25", hourlyRate: "33" } });
    const patched = await saveBusinessSettings({ city: "Fixture City", factoryCostDefaults: { mileageRate: "2.50" } as typeof defaults.factoryCostDefaults });
    assert.equal(patched.companyName, "Fallback Test Company", "Partial patch preserves branding");
    assert.equal(patched.phone, "555-fixture");
    assert.equal(patched.calendarFeedToken, "fixture-token", "Omitted token remains valid");
    assert.equal(patched.employeeCanUploadFiles, false, "Omitted disabled permission remains disabled");
    assert.equal(patched.factoryCostDefaults.hourlyRate, "33", "Nested omitted rate retained");
    assert.equal(patched.factoryCostDefaults.mileageRate, "2.50");
    assert.equal(patched.city, "Fixture City");
    assert.equal((await saveBusinessSettings({ phone: "", employeeCanUploadFiles: true })).phone, "", "Explicit empty field can clear saved text");
    assert.equal((await getBusinessSettings()).employeeCanUploadFiles, true, "Explicit permission update retained");
    for (const invalid of [null, [], { companyName: 42 }, { jobTypeOptions: [42] }, { employeeCanUploadFiles: "false" }, { factoryCostDefaults: null }, { factoryCostDefaults: { hourlyRate: 33 } }, { arbitraryField: "value" }]) {
      assert.throws(() => validateSettingsPatch(invalid));
    }
    const beforeInvalid = await fs.readFile(path.join(testRoot, "data", "settings.json"), "utf8");
    await assert.rejects(saveBusinessSettings({ companyName: 42 } as never));
    assert.equal(await fs.readFile(path.join(testRoot, "data", "settings.json"), "utf8"), beforeInvalid, "Invalid patch never writes");

    await createMerchRequest({ requestedBy: "Validation", item: "Shirt" });
    await fs.access(path.join(testRoot, "data", "merch-requests.json"));
  } finally {
    process.chdir(originalCwd);
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    await fs.rm(testRoot, { recursive: true, force: true });
  }

  console.log("Settings fallback validation passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
