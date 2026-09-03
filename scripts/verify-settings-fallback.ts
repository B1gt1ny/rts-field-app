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

    const { createMerchRequest, getBusinessSettings, getMerchRequests, saveBusinessSettings } = await import("../lib/settings");
    const defaults = await getBusinessSettings();
    if (defaults.businessId !== "rts" || !defaults.jobTypeOptions.length || !defaults.checklistOptions.length) {
      throw new Error("Missing settings file did not return complete built-in defaults.");
    }
    if ((await getMerchRequests()).length !== 0) throw new Error("Missing merchandise file did not return an empty list.");

    const saved = await saveBusinessSettings({ ...defaults, companyName: "Fallback Test Company" });
    if (saved.companyName !== "Fallback Test Company") throw new Error("Local settings save did not preserve the update.");
    await fs.access(path.join(testRoot, "data", "settings.json"));

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
