import { NextResponse } from "next/server";
import { canEmployeeAccessJob, requireRole, sanitizeEmployeeJob } from "@/lib/auth";
import { getJobs, saveJobs } from "@/lib/jobs";
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
  const jobs = await getJobs();
  const nextNumber = Math.max(0, ...jobs.map((job) => Number(job.jobId.replace(/\D/g, "")) || 0)) + 1;
  const job: Job = { ...emptyJob, ...input, jobId: input.jobId || `RTS-${nextNumber}`, checklist: input.checklist?.length ? input.checklist : makeChecklist() };
  jobs.unshift(job);
  await saveJobs(jobs);
  const synced = await syncJobIntegrations(job);
  if (synced.job !== job) {
    jobs[0] = synced.job;
    await saveJobs(jobs);
  }
  return NextResponse.json({ ...synced.job, integrationWarnings: synced.warnings }, { status: 201 });
}
