import Link from "next/link";
import { ArrowTopRightOnSquareIcon, CalendarDaysIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, MapPinIcon, PhoneIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/lib/types";
import { PriorityBadge, StatusBadge } from "./StatusBadge";

export function ScheduleBoard({ jobs }: { jobs: Job[] }) {
  const today = new Date();
  const todayKey = dateKey(today);
  const tomorrowKey = dateKey(addDays(today, 1));
  const weekEnd = addDays(today, 7);
  const active = jobs.filter((job) => !["Complete", "Billed", "Paid"].includes(job.status));
  const todayJobs = active.filter((job) => job.dueDate === todayKey);
  const tomorrowJobs = active.filter((job) => job.dueDate === tomorrowKey);
  const weekJobs = active.filter((job) => job.dueDate && job.dueDate > tomorrowKey && job.dueDate <= dateKey(weekEnd)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const unscheduled = active.filter((job) => !job.dueDate);
  const googleLinked = active.filter((job) => job.googleCalendarEventUrl).length;
  const calendarReady = active.filter((job) => job.dueDate && !job.googleCalendarEventUrl).length;
  const urgentUnscheduled = unscheduled.filter((job) => job.priority === "Urgent" || job.priority === "High");

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><CalendarDaysIcon className="size-7" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-lime">Schedule command</p>
          <h1 className="text-3xl font-black">Field schedule</h1>
          <p className="mt-1 text-sm text-white/55">Place real jobs, spot unscheduled work, and keep Google Calendar sync controlled.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <HeroMetric label="Today" value={todayJobs.length} />
        <HeroMetric label="Tomorrow" value={tomorrowJobs.length} />
        <HeroMetric label="Unscheduled" value={unscheduled.length} />
        <HeroMetric label="Calendar linked" value={googleLinked} />
        <HeroMetric label="Ready to add" value={calendarReady} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <a href="https://calendar.google.com" target="_blank" className="min-h-12 rounded-xl bg-lime px-4 py-3 text-center font-black text-ink">Open Google Calendar</a>
        <Link href="/ready-check" className="min-h-12 rounded-xl bg-white/10 px-4 py-3 text-center font-black text-white">Ready Check</Link>
        <Link href="/dispatch" className="min-h-12 rounded-xl bg-white/10 px-4 py-3 text-center font-black text-white">Dispatch Handoff</Link>
      </div>
    </section>

    <section className="grid gap-3 lg:grid-cols-3">
      <ScheduleAction href="/jobs/new" title="Add job and date" detail="Create a real customer job and set the due date from the form." icon={<CalendarDaysIcon />} />
      <ScheduleAction href="/jobs?status=New" title="Review new jobs" detail="Check new jobs before placing them on the schedule." icon={<ClockIcon />} />
      <ScheduleAction href="/settings" title="Calendar settings" detail="Google Calendar stays optional and explicit per real job." icon={<CheckCircleIcon />} />
    </section>

    {urgentUnscheduled.length > 0 && <section className="card border-orange-200 bg-orange-50 p-4">
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="mt-0.5 size-6 shrink-0 text-orange-800" />
        <div>
          <h2 className="font-black text-orange-950">Urgent or high-priority jobs need dates</h2>
          <p className="mt-1 text-sm font-semibold text-orange-900/70">{urgentUnscheduled.map((job) => `${job.jobId} ${job.customerName}`).join(", ")}</p>
        </div>
      </div>
    </section>}

    <div className="grid gap-5 xl:grid-cols-2">
      <ScheduleColumn title="Today" description={today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} jobs={todayJobs} urgent />
      <ScheduleColumn title="Tomorrow" description={addDays(today, 1).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} jobs={tomorrowJobs} />
      <ScheduleColumn title="Next 7 days" description="Upcoming active scheduled work" jobs={weekJobs} />
      <ScheduleColumn title="Needs scheduled" description="Active jobs with no due date" jobs={unscheduled} unscheduled />
    </div>
  </div>;
}

function ScheduleColumn({ title, description, jobs, urgent, unscheduled }: { title: string; description: string; jobs: Job[]; urgent?: boolean; unscheduled?: boolean }) {
  return <section className="card overflow-hidden">
    <div className={`p-4 ${urgent ? "bg-ink text-white" : unscheduled ? "bg-orange-50 text-orange-950" : "bg-sand"}`}>
      <h2 className="text-lg font-black">{title}</h2>
      <p className={`text-sm font-semibold ${urgent ? "text-white/55" : "text-black/45"}`}>{description}</p>
    </div>
    <div className="divide-y divide-black/5">
      {jobs.length ? jobs.map((job) => <ScheduleCard key={job.jobId} job={job} />) : <p className="p-6 text-center text-sm font-semibold text-black/35">No jobs in this lane.</p>}
    </div>
  </section>;
}

function ScheduleCard({ job }: { job: Job }) {
  const quickAdd = googleCalendarQuickAdd(job);
  return <div className="p-4">
    <Link href={`/jobs/${job.jobId}`} className="block">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.source}</p>
          <h3 className="mt-1 font-black">{job.customerName}</h3>
          <p className="mt-1 text-xs font-semibold text-black/45">{job.assignedCrew || "Unassigned"} · {job.jobType}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1"><StatusBadge status={job.status} /><PriorityBadge priority={job.priority} /></div>
      </div>
    </Link>
    <div className="mt-3 flex flex-wrap gap-2">
      <span className={`rounded-full px-3 py-1 text-xs font-black ${job.googleCalendarEventUrl ? "bg-emerald-100 text-emerald-900" : job.dueDate ? "bg-blue-100 text-blue-900" : "bg-orange-100 text-orange-900"}`}>{job.googleCalendarEventUrl ? "Google linked" : job.dueDate ? "Ready for calendar" : "Needs date"}</span>
      <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-black text-black/45">{job.dueDate ? formatDate(job.dueDate) : "No due date"}</span>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <a href={`tel:${job.phone}`} className={`min-h-10 rounded-lg px-2 py-2 text-center text-xs font-black ${job.phone ? "bg-forest text-white" : "pointer-events-none bg-black/5 text-black/25"}`}><PhoneIcon className="mx-auto mb-0.5 size-4" />Call</a>
      <a href={`https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city}`)}`} target="_blank" className="min-h-10 rounded-lg bg-ink px-2 py-2 text-center text-xs font-black text-white"><MapPinIcon className="mx-auto mb-0.5 size-4" />Map</a>
      <Link href={`/jobs/${job.jobId}#scheduling`} className="min-h-10 rounded-lg bg-sand px-2 py-2 text-center text-xs font-black text-forest"><ClockIcon className="mx-auto mb-0.5 size-4" />Edit date</Link>
      {job.googleCalendarEventUrl ? <a href={job.googleCalendarEventUrl} target="_blank" className="min-h-10 rounded-lg bg-emerald-100 px-2 py-2 text-center text-xs font-black text-emerald-900"><ArrowTopRightOnSquareIcon className="mx-auto mb-0.5 size-4" />Event</a> : <a href={quickAdd} target="_blank" className={`min-h-10 rounded-lg px-2 py-2 text-center text-xs font-black ${job.dueDate ? "bg-emerald-50 text-emerald-900" : "pointer-events-none bg-black/5 text-black/25"}`}><ArrowTopRightOnSquareIcon className="mx-auto mb-0.5 size-4" />Quick add</a>}
    </div>
  </div>;
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/10 p-4">
    <p className="text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-white/55">{label}</p>
  </div>;
}

function ScheduleAction({ href, title, detail, icon }: { href: string; title: string; detail: string; icon: React.ReactNode }) {
  return <Link href={href} className="card block p-4">
    <div className="mb-3 grid size-10 place-items-center rounded-xl bg-lime text-ink [&>svg]:size-5">{icon}</div>
    <h2 className="font-black">{title}</h2>
    <p className="mt-1 text-sm font-semibold text-black/45">{detail}</p>
  </Link>;
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

function googleCalendarQuickAdd(job: Job) {
  if (!job.dueDate) return "https://calendar.google.com";
  const calendarDate = new Date(`${job.dueDate}T12:00:00`);
  const end = new Date(calendarDate.getTime() + 86400000).toISOString().slice(0, 10).replaceAll("-", "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${job.jobId} — ${job.customerName} — ${job.jobType}`)}&dates=${job.dueDate.replaceAll("-", "")}/${end}&location=${encodeURIComponent(`${job.address}, ${job.city}, TX`)}&details=${encodeURIComponent(`Status: ${job.status}\nEmployees: ${job.assignedCrew}\nPriority: ${job.priority}\n\n${job.scopeNotes}`)}`;
}
