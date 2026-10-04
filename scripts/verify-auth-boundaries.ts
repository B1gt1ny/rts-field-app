import { createServer } from "node:http";
import { canEmployeeAccessJob, getUserEmployee, getUserRole, hasTrustedAccess, requireRole, type AppUser } from "../lib/auth";
import { planAuthMigration, validateApprovedMigration } from "../lib/auth-migration";

function check(condition: boolean, message: string) { if (!condition) throw new Error(message); }
const employee: AppUser = { id: "worker", user_metadata: { role: "Admin", employeeId: "other" }, app_metadata: { rtsRole: "Employee", rtsEmployeeId: "own", rtsAccessActive: true } };
check(hasTrustedAccess(employee), "Trusted employee should be active");
check(getUserRole(employee) === "Employee", "Client metadata must not elevate employee");
check(getUserEmployee(employee).employeeId === "own", "Client metadata must not change employee link");
check(!canEmployeeAccessJob(employee, { assignedEmployeeIds: ["other"] }), "Forged employee link must not expose job");
check(canEmployeeAccessJob(employee, { assignedEmployeeIds: ["own"] }), "Legitimate assignment must remain visible");
check(!canEmployeeAccessJob(employee, { assignedCrew: "Ownerson" }), "Legacy crew substring must not grant access");
check(canEmployeeAccessJob({ ...employee, app_metadata: { ...employee.app_metadata, rtsEmployeeName: "Worker" } }, { assignedCrew: "Worker, Manager" }), "Exact legacy crew entry remains visible");
const manager: AppUser = { id: "manager", user_metadata: { role: "Admin" }, app_metadata: { rtsRole: "Manager", rtsAccessActive: true } };
check(getUserRole(manager) === "Manager", "Client metadata must not elevate manager");
check(!hasTrustedAccess({ id: "legacy", user_metadata: { role: "Admin" } }), "Legacy metadata must fail closed");
check(!hasTrustedAccess({ ...employee, app_metadata: { ...employee.app_metadata, rtsAccessActive: false } }), "Disabled account must fail closed");
check(!hasTrustedAccess({ ...employee, banned_until: "2999-01-01T00:00:00Z" }), "Banned account with existing token must fail closed");
check(hasTrustedAccess({ ...employee, app_metadata: { ...employee.app_metadata, rtsAccessActive: true } }), "Reactivated account must retain role and link");
check(getUserRole({ id: "admin", app_metadata: { rtsRole: "Admin" } }) === "Admin", "Trusted admin must remain admin");
const plan = planAuthMigration([employee]);
check(plan[0].proposedRole === "Employee" && plan[0].currentRole === "Admin", "Migration plan must expose conflict without trusting it");
check(planAuthMigration([{ id: "legacy", user_metadata: { role: "Manager", employeeId: "x" } }])[0].proposedRole === null, "Legacy role must require confirmation");
const reviewed = validateApprovedMigration([employee], [{ userId: "worker", role: "Employee", employeeId: "own", employeeName: "Worker", accessActive: true }], [{ id: "own", name: "Worker" }]);
check(reviewed[0].after.rtsRole === "Employee" && reviewed[0].before.rtsRole === "Employee", "Reviewed mapping preserves other metadata");
let rejected = false;
try { validateApprovedMigration([employee], [{ userId: "worker", role: "Admin", employeeId: "missing", employeeName: "", accessActive: true }], [{ id: "own", name: "Worker" }]); } catch { rejected = true; }
check(rejected, "Unknown employee link must be rejected");
rejected = false;
try { validateApprovedMigration([employee], [{ userId: "worker", role: "Employee", employeeId: "own", employeeName: "Other", accessActive: true }], [{ id: "own", name: "Worker" }]); } catch { rejected = true; }
check(rejected, "Mismatched employee name must be rejected");
async function verifyFailClosedConfiguration() {
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const result = await requireRole(new Request("http://localhost/api/admin/users"), ["Admin"]);
    check(result.ok === false && result.status === 503, "Missing authorization configuration must fail closed");
  } finally {
    if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  }
}

async function verifyServerAuthorization() {
  const identities: Record<string, AppUser> = {
    worker: employee,
    manager,
    admin: { id: "admin", app_metadata: { rtsRole: "Admin", rtsAccessActive: true } },
    disabled: { ...employee, app_metadata: { ...employee.app_metadata, rtsAccessActive: false } },
  };
  const server = createServer((request, response) => {
    const token = request.headers.authorization?.replace(/^Bearer /, "") || "";
    const user = identities[token];
    response.writeHead(user ? 200 : 401, { "Content-Type": "application/json" });
    response.end(JSON.stringify(user || { message: "Not authenticated" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Fixture server unavailable");
    process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${address.port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-key";
    const request = (token: string) => new Request("http://localhost/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
    check((await requireRole(request("worker"), ["Admin"])).ok === false, "Employee must not use admin operations");
    check((await requireRole(request("manager"), ["Admin"])).ok === false, "Manager must not use admin operations");
    check((await requireRole(request("admin"), ["Admin"])).ok === true, "Trusted Admin must retain admin operations");
    check((await requireRole(request("disabled"), ["Employee"])).ok === false, "Disabled token must be rejected");
  } finally {
    server.close();
  }
}
verifyFailClosedConfiguration().then(verifyServerAuthorization).then(() => console.log("Auth boundary fixtures passed.")).catch((error) => { console.error(error); process.exitCode = 1; });
