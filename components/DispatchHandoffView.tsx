import Link from "next/link";
import { ExclamationTriangleIcon, MapPinIcon, PhoneIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { buildJobTasks, type JobTask } from "@/lib/job-tasks";
import type { Employee, Job } from "@/lib/types";
import { PriorityBadge, StatusBadge } from "./StatusBadge";

const activeStatuses = ["New", "Scheduled", "In Progress", "Waiting on Parts", "Needs Inspection"];

type HandoffRow = {
  id: string;
  job: Job;
  title: string;
  detail: string;
  reason: string;
  priority: "High" | "Normal" | "Low";
  href: string;
  suggestedEmployee?: Employee;
};

type DispatchWarning = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

export function DispatchHandoffView({ jobs, employees }: { jobs: Job[]; employees: Employee[] }) {
  const today = new Date().toLocaleDateString("en-CA");
  const activeJobs = jobs.filter((job) => activeStatuses.includes(job.status));
  const activeEmployees = employees.filter((employee) => employee.active);
  const loads = activeEmployees.map((employee) => {
    const assigned = activeJobs.filter((job) => isAssignedTo(job, employee));
    return { employee, assigned, todayJobs: assigned.filter((job) => job.dueDate === today) };
  }).sort((a, b) => a.todayJobs.length - b.todayJobs.length || a.assigned.length - b.assigned.length || a.employee.name.localeCompare(b.employee.name));
  const rows = buildDispatchRows(jobs, activeEmployees, loads, today).slice(0, 14);
  const warnings = buildDispatchWarnings(activeJobs, employees, loads, today);
  const unassigned = activeJobs.filter((job) => isUnassigned(job)).length;
  const unscheduled = activeJobs.filter((job) => !job.dueDate).length;
  const high = rows.filter((row) => row.priority === "High").length;

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><UserGroupIcon className="size-7" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-lime">Manager dispatch</p>
          <h1 className="text-3xl font-black">Dispatch Handoff</h1>
          <p className="mt-1 text-sm text-white/55">A practical handoff board for who should handle the next issue.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HeroMetric label="Handoff items" value={rows.length} />
        <HeroMetric label="High priority" value={high} />
        <HeroMetric label="Unassigned" value={unassigned} />
        <HeroMetric label="Unscheduled" value={unscheduled} />
      </div>
    </section>

    <section className="card overflow-hidden">
      <div className="flex items-start gap-3 bg-orange-50 p-4 text-orange-950">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100"><ExclamationTriangleIcon className="size-5" /></span>
        <div><h2 className="text-lg font-black">Today dispatch warnings</h2><p className="text-sm font-semibold text-orange-900/70">Confirmed assignment and workload gaps only.</p></div>
      </div>
      <div className="divide-y divide-black/5">
        {warnings.length ? warnings.map((warning) => <Link key={warning.id} href={warning.href} className="block p-4 hover:bg-black/[.02]"><h3 className="font-black">{warning.title}</h3><p className="mt-1 text-sm font-semibold text-black/50">{warning.detail}</p></Link>) : <p className="p-5 text-center text-sm font-semibold text-black/35">No confirmed dispatch warnings for today.</p>}
      </div>
    </section>

    <section className="grid gap-3 lg:grid-cols-[1.25fr_.75fr]">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 bg-sand p-4">
          <div><h2 className="text-lg font-black">Next handoffs</h2><p className="text-sm font-semibold text-black/45">Open the job edit screen to make or change the actual assignment.</p></div>
          <Link href="/crew" className="text-sm font-black text-forest">Crew board</Link>
        </div>
        <div className="divide-y divide-black/5">
          {rows.length ? rows.map((row) => <div key={row.id} className="p-4 hover:bg-black/[.02]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{row.job.jobId} · {row.job.customerName} · {row.job.city}</p>
                <h3 className="mt-1 font-black">{row.title}</h3>
                <p className="mt-1 text-sm font-semibold text-black/50">{row.detail}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${row.priority === "High" ? "bg-orange-100 text-orange-900" : row.priority === "Low" ? "bg-black/5 text-black/45" : "bg-blue-100 text-blue-900"}`}>{row.priority}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={row.job.status} />
              <PriorityBadge priority={row.job.priority} />
              <span className="rounded-full bg-sand px-3 py-1 text-xs font-black text-black/55">{row.reason}</span>
              <span className="rounded-full bg-lime px-3 py-1 text-xs font-black text-ink">Suggest: {row.suggestedEmployee?.name || "Add employee"}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
              <Link href={`/jobs/${row.job.jobId}/edit`} className="min-h-11 rounded-xl bg-forest px-3 py-2 text-center text-sm font-black text-white">Assign / edit</Link>
              <Link href={row.href} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm font-black text-ink">Open issue</Link>
              <Link href={`/jobs/${row.job.jobId}`} className="min-h-11 rounded-xl bg-sand px-3 py-2 text-center text-sm font-black text-ink">Open job</Link>
              {row.job.phone && <a href={`tel:${row.job.phone}`} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-white px-3 py-2 text-center text-sm font-black text-ink"><PhoneIcon className="size-4" />Call</a>}
              {(row.job.address || row.job.city) && <a href={`https://maps.google.com/?q=${encodeURIComponent(`${row.job.address}, ${row.job.city}`)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-ink px-3 py-2 text-center text-sm font-black text-white"><MapPinIcon className="size-4" />Map</a>}
              <Link href="/field" className="min-h-11 rounded-xl bg-ink px-3 py-2 text-center text-sm font-black text-white">Field view</Link>
            </div>
          </div>) : <p className="p-8 text-center text-sm font-semibold text-black/35">No dispatch handoffs right now.</p>}
        </div>
      </div>

      <div className="space-y-3">
        <section className="card overflow-hidden">
          <div className="bg-sand p-4"><h2 className="font-black">Employee load today</h2><p className="text-sm font-semibold text-black/45">Suggested handoffs favor the lightest today load.</p></div>
          <div className="divide-y divide-black/5">
            {loads.length ? loads.map(({ employee, assigned, todayJobs }) => <Link key={employee.id} href="/crew" className="flex items-center justify-between gap-3 p-4 hover:bg-black/[.02]">
              <div><p className="font-black">{employee.name}</p><p className="text-xs font-semibold text-black/45">{todayJobs.length} today · {assigned.length} active</p></div>
              <span className="grid size-10 place-items-center rounded-full bg-forest text-sm font-black text-white">{employee.name.slice(0, 2).toUpperCase()}</span>
            </Link>) : <p className="p-6 text-center text-sm font-semibold text-black/35">No active employees.</p>}
          </div>
        </section>
        <section className="card p-4">
          <div className="mb-3 grid size-10 place-items-center rounded-xl bg-orange-100 text-orange-900"><ExclamationTriangleIcon className="size-5" /></div>
          <h2 className="font-black">Simple rule</h2>
          <p className="mt-1 text-sm font-semibold text-black/50">This board recommends a handoff. It does not automatically reassign jobs, text employees, or add calendar events.</p>
        </section>
      </div>
    </section>
  </div>;
}

function buildDispatchWarnings(activeJobs: Job[], employees: Employee[], loads: Array<{ employee: Employee; assigned: Job[]; todayJobs: Job[] }>, today: string): DispatchWarning[] {
  const warnings: DispatchWarning[] = [];
  for (const job of activeJobs.filter((item) => item.dueDate === today && isUnassigned(item))) {
    warnings.push({ id: `${job.jobId}-unassigned-today`, title: `${job.customerName} needs an assignment`, detail: "Scheduled today with no employee or crew.", href: `/jobs/${job.jobId}` });
  }
  for (const load of loads.filter((item) => item.todayJobs.length === 0)) {
    warnings.push({ id: `${load.employee.id}-no-work-today`, title: `${load.employee.name} has no jobs today`, detail: "This active employee has no scheduled assignment today.", href: "/crew" });
  }
  for (const load of loads.filter((item) => item.todayJobs.length > 1)) {
    warnings.push({ id: `${load.employee.id}-multiple-jobs-today`, title: `${load.employee.name} has ${load.todayJobs.length} jobs today`, detail: "Review the schedule and travel plan before dispatch.", href: "/crew" });
  }
  const inactiveEmployees = employees.filter((employee) => !employee.active);
  for (const job of activeJobs.filter((item) => item.dueDate === today)) {
    const inactiveAssigned = inactiveEmployees.filter((employee) => job.assignedEmployeeIds?.includes(employee.id) || (!job.assignedEmployeeIds?.length && !job.fullCrew && job.assignedCrew === employee.name));
    if (inactiveAssigned.length) warnings.push({ id: `${job.jobId}-inactive-assignment`, title: `${job.customerName} has an inactive assignment`, detail: `${inactiveAssigned.map((employee) => employee.name).join(", ")} is inactive but assigned today.`, href: `/jobs/${job.jobId}` });
  }
  return warnings;
}

function buildDispatchRows(jobs: Job[], employees: Employee[], loads: Array<{ employee: Employee; assigned: Job[]; todayJobs: Job[] }>, today: string): HandoffRow[] {
  const tasks = buildJobTasks(jobs);
  const rows = tasks
    .filter((task) => ["Follow-up", "Urgent", "Parts", "Paperwork", "Photos", "Schedule", "Billing"].includes(task.category))
    .map((task) => taskToHandoff(task, employees, loads));
  const activeJobs = jobs.filter((job) => activeStatuses.includes(job.status));
  for (const job of activeJobs.filter((item) => isUnassigned(item))) {
    rows.push({
      id: `${job.jobId}-unassigned-handoff`,
      job,
      title: "Job needs an employee assignment",
      detail: `${job.status} · ${job.dueDate ? `Due ${formatDate(job.dueDate)}` : "Not scheduled"}`,
      reason: "Unassigned",
      priority: job.dueDate && job.dueDate <= today ? "High" : "Normal",
      href: `/jobs/${job.jobId}/edit`,
      suggestedEmployee: lightestEmployee(loads),
    });
  }
  return dedupeRows(rows).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || (a.job.dueDate || "9999-99-99").localeCompare(b.job.dueDate || "9999-99-99"));
}

