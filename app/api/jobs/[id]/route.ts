import { NextResponse } from "next/server";
import { canEmployeeAccessJob, employeeSafeJobPatch, getUserEmployee, requireRole, sanitizeEmployeeJob } from "@/lib/auth";
import { deleteJob, getJobs, getJob, saveJob, saveJobIntegration, JobConflictError } from "@/lib/jobs";
import { makeChecklist, type Job, type TravelLeg } from "@/lib/types";
import { syncJobIntegrations } from "@/lib/integrations/sync";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const access = await requireRole(request, ["Admin", "Manager", "Employee"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const job = await getJob(id);
  if (job && !canEmployeeAccessJob(access.user || null, job)) return NextResponse.json({ error: "This job is not assigned to you." }, { status: 403 });
  return job ? NextResponse.json({ ...(access.role === "Employee" ? sanitizeEmployeeJob(job) : job), checklist: job.checklist?.length ? job.checklist : makeChecklist() }) : NextResponse.json({ error: "Job not found" }, { status: 404 });
}

export async function PUT(request: Request, { params }: Context) {
  const access = await requireRole(request, ["Admin", "Manager", "Employee"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const { expectedRevision, ...input } = await request.json() as Partial<Job> & { expectedRevision?: string | null };
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!canEmployeeAccessJob(access.user || null, job)) return NextResponse.json({ error: "This job is not assigned to you." }, { status: 403 });
  if (access.role === "Employee" && input.status !== undefined && input.status !== job.status && !["In Progress", "Needs Inspection"].includes(input.status)) {
    return NextResponse.json({ error: "Only a manager can complete jobs or change billing status." }, { status: 403 });
  }
  const safeInput = access.role === "Employee" ? employeeSafeJobPatch(input as Record<string, unknown>, job, getUserEmployee(access.user || null).employeeName || access.user?.email || "Employee") as Partial<Job> : input;
  if (access.role === "Employee" && "travelLegs" in safeInput) {
    const employeeName = getUserEmployee(access.user).employeeName || access.user?.email || "";
    const travelLegs = employeeTravelLegs(job.travelLegs || [], safeInput.travelLegs, employeeName);
    if (!travelLegs) return NextResponse.json({ error: "Travel updates must add one valid leg for the signed-in employee without changing existing travel." }, { status: 400 });
    safeInput.travelLegs = travelLegs;
  }
  if (expectedRevision !== (job.revision || null)) return NextResponse.json({ error: new JobConflictError().message }, { status: 409 });
  try {
    const saved = await saveJob(job, safeInput);
    const synced = await syncJobIntegrations(saved);
    let finalJob = saved;
    if (synced.job !== saved) {
      try { finalJob = await saveJobIntegration(synced.job); }
      catch { synced.warnings.push("Job saved, but its integration link could not be saved. Contact the office before syncing again."); finalJob = await getJob(id) || saved; }
    }
    return NextResponse.json({ ...(access.role === "Employee" ? sanitizeEmployeeJob(finalJob) : finalJob), integrationWarnings: synced.warnings });
  } catch (error) {
    if (error instanceof JobConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
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
