// Read-only inventory. Run only against a separately confirmed target project.
// Example: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   npm run auth:migration-inventory -- --expect-url https://PROJECT.supabase.co --output /private/path/review.json
import { writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { planAuthMigration } from "../lib/auth-migration";

async function main() {
  const args = process.argv.slice(2);
  const expectedUrl = args[args.indexOf("--expect-url") + 1];
  const output = args[args.indexOf("--output") + 1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!expectedUrl || !output || !url || !key || url !== expectedUrl || !url.startsWith("https://")) throw new Error("Explicit matching HTTPS project URL, service key, and private output path are required.");
  const destination = resolve(output);
  const insideCheckout = relative(process.cwd(), destination);
  if (!insideCheckout.startsWith("..") && !insideCheckout.startsWith("/")) throw new Error("Save private inventory outside the repository checkout.");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const users = [];
  for (let page = 1;; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const { data: employees, error: employeeError } = await db.from("employees").select("id,name,active");
  if (employeeError) throw employeeError;
  const plan = planAuthMigration(users);
  const artifact = {
    projectUrl: url,
    observedAt: new Date().toISOString(),
    accountCount: users.length,
    employees,
    accounts: users.map((user, index) => ({
      index: index + 1,
      userId: user.id,
      email: user.email,
      bannedUntil: user.banned_until,
      currentRole: plan[index].currentRole,
      currentEmployeeId: plan[index].currentEmployeeId,
      currentEmployeeName: user.user_metadata?.employeeName,
      proposedRole: plan[index].proposedRole,
      proposedEmployeeId: plan[index].proposedEmployeeId,
      currentAppMetadata: user.app_metadata,
      reviewReason: plan[index].reason,
    })),
  };
  await writeFile(destination, JSON.stringify(artifact, null, 2), { flag: "wx", mode: 0o600 });
  console.log(`Read-only inventory saved privately: ${users.length} Auth accounts; ${plan.filter((row) => !row.proposedRole).length} need independently confirmed mappings.`);
}
main().catch((error) => { console.error(`Inventory failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; });
