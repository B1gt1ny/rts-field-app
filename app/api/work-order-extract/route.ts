import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";
import { aiWorkOrderImportFields, type AIWorkOrderImport, type WorkOrderFile } from "@/lib/types";

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
      body: JSON.stringify({ model: process.env.OPENAI_WORK_ORDER_MODEL || "gpt-4.1-mini", input: [{ role: "user", content: [{ type: "input_text", text: "Extract only the requested job fields from this work-order document. Return JSON only. Omit unclear values; never guess. Do not include status, priority, assignments, readiness, billing, costs, photos, activity, or any other fields." }, document] }], text: { format: { type: "json_schema", name: "work_order_import", strict: true, schema: { type: "object", additionalProperties: false, properties: Object.fromEntries(allowedFields.map((field) => [field, field === "returnVisitRequired" ? { type: "boolean" } : { type: "string" }])), required: [] } } } }),
    });
    if (!response.ok) return NextResponse.json({ error: extractionUnavailable }, { status: 502 });
    const result = await response.json() as { output_text?: string };
    const proposal = validProposal(result.output_text);
    if (proposal === "invalid") return NextResponse.json({ error: extractionUnavailable }, { status: 502 });
    if (!proposal) return NextResponse.json({ error: "No usable job information was found in this document. Try again or enter the job manually." }, { status: 422 });
    return NextResponse.json({ proposal });
  } catch { return NextResponse.json({ error: extractionUnavailable }, { status: 502 }); }
}

function validProposal(output: string | undefined): AIWorkOrderImport | null | "invalid" {
  let parsed: unknown;
  try { parsed = JSON.parse(output || "{}"); } catch { return "invalid"; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "invalid";
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.some(([field]) => !allowedFields.includes(field as typeof allowedFields[number]))) return "invalid";
  const proposalEntries: [string, string | boolean][] = [];
  for (const [field, value] of entries) {
    if (value === undefined || value === null || value === "") continue;
    if (field === "returnVisitRequired") {
      if (typeof value === "boolean") proposalEntries.push([field, value]);
      continue;
    }
    if (typeof value === "string" && value.trim()) proposalEntries.push([field, value.trim()]);
  }
  const proposal = Object.fromEntries(proposalEntries) as AIWorkOrderImport;
  return Object.keys(proposal).length ? proposal : null;
}
