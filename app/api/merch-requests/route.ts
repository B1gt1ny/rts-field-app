import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createMerchRequest, getMerchRequests } from "@/lib/settings";
import type { MerchRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireRole(request, ["Admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  return NextResponse.json(await getMerchRequests());
}

export async function POST(request: Request) {
  const access = await requireRole(request, ["Admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const input = await request.json() as Partial<MerchRequest>;
  return NextResponse.json(await createMerchRequest(input), { status: 201 });
}
