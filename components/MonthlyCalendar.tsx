import Link from "next/link";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/lib/types";
import { calendarJobStyle } from "@/lib/job-colors";

const closedStatuses = ["Complete", "Billed", "Paid"];

export function MonthlyCalendar({ jobs, today = new Date() }: { jobs: Job[]; today?: Date }) {
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const todayKey = today.toLocaleDateString("en-CA");
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());
  const calendarEnd = new Date(monthEnd);
  calendarEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));
  const dayCount = Math.round((calendarEnd.getTime() - calendarStart.getTime()) / 86400000) + 1;
  const activeJobs = jobs.filter((job) => !closedStatuses.includes(job.status));
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    const key = date.toLocaleDateString("en-CA");
    return { date, key, isCurrentMonth: date.getMonth() === today.getMonth(), jobs: activeJobs.filter((job) => job.dueDate === key).sort(compareScheduledJobs) };
  });
  const linked = jobs.filter((job) => job.dueDate).length;
  const upcomingJobs = activeJobs.filter((job) => job.dueDate && job.dueDate >= todayKey).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  const unscheduled = activeJobs.filter((job) => !job.dueDate).length;

  return <section className="card overflow-hidden">
    <div className="mb-4 flex items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-6">
      <div>
        <div className="flex items-center gap-2"><CalendarDaysIcon className="size-5 text-accent" /><h2 className="text-xl font-bold">Monthly field calendar</h2></div>
        <p className="mt-1 text-sm text-content/65">Quick schedule view from job due dates. Due-dated jobs appear in the RTS calendar feed.</p>
      </div>
      <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="action-contrast hidden min-h-11 items-center rounded-xl border px-3 text-sm font-bold sm:inline-flex">Open Google Calendar</a>
    </div>
    <div className="mb-3 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-6">
      <p className="text-lg font-bold">{today.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
      <div className="flex flex-wrap justify-end gap-2 text-xs font-bold">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">{linked} in RTS feed</span>
        <Link href="/schedule" className={`rounded-full px-3 py-1 ${unscheduled ? "bg-orange-100 text-orange-900" : "bg-content/5 text-content/65"}`}>{unscheduled} unscheduled</Link>
      </div>
    </div>
    <div className="grid grid-cols-7 gap-px px-0 text-center text-[10px] font-bold uppercase tracking-wide text-content/65">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-1">{day}</div>)}
    </div>
    <div className="grid grid-cols-7 gap-px">
      {days.map(({ date, key, isCurrentMonth, jobs: dayJobs }) => {
        const isToday = key === todayKey;
        return <div key={key} className={`min-w-0 min-h-20 overflow-hidden border p-1 text-left sm:min-h-24 sm:p-1.5 ${isToday ? "border-forest bg-forest/5" : isCurrentMonth ? "border-content/5 bg-surface" : "border-content/5 bg-content/[.025]"}`}>
          <p className={`mb-1 text-[10px] font-bold sm:text-xs ${isToday ? "text-accent" : isCurrentMonth ? "text-content/65" : "text-content/65"}`}>{date.getDate()}</p>
          <div className="space-y-0.5">
            {dayJobs.slice(0, 2).map((job) => <Link key={job.jobId} href={`/jobs/${job.jobId}`} className="block min-h-6 min-w-0 max-w-full truncate rounded px-1 py-0.5 text-[9px] font-bold leading-tight text-white shadow-sm hover:brightness-95 sm:text-[10px]" style={calendarJobStyle(job)} title={`${job.customerName} · ${job.assignedCrew || "Unassigned"} · ${job.schedulePlan || "Confirmed"}`}>{job.customerName}</Link>)}
            {dayJobs.length > 2 && <Link href={`/schedule`} className="block rounded bg-content/5 px-1 py-0.5 text-[9px] font-bold text-content/65 sm:text-[10px]">+{dayJobs.length - 2} more</Link>}
          </div>
        </div>;
      })}
    </div>
    <div className="mb-4 mt-4 grid gap-3 px-4 sm:px-6 lg:grid-cols-[1.2fr_.8fr] lg:px-6">
      <div className="rounded-2xl bg-sand p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h3 className="font-bold">Next scheduled work</h3><p className="text-xs font-semibold text-content/65">Active jobs coming up from today forward</p></div>
          <Link href="/schedule" className="text-xs font-bold text-accent">Schedule board</Link>
        </div>
        <div className="space-y-2">
          {upcomingJobs.length ? upcomingJobs.map((job) => <Link key={job.jobId} href={`/jobs/${job.jobId}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{job.customerName}</p>
              <p className="truncate text-xs font-semibold text-content/65">{job.jobId} · {job.city} · {job.assignedCrew || "Unassigned"}</p>
            </div>
            <span className="shrink-0 rounded-full bg-forest/10 px-3 py-1 text-xs font-bold text-accent">{new Date(`${job.dueDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          </Link>) : <p className="rounded-xl bg-surface p-4 text-center text-sm font-semibold text-content/65">No upcoming scheduled jobs.</p>}
        </div>
      </div>
      <div className="rounded-2xl bg-ink p-4 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-lime">Calendar connection</p>
        <h3 className="mt-1 text-2xl font-bold">{linked ? `${linked} in RTS feed` : "No dated jobs"}</h3>
        <p className="mt-1 text-sm text-white/65">Due-dated RTS jobs appear in the subscription feed. RTS remains the source of truth.</p>
        <div className="mt-4 grid gap-2">
          <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="action-contrast inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-3 text-sm font-bold">Open Google Calendar</a>
          <Link href="/settings" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white">Calendar settings</Link>
        </div>
      </div>
    </div>
    <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="action-contrast mx-4 mb-4 mt-4 inline-flex min-h-12 w-[calc(100%-2rem)] items-center justify-center rounded-xl border px-4 py-3 font-bold sm:hidden">Open Google Calendar</a>
  </section>;
}

function compareScheduledJobs(a: Job, b: Job) {
  return `${a.dueDate}T${a.scheduledTime || "99:99"}`.localeCompare(`${b.dueDate}T${b.scheduledTime || "99:99"}`);
}
