import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createEmployee, getEmployees } from "@/lib/employees";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getEmployees());
}

export async function POST(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { name } = await request.json() as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "Employee name is required" }, { status: 400 });
  return NextResponse.json(await createEmployee(name), { status: 201 });
}
