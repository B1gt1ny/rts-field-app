import { NextResponse } from "next/server";
import { createMerchRequest, getMerchRequests } from "@/lib/settings";
import type { MerchRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getMerchRequests());
}

export async function POST(request: Request) {
  const input = await request.json() as Partial<MerchRequest>;
  return NextResponse.json(await createMerchRequest(input), { status: 201 });
}
