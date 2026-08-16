import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserEmployee, requireRole } from "@/lib/auth";
import type { FileCategory, WorkOrderFile } from "@/lib/types";

export const dynamic = "force-dynamic";

const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "job-files";

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function POST(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager", "Employee"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File is required" }, { status: 400 });

  const jobId = cleanSegment(String(formData.get("jobId") || "draft"));
  const category = String(formData.get("category") || "Other") as FileCategory;
  const caption = String(formData.get("caption") || "").trim();
  const employee = getUserEmployee(access.user || null);
  const uploadedBy = employee.employeeName || access.user?.email || undefined;
  const buffer = Buffer.from(await file.arrayBuffer());
  const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fileName = file.name || "upload";
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  const draftOwner = access.user?.id ? cleanSegment(access.user.id) : "local-admin";
  const storagePath = jobId === "draft" && category === "Work Order"
    ? `draft/${draftOwner}/work-order/${id}.${extension}`
    : `${jobId}/${cleanSegment(category)}/${id}.${extension}`;

  const db = database();
  if (!db) return NextResponse.json(await fallbackFile(file, buffer, id, category, caption, uploadedBy));

  const bucket = await db.storage.getBucket(bucketName);
  if (bucket.error) {
    await db.storage.createBucket(bucketName, { public: false });
  }

  const upload = await db.storage.from(bucketName).upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });

  if (upload.error) {
    console.warn(`Supabase Storage upload failed; using data URL fallback: ${upload.error.message}`);
    return NextResponse.json(await fallbackFile(file, buffer, id, category, caption, uploadedBy));
  }

  const storedFile: WorkOrderFile = {
    id,
    fileName,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
    dataUrl: `/api/files/view?path=${encodeURIComponent(storagePath)}`,
    storagePath,
    storageUrl: `/api/files/view?path=${encodeURIComponent(storagePath)}`,
    category,
    caption: caption || undefined,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
  };
  return NextResponse.json(storedFile, { status: 201 });
}

async function fallbackFile(file: File, buffer: Buffer, id: string, category: FileCategory, caption?: string, uploadedBy?: string): Promise<WorkOrderFile> {
  return {
    id,
    fileName: file.name || "upload",
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
    dataUrl: `data:${file.type || "application/octet-stream"};base64,${buffer.toString("base64")}`,
    category,
    caption: caption || undefined,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
  };
}

function cleanSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}
