import Link from "next/link";
import { ClockIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { Job, TimeEntry } from "@/lib/types";
import { closeoutChecks, hasActiveCorrections } from "@/lib/job-readiness";
import { StatusBadge } from "./StatusBadge";

type EmployeeReview = {
  name: string;
  jobs: Job[];
  activeJob?: Job;
  travelStarted?: TimeEntry;
  arrived?: TimeEntry;
  workStarted?: TimeEntry;
  finishedWork?: TimeEntry;
  mileage: number;
  openJobs: number;
  reviewNeeded: number;
  missingCloseout: number;
};

type DailyIssue = {
  id: string;
  title: string;
  detail: string;
  employee: string;
  job: Job;
  href: string;
  rank: number;
};

type TodaySummary = {
  employeesWorking: number;
  jobsStarted: number;
  jobsCompleted: number;
  jobsAwaitingReview: number;
  milesRecorded: number;
  travelSessions: number;
  workSessions: number;
};

const closedStatuses = ["Complete", "Billed", "Paid"];

export function CommandCenterView({ jobs }: { jobs: Job[] }) {
  const today = new Date().toLocaleDateString("en-CA");
  const todayJobs = jobs.filter((job) => isTodayJob(job, today));
  const employeeReviews = buildEmployeeReviews(todayJobs, today);
  const issues = buildDailyIssues(employeeReviews, today).slice(0, 10);
  const summary = buildTodaySummary(todayJobs, employeeReviews, today);

  return <div className="mx-auto max-w-6xl space-y-4">
    <section className="rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><ClockIcon className="size-7" /></span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-lime">{formatToday(today)}</p>
          <h1 className="mt-1 text-3xl font-black">Daily Review</h1>
          <p className="mt-1 text-sm text-white/55">Today&apos;s active employee work, open closeout items, and manager review needs.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <SummaryCard label="Employees working" value={summary.employeesWorking} />
        <SummaryCard label="Jobs started" value={summary.jobsStarted} />
        <SummaryCard label="Jobs completed" value={summary.jobsCompleted} />
        <SummaryCard label="Awaiting review" value={summary.jobsAwaitingReview} />
        <SummaryCard label="Miles recorded" value={formatMiles(summary.milesRecorded)} />
        <SummaryCard label="Travel sessions" value={summary.travelSessions} />
        <SummaryCard label="Work sessions" value={summary.workSessions} />
      </div>
    </section>

    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-lg font-black">Employee Cards</h2>
          <p className="text-sm font-semibold text-black/45">One card per employee active on today&apos;s jobs.</p>
        </div>
        <span className="rounded-full bg-sand px-3 py-1 text-xs font-black text-black/45">{employeeReviews.length} working</span>
      </div>
      <div className="grid gap-3">
        {employeeReviews.length ? employeeReviews.map((employee) => <EmployeeCard key={employee.name} employee={employee} />) : <Empty text="No employees are assigned to or logging time on today&apos;s work." />}
      </div>
    </section>

    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-sand p-4">
        <div>
          <h2 className="text-lg font-black">Today&apos;s Action Items</h2>
          <p className="text-sm font-semibold text-black/45">Showing up to 10 problems from today&apos;s active work.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-black/45">{issues.length}</span>
      </div>
      <div className="divide-y divide-black/5">
        {issues.length ? issues.map((issue) => <IssueRow key={issue.id} issue={issue} />) : <Empty text="No actionable problems are open for today." />}
      </div>
    </section>
  </div>;
}

function EmployeeCard({ employee }: { employee: EmployeeReview }) {
  const href = employee.activeJob ? `/jobs/${employee.activeJob.jobId}#time-log` : "/jobs";

  return <Link href={href} className="card block p-4 transition active:scale-[.99]">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xl font-black">{employee.name}</p>
        <p className="mt-1 text-sm font-bold text-black/45">{employee.jobs.length} Job{employee.jobs.length === 1 ? "" : "s"}</p>
      </div>
      {employee.activeJob && <div className="flex flex-wrap justify-end gap-2"><StatusBadge status={employee.activeJob.status} />{hasActiveCorrections(employee.activeJob) && <NeedsCorrectionBadge />}</div>}
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      <CardMetric label="Travel" value={formatTime(employee.travelStarted?.createdAt)} />
      <CardMetric label="Arrived" value={formatTime(employee.arrived?.createdAt)} />
      <CardMetric label="Started" value={formatTime(employee.workStarted?.createdAt)} />
      <CardMetric label="Finished" value={formatTime(employee.finishedWork?.createdAt)} />
      <CardMetric label="Mileage" value={formatMiles(employee.mileage)} />
      <CardMetric label="Review Needed" value={employee.reviewNeeded} />
      <CardMetric label="Open Jobs" value={employee.openJobs} />
      <CardMetric label="Missing Closeout" value={employee.missingCloseout} />
    </div>
    {employee.activeJob && <p className="mt-3 truncate text-xs font-black uppercase tracking-wide text-forest">{employee.activeJob.jobId} · {employee.activeJob.customerName}</p>}
  </Link>;
}

function IssueRow({ issue }: { issue: DailyIssue }) {
  return <div className="p-4 hover:bg-black/[.02]">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <Link href={issue.href} className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-900"><ExclamationTriangleIcon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{issue.employee} · {issue.job.jobId}</p>
          <h3 className="mt-1 font-black">{issue.title}</h3>
          <p className="mt-1 text-sm font-semibold text-black/50">{issue.detail}</p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={issue.job.status} />
        {hasActiveCorrections(issue.job) && <NeedsCorrectionBadge />}
        <Link href={`/jobs/${issue.job.jobId}`} className="rounded-xl bg-forest px-3 py-2 text-sm font-black text-white">Open job</Link>
      </div>
    </div>
  </div>;
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl bg-white/10 p-3">
    <p className="text-2xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-white/55">{label}</p>
  </div>;
}

function CardMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl bg-sand p-3">
    <p className="text-lg font-black">{value || "—"}</p>
    <p className="mt-0.5 text-[11px] font-black uppercase tracking-wide text-black/40">{label}</p>
  </div>;
}

