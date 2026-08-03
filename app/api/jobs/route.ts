import { NextResponse } from "next/server";
import { canEmployeeAccessJob, getRequestUser, getUserRole, isDatabaseConfigured, requireRole } from "@/lib/auth";
import { getJobs, saveJobs } from "@/lib/jobs";
import { emptyJob, makeChecklist, type Job } from "@/lib/types";
import { syncJobIntegrations } from "@/lib/integrations/sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const jobs = await getJobs();
  if (!isDatabaseConfigured()) return NextResponse.json(jobs);
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Login is required." }, { status: 401 });
  if (getUserRole(user) !== "Employee") return NextResponse.json(jobs);
  return NextResponse.json(jobs.filter((job) => canEmployeeAccessJob(user, job)));
}

export async function POST(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const input = await request.json() as Partial<Job>;
  const jobs = await getJobs();
  const nextNumber = Math.max(...jobs.map((job) => Number(job.jobId.replace(/\D/g, "")) || 0)) + 1;
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
