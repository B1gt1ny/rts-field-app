import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getJob, getJobs, saveJobs } from "@/lib/jobs";
import { getCompanyCamPhotoCount, isCompanyCamConfigured, syncCompanyCamProject } from "@/lib/integrations/companycam";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!job.companyCamProjectId) {
    return NextResponse.json({
      configured: isCompanyCamConfigured(),
      connected: false,
      photoCount: null,
      projectUrl: null,
    });
  }
  try {
    const photoCount = await getCompanyCamPhotoCount(job.companyCamProjectId);
    return NextResponse.json({
      configured: isCompanyCamConfigured(),
      connected: photoCount !== null,
      photoCount,
      projectUrl: job.companyCamProjectUrl,
      projectId: job.companyCamProjectId,
    });
  } catch {
    return NextResponse.json({
      configured: isCompanyCamConfigured(),
      connected: false,
      photoCount: null,
      projectUrl: job.companyCamProjectUrl,
      projectId: job.companyCamProjectId,
    });
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireRole(_request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const jobs = await getJobs();
  const index = jobs.findIndex((job) => job.jobId === id);
  if (index < 0) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const synced = await syncCompanyCamProject({ ...jobs[index], syncToCompanyCam: true });
    jobs[index] = synced;
    await saveJobs(jobs);
    return NextResponse.json({
      configured: true,
      connected: true,
      projectId: synced.companyCamProjectId,
      projectUrl: synced.companyCamProjectUrl,
      job: synced,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CompanyCam project could not be synced." },
      { status: 400 },
    );
  }
}
