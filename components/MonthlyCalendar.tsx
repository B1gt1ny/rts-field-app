import Link from "next/link";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/lib/types";

const closedStatuses = ["Complete", "Billed", "Paid"];

export function MonthlyCalendar({ jobs, today = new Date() }: { jobs: Job[]; today?: Date }) {
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const todayKey = today.toLocaleDateString("en-CA");
  const leadingBlankDays = monthStart.getDay();
  const days = Array.from({ length: monthEnd.getDate() }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), index + 1);
    const key = date.toLocaleDateString("en-CA");
    return { date, key, jobs: jobs.filter((job) => job.dueDate === key) };
  });
  const linked = jobs.filter((job) => job.googleCalendarEventUrl).length;
  const activeJobs = jobs.filter((job) => !closedStatuses.includes(job.status));
  const upcomingJobs = activeJobs.filter((job) => job.dueDate && job.dueDate >= todayKey).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  const unscheduled = activeJobs.filter((job) => !job.dueDate).length;

  return <section className="card mb-8 p-4 sm:p-6">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><CalendarDaysIcon className="size-5 text-forest" /><h2 className="text-xl font-black">Monthly field calendar</h2></div>
        <p className="mt-1 text-sm text-black/45">Quick schedule view from job due dates. Google-linked jobs are marked.</p>
      </div>
      <a href="https://calendar.google.com" target="_blank" className="hidden min-h-10 items-center rounded-xl border border-black/10 bg-white px-3 text-sm font-black text-forest sm:inline-flex">Open Google Calendar</a>
    </div>
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="text-lg font-black">{today.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
      <div className="flex flex-wrap justify-end gap-2 text-xs font-black">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">{linked} Google-linked</span>
        <Link href="/schedule" className={`rounded-full px-3 py-1 ${unscheduled ? "bg-orange-100 text-orange-900" : "bg-black/5 text-black/45"}`}>{unscheduled} unscheduled</Link>
      </div>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-wide text-black/35">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-1">{day}</div>)}
    </div>
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: leadingBlankDays }, (_, index) => <div key={`blank-${index}`} className="min-h-20 rounded-xl bg-black/[.02]" />)}
      {days.map(({ date, key, jobs: dayJobs }) => {
        const isToday = key === todayKey;
        return <div key={key} className={`min-h-20 rounded-xl border p-1.5 text-left ${isToday ? "border-forest bg-forest/5" : "border-black/5 bg-sand"}`}>
          <p className={`mb-1 text-xs font-black ${isToday ? "text-forest" : "text-black/45"}`}>{date.getDate()}</p>
          <div className="space-y-1">
            {dayJobs.slice(0, 2).map((job) => <Link key={job.jobId} href={`/jobs/${job.jobId}`} className={`block truncate rounded-md px-1.5 py-1 text-[10px] font-black ${job.googleCalendarEventUrl ? "bg-emerald-100 text-emerald-900" : "bg-white text-ink"}`}>{job.googleCalendarEventUrl ? "G " : ""}{job.customerName}</Link>)}
            {dayJobs.length > 2 && <Link href={`/jobs?date=${key}`} className="block rounded-md bg-black/5 px-1.5 py-1 text-[10px] font-black text-black/45">+{dayJobs.length - 2} more</Link>}
          </div>
        </div>;
      })}
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-2xl bg-sand p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h3 className="font-black">Next scheduled work</h3><p className="text-xs font-semibold text-black/45">Active jobs coming up from today forward</p></div>
          <Link href="/schedule" className="text-xs font-black text-forest">Schedule board</Link>
        </div>
        <div className="space-y-2">
          {upcomingJobs.length ? upcomingJobs.map((job) => <Link key={job.jobId} href={`/jobs/${job.jobId}`} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{job.customerName}</p>
              <p className="truncate text-xs font-semibold text-black/45">{job.jobId} · {job.city} · {job.assignedCrew || "Unassigned"}</p>
            </div>
            <span className="shrink-0 rounded-full bg-forest/10 px-3 py-1 text-xs font-black text-forest">{new Date(`${job.dueDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          </Link>) : <p className="rounded-xl bg-white p-4 text-center text-sm font-semibold text-black/35">No upcoming scheduled jobs.</p>}
        </div>
      </div>
      <div className="rounded-2xl bg-ink p-4 text-white">
        <p className="text-xs font-black uppercase tracking-widest text-lime">Calendar connection</p>
        <h3 className="mt-1 text-2xl font-black">{linked ? `${linked} linked` : "Not linked yet"}</h3>
        <p className="mt-1 text-sm text-white/55">Jobs only go to Google Calendar when you choose “Add this job to my Google Calendar” on a real job.</p>
        <div className="mt-4 grid gap-2">
          <a href="https://calendar.google.com" target="_blank" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-lime px-4 py-3 text-sm font-black text-ink">Open Google Calendar</a>
          <Link href="/settings" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white">Calendar settings</Link>
        </div>
      </div>
    </div>
    <a href="https://calendar.google.com" target="_blank" className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-3 font-black text-forest sm:hidden">Open Google Calendar</a>
  </section>;
}
