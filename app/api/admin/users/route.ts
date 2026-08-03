import { NextResponse } from "next/server";
import { authClient, getUserEmployee, getUserRole, requireRole, roles, type UserRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireRole(request, ["Admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const db = authClient();
  if (!db) return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  const { data, error } = await db.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data.users.map((user) => ({
    id: user.id,
    email: user.email,
    role: getUserRole(user),
    ...getUserEmployee(user),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at,
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
  const { data, error } = await db.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: { role, employeeId: input.employeeId || "", employeeName: input.employeeName || "" },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.user.id, email: data.user.email, role, employeeId: input.employeeId || "", employeeName: input.employeeName || "" }, { status: 201 });
}

export async function PUT(request: Request) {
  const access = await requireRole(request, ["Admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const db = authClient();
  if (!db) return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  const input = await request.json() as { userId?: string; role?: UserRole; employeeId?: string; employeeName?: string };
  if (!input.userId) return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  if (!roles.includes(input.role as UserRole)) return NextResponse.json({ error: "Valid role is required." }, { status: 400 });
  const { data, error } = await db.auth.admin.updateUserById(input.userId, {
    user_metadata: { role: input.role, employeeId: input.employeeId || "", employeeName: input.employeeName || "" },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.user.id, email: data.user.email, role: input.role, employeeId: input.employeeId || "", employeeName: input.employeeName || "" });
}