function Empty({ text }: { text: string }) {
  return <p className="p-5 text-center text-sm font-semibold text-black/35">{text}</p>;
}

function NeedsCorrectionBadge() {
  return <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-extrabold text-orange-800">Needs Correction</span>;
}

function buildEmployeeReviews(jobs: Job[], today: string): EmployeeReview[] {
  const employees = new Map<string, EmployeeReview>();

  for (const job of jobs) {
    const todayEntries = entriesForDate(job, today);
    const names = new Set<string>([
      ...assignedEmployeeNames(job),
      ...todayEntries.map((entry) => entry.employeeName).filter(Boolean),
    ]);

    for (const name of names) {
      if (!employees.has(name)) {
        employees.set(name, {
          name,
          jobs: [],
          mileage: 0,
          openJobs: 0,
          reviewNeeded: 0,
          missingCloseout: 0,
        });
      }
      const review = employees.get(name);
      if (!review) continue;
      review.jobs.push(job);
      review.activeJob ||= !closedStatuses.includes(job.status) ? job : undefined;
      review.openJobs += closedStatuses.includes(job.status) ? 0 : 1;
      review.reviewNeeded += job.status === "Needs Inspection" ? 1 : 0;
      review.missingCloseout += needsCloseout(job, today) ? 1 : 0;

      const employeeEntries = todayEntries.filter((entry) => sameEmployee(entry.employeeName, name));
      review.travelStarted = earliest(review.travelStarted, employeeEntries.find(isTravelStarted));
      review.arrived = earliest(review.arrived, employeeEntries.find((entry) => entry.type === "Arrived"));
      review.workStarted = earliest(review.workStarted, employeeEntries.find((entry) => entry.type === "Work started"));
      review.finishedWork = latest(review.finishedWork, employeeEntries.find((entry) => entry.type === "Departed"));
      review.mileage += employeeEntries.reduce((sum, entry) => sum + mileageValue(entry), 0);
    }
  }

  return [...employees.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function buildTodaySummary(jobs: Job[], employeeReviews: EmployeeReview[], today: string): TodaySummary {
  const entries = jobs.flatMap((job) => entriesForDate(job, today));
  const jobsStarted = jobs.filter((job) => entriesForDate(job, today).some((entry) => entry.type === "Work started")).length;
  const jobsCompleted = jobs.filter((job) => entriesForDate(job, today).some((entry) => entry.type === "Departed")).length;
  return {
    employeesWorking: employeeReviews.length,
    jobsStarted,
    jobsCompleted,
    jobsAwaitingReview: jobs.filter((job) => job.status === "Needs Inspection").length,
    milesRecorded: entries.reduce((sum, entry) => sum + mileageValue(entry), 0),
    travelSessions: entries.filter(isTravelStarted).length,
    workSessions: entries.filter((entry) => entry.type === "Work started").length,
  };
}

function buildDailyIssues(employees: EmployeeReview[], today: string): DailyIssue[] {
  const seenJobLevelIssues = new Set<string>();
  return employees.flatMap((employee) => employee.jobs.flatMap((job) => {
    const entries = entriesForDate(job, today).filter((entry) => sameEmployee(entry.employeeName, employee.name));
    const travelStarted = entries.some(isTravelStarted);
    const arrived = entries.some((entry) => entry.type === "Arrived");
    const workStarted = entries.some((entry) => entry.type === "Work started");
    const finished = entries.some((entry) => entry.type === "Departed");
    const issues: Omit<DailyIssue, "id" | "employee" | "job">[] = [];

    if (travelStarted && !arrived) issues.push({ title: "Travel started but never arrived", detail: `${employee.name} has travel logged without an arrival.`, href: `/jobs/${job.jobId}#time-log`, rank: 0 });
    if (arrived && !workStarted) issues.push({ title: "Arrived but never started work", detail: `${employee.name} arrived today without a work start.`, href: `/jobs/${job.jobId}#time-log`, rank: 1 });
    if (workStarted && !finished && !closedStatuses.includes(job.status)) issues.push({ title: "Started work but never finished", detail: `${employee.name} has an open work session.`, href: `/jobs/${job.jobId}#time-log`, rank: 2 });
    if ((travelStarted || arrived || workStarted || finished) && !entries.some((entry) => mileageValue(entry) > 0)) issues.push({ title: "No mileage entered", detail: "Today has field activity with no mileage recorded.", href: `/jobs/${job.jobId}#time-log`, rank: 3 });
    if (needsCloseout(job, today) && markOnce(seenJobLevelIssues, `${job.jobId}-closeout`)) issues.push({ title: "Closeout incomplete", detail: closeoutDetail(job), href: closeoutHref(job), rank: 4 });
    if (job.status === "Needs Inspection" && markOnce(seenJobLevelIssues, `${job.jobId}-review`)) issues.push({ title: "Waiting on manager review", detail: "Job is ready for manager review today.", href: `/jobs/${job.jobId}#complete-job`, rank: 5 });

    return issues.map((issue, index) => ({
      ...issue,
      id: `${employee.name}-${job.jobId}-${issue.title}-${index}`,
      employee: employee.name,
      job,
    }));
  })).sort((a, b) => a.rank - b.rank || a.employee.localeCompare(b.employee) || a.job.jobId.localeCompare(b.job.jobId));
}

function isTodayJob(job: Job, today: string) {
  return job.dueDate === today || entriesForDate(job, today).length > 0 || hasTodayActivity(job, today);
}

function hasTodayActivity(job: Job, today: string) {
  return (job.activityLog || []).some((entry) => entry.createdAt?.slice(0, 10) === today);
}

function entriesForDate(job: Job, today: string) {
  return (job.timeEntries || []).filter((entry) => entry.createdAt?.slice(0, 10) === today);
}

function assignedEmployeeNames(job: Job) {
  if (!job.assignedCrew || job.assignedCrew === "Unassigned") return [];
  return job.assignedCrew.split(/,|&|\band\b/i).map((name) => name.trim()).filter(Boolean);
}

function isTravelStarted(entry: TimeEntry) {
  return entry.notes === "Started Travel";
}

function sameEmployee(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function mileageValue(entry: TimeEntry) {
  return Number(entry.mileage) || 0;
}

function needsCloseout(job: Job, today: string) {
  const closeoutDue = job.status === "Needs Inspection" || entriesForDate(job, today).some((entry) => entry.type === "Departed") || closedStatuses.includes(job.status);
  return closeoutDue && closeoutChecks(job).some((check) => !check.ok && ["Completion notes", "After photos", "Paperwork", "Completion sign-off", "Open parts"].includes(check.label));
}

function closeoutDetail(job: Job) {
  const blockers = closeoutChecks(job).filter((check) => !check.ok && ["Completion notes", "After photos", "Paperwork", "Completion sign-off", "Open parts"].includes(check.label));
  return blockers.length ? blockers.map((blocker) => blocker.label).join(", ") : "Closeout needs review.";
}

function closeoutHref(job: Job) {
  const blockers = closeoutChecks(job).filter((check) => !check.ok);
  if (blockers.some((blocker) => blocker.label === "After photos")) return `/jobs/${job.jobId}#photos`;
  if (blockers.some((blocker) => blocker.label === "Paperwork")) return `/jobs/${job.jobId}#paperwork`;
  return `/jobs/${job.jobId}#complete-job`;
}

function markOnce(seen: Set<string>, key: string) {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

function earliest(current: TimeEntry | undefined, next: TimeEntry | undefined) {
  if (!next) return current;
  if (!current) return next;
  return next.createdAt < current.createdAt ? next : current;
}

function latest(current: TimeEntry | undefined, next: TimeEntry | undefined) {
  if (!next) return current;
  if (!current) return next;
  return next.createdAt > current.createdAt ? next : current;
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";
}

function formatMiles(value: number) {
  return value.toFixed(1);
}

function formatToday(today: string) {
  return new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
