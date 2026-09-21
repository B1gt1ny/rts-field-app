import { NextResponse } from "next/server";
import { canEmployeeAccessJob, employeeSafeJobPatch, getRequestUser, getUserEmployee, isDatabaseConfigured, requireRole } from "@/lib/auth";
import { deleteJob, getJobs, saveJobs } from "@/lib/jobs";
import { makeChecklist, type Job, type TravelLeg } from "@/lib/types";
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
  if (access.role === "Employee" && "travelLegs" in safeInput) {
    const employeeName = getUserEmployee(access.user).employeeName || access.user?.email || "";
    const travelLegs = employeeTravelLegs(jobs[index].travelLegs || [], safeInput.travelLegs, employeeName);
    if (!travelLegs) return NextResponse.json({ error: "Travel updates must add one valid leg for the signed-in employee without changing existing travel." }, { status: 400 });
    safeInput.travelLegs = travelLegs;
  }
  jobs[index] = { ...jobs[index], ...safeInput, jobId: id };
  await saveJobs(jobs);
  const synced = await syncJobIntegrations(jobs[index]);
  if (synced.job !== jobs[index]) {
    jobs[index] = synced.job;
    await saveJobs(jobs);
  }
  return NextResponse.json({ ...jobs[index], integrationWarnings: synced.warnings });
}

function employeeTravelLegs(existing: TravelLeg[], input: unknown, employeeName: string) {
  if (!employeeName.trim() || !Array.isArray(input) || input.length !== existing.length + 1) return undefined;
  const existingById = new Map(existing.map((leg) => [leg.id, leg]));
  const additions = input.filter((value): value is Record<string, unknown> => !existingById.has(String((value as Record<string, unknown>)?.id || "")));
  if (additions.length !== 1 || input.some((value) => {
    const leg = value as Record<string, unknown>;
    const saved = existingById.get(String(leg?.id || ""));
    return saved && JSON.stringify(saved) !== JSON.stringify(leg);
  })) return undefined;
  const leg = additions[0];
  const miles = Number(leg.miles);
  const departureAt = optionalTimestamp(leg.departureAt);
  const arrivalAt = optionalTimestamp(leg.arrivalAt);
  if (!isDate(leg.date) || !isText(leg.from) || !isText(leg.to) || !Number.isFinite(miles) || miles < 0 || departureAt === false || arrivalAt === false || (departureAt && arrivalAt && arrivalAt < departureAt)) return undefined;
  return [...existing, { id: `travel-${Date.now()}`, date: String(leg.date), from: String(leg.from).trim(), to: String(leg.to).trim(), miles: String(miles), departureAt: typeof leg.departureAt === "string" ? leg.departureAt : undefined, arrivalAt: typeof leg.arrivalAt === "string" ? leg.arrivalAt : undefined, employeeName: employeeName.trim() }];
}

function isText(value: unknown) { return typeof value === "string" && Boolean(value.trim()); }
function isDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function optionalTimestamp(value: unknown) { return !value ? undefined : typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : false; }

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
