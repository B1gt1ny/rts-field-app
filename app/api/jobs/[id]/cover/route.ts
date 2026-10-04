import { NextResponse } from "next/server";
import { canEmployeeAccessJob, requireRole } from "@/lib/auth";
import { getJob, saveJob, JobConflictError } from "@/lib/jobs";
import { coverPhotos, currentCover, sameCover } from "@/lib/job-cover";
import { getCompanyCamProjectPhotos, isCompanyCamConfigured } from "@/lib/integrations/companycam";
import type { Job } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };
async function photosFor(job: Job) {
  let providerFailed = false;
  const provider = job.companyCamProjectId && isCompanyCamConfigured()
    ? await getCompanyCamProjectPhotos(job.companyCamProjectId, true).catch(() => { providerFailed = true; return []; }) : [];
  return { photos: coverPhotos(job, provider), providerFailed };
}
export async function GET(request: Request, { params }: Context) {
  const access = await requireRole(request, ["Admin", "Manager", "Employee"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const job = await getJob((await params).id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!canEmployeeAccessJob(access.user || null, job)) return NextResponse.json({ error: "This job is not assigned to you." }, { status: 403 });
  const { photos, providerFailed } = await photosFor(job);
  return NextResponse.json({ photo: currentCover(job, photos) || null, photos: access.role === "Admin" ? photos : undefined, providerFailed }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function PUT(request: Request, { params }: Context) {
  const access = await requireRole(request, ["Admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const job = await getJob((await params).id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  let input: { coverPhoto?: Job["coverPhoto"]; expectedRevision?: string | null };
  try {
    input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid input");
  } catch { return NextResponse.json({ error: "Provide a cover-photo selection." }, { status: 400 }); }
  if (input.expectedRevision !== (job.revision || null)) return NextResponse.json({ error: new JobConflictError().message }, { status: 409 });
  if (!Object.hasOwn(input, "coverPhoto")) return NextResponse.json({ error: "Choose a job photo or automatic cover." }, { status: 400 });
  const { photos, providerFailed } = await photosFor(job);
  const chosen = input.coverPhoto === null ? null : photos.find(photo => sameCover(photo.reference, input.coverPhoto));
  if (chosen === undefined) return NextResponse.json({ error: providerFailed ? "Photo source is unavailable. Try again later." : "Choose a photo already in this job." }, { status: providerFailed ? 503 : 400 });
  try {
    const saved = await saveJob(job, { coverPhoto: chosen?.reference || null });
    return NextResponse.json({ coverPhoto: saved.coverPhoto, revision: saved.revision, photo: currentCover(saved, photos) || null });
  } catch (error) {
    if (error instanceof JobConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
