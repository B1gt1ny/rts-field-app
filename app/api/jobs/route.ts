import { NextResponse } from "next/server";
import { canEmployeeAccessJob, requireRole, sanitizeEmployeeJob } from "@/lib/auth";
import { getJobs, getJob, createJob, saveJobIntegration, JobConflictError } from "@/lib/jobs";
import { emptyJob, makeChecklist, type Job } from "@/lib/types";
import { syncJobIntegrations } from "@/lib/integrations/sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager", "Employee"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const jobs = await getJobs();
  if (access.role !== "Employee") return NextResponse.json(jobs);
  return NextResponse.json(jobs.filter((job) => canEmployeeAccessJob(access.user || null, job)).map(sanitizeEmployeeJob));
}

export async function POST(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const input = await request.json() as Partial<Job>;
  if (input.coverPhoto != null) return NextResponse.json({ error: "Choose a cover from the saved job's photos." }, { status: 400 });
  try {
    const job = await createJob({ ...emptyJob, ...input, jobId: input.jobId || "", checklist: input.checklist?.length ? input.checklist : makeChecklist() });
    const synced = await syncJobIntegrations(job);
    let saved = job;
    if (synced.job !== job) {
      try { saved = await saveJobIntegration(synced.job); }
      catch { synced.warnings.push("Job saved, but its integration link could not be saved. Contact the office before syncing again."); saved = await getJob(job.jobId) || job; }
    }
    return NextResponse.json({ ...saved, integrationWarnings: synced.warnings }, { status: 201 });
  } catch (error) {
    if (error instanceof JobConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
