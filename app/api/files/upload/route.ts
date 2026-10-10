import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canEmployeeAccessJob, getUserEmployee, requireRole } from "@/lib/auth";
import { getJob } from "@/lib/jobs";
import { readUploadForm, UploadError, validateUpload, uploadFingerprint } from "@/lib/file-upload";
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
  let formData: FormData;
  try { formData = await readUploadForm(request); }
  catch (error) { return NextResponse.json({ error: error instanceof UploadError ? error.message : "Upload could not be read." }, { status: error instanceof UploadError ? error.status : 400 }); }
  const expectedUserId = formData.get("expectedUserId");
  if (expectedUserId && expectedUserId !== access.user?.id) return NextResponse.json({ error: "Upload account changed. Keep your file and retry from its original account." }, { status: 403 });
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File is required" }, { status: 400 });

  const rawJobId = String(formData.get("jobId") || "").trim();
  if (!rawJobId) return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
  const jobId = cleanSegment(rawJobId);
  const category = String(formData.get("category") || "Other") as FileCategory;
  try { validateUpload(file, category); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid file." }, { status: error instanceof UploadError ? error.status : 400 }); }
  if (rawJobId === "draft") {
    if (access.role === "Employee" || category !== "Work Order") return NextResponse.json({ error: "Only office users can upload draft work orders." }, { status: 403 });
  } else {
    const job = await getJob(rawJobId);
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    if (!canEmployeeAccessJob(access.user || null, job)) return NextResponse.json({ error: "This job is not assigned to you." }, { status: 403 });
  }
  const caption = String(formData.get("caption") || "").trim();
  const employee = getUserEmployee(access.user || null);
  const uploadedBy = employee.employeeName || access.user?.email || undefined;
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name || "upload";
  const fingerprintContext = { ownerId: access.user?.id || "local-admin", jobId: rawJobId, category, caption, fileName, fileType: file.type };
  const fingerprint = uploadFingerprint(buffer, fingerprintContext);
  const id = `file-${fingerprint}`;
  const extension = fileName.includes(".") ? cleanSegment(fileName.split(".").pop() || "bin") : "bin";
  const draftOwner = access.user?.id ? cleanSegment(access.user.id) : "local-admin";
  const storagePath = jobId === "draft" && category === "Work Order"
    ? `draft/${draftOwner}/work-order/${id}.${extension}`
    : `${jobId}/${cleanSegment(category)}/${id}.${extension}`;

  const db = database();
  if (!db) return NextResponse.json({ error: "Private storage is unavailable. Try again later." }, { status: 503 });

  const upload = await db.storage.from(bucketName).upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (upload.error) {
    // A prior attempt may have stored the object before its response was lost.
    // Confirm this exact authorized identity and bytes; never overwrite or trust an error alone.
    const existing = await db.storage.from(bucketName).download(storagePath);
    if (existing.error || !existing.data || existing.data.size !== buffer.length || uploadFingerprint(new Uint8Array(await existing.data.arrayBuffer()), fingerprintContext) !== fingerprint) {
      console.warn("Private storage upload could not be confirmed.");
      return NextResponse.json({ error: "File upload failed. Keep your file and try again." }, { status: 503 });
    }
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

function cleanSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}
