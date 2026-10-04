import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getJob, saveJobIntegration } from "@/lib/jobs";
import { getCompanyCamPhotoCount, getCompanyCamProjectPhotos, isCompanyCamConfigured, syncCompanyCamProject } from "@/lib/integrations/companycam";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireRole(request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!job.companyCamProjectId) {
    return NextResponse.json({
      configured: isCompanyCamConfigured(),
      connected: false,
      photoCount: null,
      photos: [],
      projectUrl: null,
    });
  }
  try {
    const includePhotos = new URL(request.url).searchParams.get("photos") === "1";
    const photos = includePhotos ? await getCompanyCamProjectPhotos(job.companyCamProjectId) : [];
    const photoCount = includePhotos ? photos.length : await getCompanyCamPhotoCount(job.companyCamProjectId);
    return NextResponse.json({
      configured: isCompanyCamConfigured(),
      connected: photoCount !== null,
      photoCount,
      photos,
      projectUrl: job.companyCamProjectUrl,
      projectId: job.companyCamProjectId,
    });
  } catch {
    return NextResponse.json({
      configured: isCompanyCamConfigured(),
      connected: false,
      photoCount: null,
      photos: [],
      photoError: "CompanyCam photos could not be loaded.",
      projectUrl: job.companyCamProjectUrl,
      projectId: job.companyCamProjectId,
    });
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireRole(_request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const synced = await syncCompanyCamProject({ ...job, syncToCompanyCam: true });
    const saved = await saveJobIntegration(synced);
    return NextResponse.json({
      configured: true,
      connected: true,
      projectId: synced.companyCamProjectId,
      projectUrl: synced.companyCamProjectUrl,
      job: saved,
    });
  } catch {
    return NextResponse.json(
      { error: "CompanyCam project could not be synced." },
      { status: 502 },
    );
  }
}
