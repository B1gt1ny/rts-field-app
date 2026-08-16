import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canEmployeeAccessJob, requireRole, type AppUser } from "@/lib/auth";
import { getJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "job-files";

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function GET(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager", "Employee"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const path = new URL(request.url).searchParams.get("path");
  if (!path) return NextResponse.json({ error: "Storage path is required" }, { status: 400 });
  if (!access.authDisabled && access.role === "Employee" && !(await canOpenPath(access.user, path))) {
    return NextResponse.json({ error: "You do not have permission to open this file." }, { status: 403 });
  }

  const db = database();
  if (!db) return NextResponse.json({ error: "Storage is not configured" }, { status: 503 });

  const signed = await db.storage.from(bucketName).createSignedUrl(path, 60 * 10);
  if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ error: signed.error?.message || "File could not be opened" }, { status: 404 });
  return NextResponse.redirect(signed.data.signedUrl);
}

async function canOpenPath(user: AppUser | null, path: string) {
  const jobSegment = path.split("/")[0] || "";
  const jobs = await getJobs();
  const job = jobs.find((item) => cleanSegment(item.jobId) === jobSegment);
  if (job) return canEmployeeAccessJob(user, job);
  const attachedJob = jobs.find((item) => item.workOrderFiles?.some((file) => file.storagePath === path));
  return Boolean(attachedJob && canEmployeeAccessJob(user, attachedJob));
}

function cleanSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}
