import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getBusinessSettings, saveBusinessSettings } from "@/lib/settings";
import type { BusinessSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager", "Employee"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  return NextResponse.json(await getBusinessSettings());
}

export async function PUT(request: Request) {
  const access = await requireRole(request, ["Admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const input = await request.json() as Partial<BusinessSettings>;
  return NextResponse.json(await saveBusinessSettings(input));
}
