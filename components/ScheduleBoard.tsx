import Link from "next/link";
import { CalendarDaysIcon, MapPinIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/lib/types";
import { PriorityBadge, StatusBadge } from "./StatusBadge";

const closedStatuses = ["Complete", "Billed", "Paid"];

export function ScheduleBoard({ jobs }: { jobs: Job[] }) {
  const today = new Date();
  const todayKey = dateKey(today);
  const weekEndKey = dateKey(addDays(today, 6));
  const active = jobs.filter((job) => !closedStatuses.includes(job.status));
  const nextSevenDays = active.filter((job) => job.dueDate && job.dueDate >= todayKey && job.dueDate <= weekEndKey).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const unscheduled = active.filter((job) => !job.dueDate);

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><CalendarDaysIcon className="size-7" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-lime">Schedule command</p>
          <h1 className="text-3xl font-black">Monthly scheduling</h1>
          <p className="mt-1 text-sm text-white/55">Review active work, then open the real job form to schedule or adjust it.</p>
        </div>
      </div>
    </section>

    <div className="grid gap-5 xl:grid-cols-2">
      <ScheduleColumn title="Next 7 Days" description="Active jobs scheduled from today through the next six days" jobs={nextSevenDays} />
      <ScheduleColumn title="Needs Scheduling" description="Active jobs without a scheduled date" jobs={unscheduled} unscheduled />
    </div>

    <MonthlySchedule jobs={active} today={today} />
  </div>;
}

function ScheduleColumn({ title, description, jobs, unscheduled }: { title: string; description: string; jobs: Job[]; unscheduled?: boolean }) {
  return <section className="card overflow-hidden">
    <div className={`p-4 ${unscheduled ? "bg-orange-50 text-orange-950" : "bg-sand"}`}>
      <h2 className="text-lg font-black">{title}</h2>
      <p className="text-sm font-semibold text-black/45">{description}</p>
    </div>
    <div className="divide-y divide-black/5">
      {jobs.length ? jobs.map((job) => <ScheduleCard key={job.jobId} job={job} />) : <p className="p-6 text-center text-sm font-semibold text-black/35">No jobs in this lane.</p>}
    </div>
  </section>;
}

function ScheduleCard({ job }: { job: Job }) {
  return <Link href={`/jobs/${job.jobId}/edit`} className="block p-4 transition hover:bg-sand/60">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide text-forest">{job.dueDate ? formatDate(job.dueDate) : "Needs date"} · {job.jobId}</p>
        <h3 className="mt-1 truncate font-black">{job.customerName}</h3>
        <p className="mt-1 truncate text-xs font-semibold text-black/45">{job.assignedCrew || "Unassigned"} · {job.jobType || "Job"} · {job.city || "No city"}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1"><StatusBadge status={job.status} /><PriorityBadge priority={job.priority} /></div>
    </div>
    <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-forest"><MapPinIcon className="size-4" />{job.address || "Add address"}</p>
  </Link>;
}

function MonthlySchedule({ jobs, today }: { jobs: Job[]; today: Date }) {
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const todayKey = dateKey(today);
  const days = Array.from({ length: monthEnd.getDate() }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), index + 1);
    const key = dateKey(date);
    return { date, key, jobs: jobs.filter((job) => job.dueDate === key) };
  });

  return <section className="card overflow-hidden">
    <div className="border-b border-black/5 bg-sand p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{today.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
          <p className="mt-1 text-sm font-semibold text-black/45">Scheduled jobs use the same dates and assignments shown to employees.</p>
        </div>
        <Link href="/jobs?status=New" className="min-h-10 rounded-xl bg-ink px-3 py-2 text-center text-sm font-black text-white">Schedule a job</Link>
      </div>
    </div>
    <div className="p-2 sm:p-4">
      <div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-wide text-black/35">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-1">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: monthStart.getDay() }, (_, index) => <div key={`blank-${index}`} className="min-h-20 rounded-xl bg-black/[.02] sm:min-h-28" />)}
          {days.map(({ date, key, jobs: dayJobs }) => <CalendarDay key={key} date={date} dateKey={key} jobs={dayJobs} isToday={key === todayKey} />)}
        </div>
      </div>
    </div>
  </section>;
}

function CalendarDay({ date, dateKey: key, jobs, isToday }: { date: Date; dateKey: string; jobs: Job[]; isToday: boolean }) {
  const editHref = jobs[0] ? `/jobs/${jobs[0].jobId}/edit` : "/jobs?status=New";
  return <div className={`min-h-20 overflow-hidden rounded-xl border p-1 text-left sm:min-h-28 sm:p-1.5 ${isToday ? "border-forest bg-forest/5" : "border-black/5 bg-white"}`}>
    <Link href={editHref} aria-label={`Schedule work for ${formatDate(key)}`} className={`mb-1 block rounded px-1 text-xs font-black hover:bg-black/5 ${isToday ? "text-forest" : "text-black/45"}`}>{date.getDate()}</Link>
    <div className="space-y-1">
      {jobs.slice(0, 2).map((job) => <Link key={job.jobId} href={`/jobs/${job.jobId}/edit`} className="block truncate rounded-md bg-sand px-1 py-1 text-[9px] font-black text-ink hover:bg-lime sm:px-1.5 sm:text-[10px]" title={`${job.customerName} · ${job.assignedCrew || "Unassigned"}`}>{job.customerName}</Link>)}
      {jobs.length > 2 && <Link href={`/jobs/${jobs[0].jobId}/edit`} className="block rounded-md bg-black/5 px-1 py-1 text-[9px] font-black text-black/45 sm:px-1.5 sm:text-[10px]">+{jobs.length - 2}</Link>}
    </div>
  </div>;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  return date.toLocaleDateString("en-CA");
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
