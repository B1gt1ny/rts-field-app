import { NextResponse } from "next/server";
import { updateMerchRequest } from "@/lib/settings";
import type { MerchRequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const allowedStatuses: MerchRequestStatus[] = ["Requested", "Approved", "Ordered", "Received"];

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status } = await request.json() as { status?: MerchRequestStatus };
  if (!status || !allowedStatuses.includes(status)) return NextResponse.json({ error: "Valid status is required" }, { status: 400 });
  const updated = await updateMerchRequest(id, status);
  if (!updated) return NextResponse.json({ error: "Merch request not found" }, { status: 404 });
  return NextResponse.json(updated);
}
