import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { updateEmployee } from "@/lib/employees";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const access = await requireRole(request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const input = await request.json() as { name?: string; active?: boolean };
  if (input.name !== undefined && !input.name.trim()) return NextResponse.json({ error: "Employee name is required" }, { status: 400 });
  const employee = await updateEmployee(id, input);
  return employee ? NextResponse.json(employee) : NextResponse.json({ error: "Employee not found" }, { status: 404 });
}
