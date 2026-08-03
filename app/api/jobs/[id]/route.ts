import { NextResponse } from "next/server";
import { canEmployeeAccessJob, employeeSafeJobPatch, getRequestUser, isDatabaseConfigured, requireRole } from "@/lib/auth";
import { deleteJob, getJobs, saveJobs } from "@/lib/jobs";
import { makeChecklist, type Job } from "@/lib/types";
import { syncJobIntegrations } from "@/lib/integrations/sync";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const job = (await getJobs()).find((item) => item.jobId === id);
  if (job && isDatabaseConfigured()) {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: "Login is required." }, { status: 401 });
    if (!canEmployeeAccessJob(user, job)) return NextResponse.json({ error: "This job is not assigned to you." }, { status: 403 });
  }
  return job ? NextResponse.json({ ...job, checklist: job.checklist?.length ? job.checklist : makeChecklist() }) : NextResponse.json({ error: "Job not found" }, { status: 404 });
}

export async function PUT(request: Request, { params }: Context) {
  const access = await requireRole(request, ["Admin", "Manager", "Employee"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const input = await request.json() as Partial<Job>;
  const jobs = await getJobs();
  const index = jobs.findIndex((item) => item.jobId === id);
  if (index < 0) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!canEmployeeAccessJob(access.user || null, jobs[index])) return NextResponse.json({ error: "This job is not assigned to you." }, { status: 403 });
  const safeInput = access.role === "Employee" ? employeeSafeJobPatch(input as Record<string, unknown>) as Partial<Job> : input;
  jobs[index] = { ...jobs[index], ...safeInput, jobId: id };
  await saveJobs(jobs);
  const synced = await syncJobIntegrations(jobs[index]);
  if (synced.job !== jobs[index]) {
    jobs[index] = synced.job;
    await saveJobs(jobs);
  }
  return NextResponse.json({ ...jobs[index], integrationWarnings: synced.warnings });
}

export async function DELETE(_request: Request, { params }: Context) {
  const access = await requireRole(_request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const jobs = await getJobs();
  if (!jobs.some((item) => item.jobId === id)) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await deleteJob(id);
  return NextResponse.json({ deleted: true, jobId: id });
}
