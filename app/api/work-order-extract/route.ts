import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";
import { aiWorkOrderImportFields, type WorkOrderFile } from "@/lib/types";
import { validateWorkOrderProposal } from "@/lib/work-order-extraction";

export const dynamic = "force-dynamic";

const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "job-files";
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const allowedFields = aiWorkOrderImportFields;
const extractionUnavailable = "Work-order extraction is unavailable. Try again or enter the job manually.";

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function POST(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  let file: WorkOrderFile | undefined;
  try { ({ file } = await request.json() as { file?: WorkOrderFile }); }
  catch { return NextResponse.json({ error: "Select your uploaded PDF, JPG, PNG, or WEBP work-order file." }, { status: 400 }); }
  const owner = access.user?.id ? access.user.id.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") : "local-admin";
  if (!file?.storagePath || !file.fileName || !allowedTypes.has(file.fileType) || !file.storagePath.startsWith(`draft/${owner}/work-order/`)) {
    return NextResponse.json({ error: "Select your uploaded PDF, JPG, PNG, or WEBP work-order file." }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: extractionUnavailable }, { status: 503 });
  const db = database();
  if (!db) return NextResponse.json({ error: extractionUnavailable }, { status: 503 });
  let data: string;
  try {
    const downloaded = await db.storage.from(bucketName).download(file.storagePath);
    if (downloaded.error || !downloaded.data) return NextResponse.json({ error: "The selected file could not be read. Upload it again or enter the job manually." }, { status: 404 });
    data = Buffer.from(await downloaded.data.arrayBuffer()).toString("base64");
  } catch { return NextResponse.json({ error: "The selected file could not be read. Upload it again or enter the job manually." }, { status: 404 }); }
  const document = file.fileType === "application/pdf"
    ? { type: "input_file", filename: file.fileName, file_data: `data:${file.fileType};base64,${data}` }
    : { type: "input_image", image_url: `data:${file.fileType};base64,${data}`, detail: "high" };
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ model: process.env.OPENAI_WORK_ORDER_MODEL || "gpt-4.1-mini", input: [{ role: "user", content: [{ type: "input_text", text: "Extract only the requested job fields from this work-order document. Return JSON only. Leave missing or uncertain values out; never guess.\n\nCustomer: customerName is the person or business receiving service. Do not use a manufacturer, dealer, or vendor unless it is clearly the service customer.\nAddress: address and city are the service/job location. Do not use a billing, dealer, manufacturer, or office address unless it is clearly the service location.\nWork order and serial: factoryWorkOrderNumber is the work order, service order, or ticket reference. serialUnitNumber is the equipment, unit, home serial, or unit identifier. Do not swap them. Preserve the exact practical formatting of work-order numbers, serial/unit numbers, phone numbers, and reference numbers; do not clean identifiers in a way that changes their meaning.\nDates: dueDate is a service, scheduled, or due date only when explicitly shown. Do not use invoice, document, print, or unrelated dates. scheduledTime is an explicit service appointment or start time only.\nWork: scopeNotes faithfully summarizes the requested work. Do not invent repairs or turn unrelated notes into scope. partsNeeded includes only parts explicitly requested or needed, not installed or historical parts. returnVisitRequired is true only when another visit or follow-up is explicitly required; do not infer it from past visits or historical notes.\n\nDo not include status, priority, assignments, readiness, billing, costs, photos, activity, or any other fields." }, document] }], text: { format: { type: "json_schema", name: "work_order_import", strict: true, schema: { type: "object", additionalProperties: false, properties: Object.fromEntries(allowedFields.map((field) => [field, field === "returnVisitRequired" ? { type: "boolean" } : { type: "string" }])), required: [] } } } }),
    });
    if (!response.ok) return NextResponse.json({ error: extractionUnavailable }, { status: 502 });
    const result = await response.json() as { output_text?: string };
    const proposal = validateWorkOrderProposal(result.output_text);
    if (proposal === "invalid") return NextResponse.json({ error: extractionUnavailable }, { status: 502 });
    if (!proposal) return NextResponse.json({ error: "No usable job information was found in this document. Try again or enter the job manually." }, { status: 422 });
    return NextResponse.json({ proposal });
  } catch { return NextResponse.json({ error: extractionUnavailable }, { status: 502 }); }
}