function taskToHandoff(task: JobTask, employees: Employee[], loads: Array<{ employee: Employee; assigned: Job[]; todayJobs: Job[] }>): HandoffRow {
  return {
    id: `handoff-${task.id}`,
    job: task.job,
    title: task.title,
    detail: task.detail,
    reason: task.category,
    priority: task.priority,
    href: task.href,
    suggestedEmployee: currentOrLightest(task.job, employees, loads),
  };
}

function currentOrLightest(job: Job, employees: Employee[], loads: Array<{ employee: Employee; assigned: Job[]; todayJobs: Job[] }>) {
  const current = employees.find((employee) => isAssignedTo(job, employee));
  return current || lightestEmployee(loads);
}

function lightestEmployee(loads: Array<{ employee: Employee; assigned: Job[]; todayJobs: Job[] }>) {
  return loads[0]?.employee;
}

function isAssignedTo(job: Job, employee: Employee) {
  return Boolean(job.fullCrew || job.assignedEmployeeIds?.includes(employee.id) || (!job.assignedEmployeeIds?.length && job.assignedCrew === employee.name));
}

function isUnassigned(job: Job) {
  return !job.fullCrew && !job.assignedEmployeeIds?.length && (!job.assignedCrew || job.assignedCrew === "Unassigned");
}

function dedupeRows(rows: HandoffRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.job.jobId}-${row.reason}-${row.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function priorityRank(priority: HandoffRow["priority"]) {
  return priority === "High" ? 0 : priority === "Normal" ? 1 : 2;
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-white/55">{label}</p></div>;
}
