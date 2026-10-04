import { NextResponse } from "next/server";
import { authClient, getUserEmployee, getUserRole, hasTrustedAccess, requireRole, roles, type UserRole } from "@/lib/auth";
import { employeeLinkConflict } from "@/lib/employee-onboarding";
import { getEmployees } from "@/lib/employees";

export const dynamic = "force-dynamic";

type AuthAdminClient = NonNullable<ReturnType<typeof authClient>>;

async function listAllAuthUsers(db: AuthAdminClient) {
  const users = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) return { users: [], error };
    users.push(...data.users);
    if (data.users.length < perPage) return { users, error: null };
    page += 1;
  }
}

export async function GET(request: Request) {
  const access = await requireRole(request, ["Admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const db = authClient();
  if (!db) return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  const { users, error } = await listAllAuthUsers(db);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(users.map((user) => ({
    id: user.id,
    email: user.email,
    role: getUserRole(user),
    ...getUserEmployee(user),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at,
    accessActive: hasTrustedAccess(user),
  })));
}

export async function POST(request: Request) {
  const access = await requireRole(request, ["Admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const db = authClient();
  if (!db) return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  const input = await request.json() as { email?: string; password?: string; role?: UserRole; employeeId?: string; employeeName?: string };
  if (!input.email?.trim()) return NextResponse.json({ error: "Email is required." }, { status: 400 });
  if (!input.password || input.password.length < 8) return NextResponse.json({ error: "Temporary password must be at least 8 characters." }, { status: 400 });
  const role = roles.includes(input.role as UserRole) ? input.role as UserRole : "Employee";
  const linkedEmployee = input.employeeId ? (await getEmployees()).find((employee) => employee.id === input.employeeId) : undefined;
  if (input.employeeId && !linkedEmployee) return NextResponse.json({ error: "Linked employee not found." }, { status: 400 });
  if (input.employeeId) {
    const { users: existing, error: listError } = await listAllAuthUsers(db);
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
    const conflict = employeeLinkConflict(existing.map((user) => ({ id: user.id, role: getUserRole(user), ...getUserEmployee(user) })), input.employeeId);
    if (conflict) return NextResponse.json({ error: "That employee already has a linked login." }, { status: 409 });
  }
  const { data, error } = await db.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    app_metadata: { rtsRole: role, rtsEmployeeId: input.employeeId || "", rtsEmployeeName: linkedEmployee?.name || "", rtsAccessActive: true },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.user.id, email: data.user.email, role, employeeId: input.employeeId || "", employeeName: linkedEmployee?.name || "", accessActive: true }, { status: 201 });
}

export async function PUT(request: Request) {
  const access = await requireRole(request, ["Admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const db = authClient();
  if (!db) return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  const input = await request.json() as { userId?: string; role?: UserRole; employeeId?: string; employeeName?: string; accessActive?: boolean };
  if (!input.userId) return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  if (!roles.includes(input.role as UserRole)) return NextResponse.json({ error: "Valid role is required." }, { status: 400 });
  const linkedEmployee = input.employeeId ? (await getEmployees()).find((employee) => employee.id === input.employeeId) : undefined;
  if (input.employeeId && !linkedEmployee) return NextResponse.json({ error: "Linked employee not found." }, { status: 400 });
  if (input.accessActive !== undefined && typeof input.accessActive !== "boolean") return NextResponse.json({ error: "Invalid access status." }, { status: 400 });
  const { data: currentData, error: currentError } = await db.auth.admin.getUserById(input.userId);
  if (currentError || !currentData.user) return NextResponse.json({ error: currentError?.message || "User not found." }, { status: 404 });
  if (access.user?.id === input.userId && (input.role !== "Admin" || input.accessActive === false)) return NextResponse.json({ error: "You cannot remove your own admin access." }, { status: 400 });
  if (input.employeeId) {
    const { users: existing, error: listError } = await listAllAuthUsers(db);
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
    const conflict = employeeLinkConflict(existing.map((user) => ({ id: user.id, role: getUserRole(user), ...getUserEmployee(user) })), input.employeeId, input.userId);
    if (conflict) return NextResponse.json({ error: "That employee already has a linked login." }, { status: 409 });
  }
  const { data, error } = await db.auth.admin.updateUserById(input.userId, {
    app_metadata: { ...currentData.user.app_metadata, rtsRole: input.role, rtsEmployeeId: input.employeeId || "", rtsEmployeeName: linkedEmployee?.name || "", rtsAccessActive: input.accessActive ?? currentData.user.app_metadata?.rtsAccessActive === true },
    ...(input.accessActive === undefined ? {} : { ban_duration: input.accessActive ? "none" : "876000h" }),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.user.id, email: data.user.email, role: input.role, employeeId: input.employeeId || "", employeeName: linkedEmployee?.name || "", accessActive: hasTrustedAccess(data.user) });
}
