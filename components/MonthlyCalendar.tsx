import Link from "next/link";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/lib/types";

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
  const linked = jobs.filter((job) => job.googleCalendarEventUrl).length;
  const upcomingJobs = activeJobs.filter((job) => job.dueDate && job.dueDate >= todayKey).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  const unscheduled = activeJobs.filter((job) => !job.dueDate).length;

  return <section className="-mx-4 mb-8 overflow-hidden bg-white sm:-mx-4 lg:-mx-8">
    <div className="mb-4 flex items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div>
        <div className="flex items-center gap-2"><CalendarDaysIcon className="size-5 text-forest" /><h2 className="text-xl font-black">Monthly field calendar</h2></div>
        <p className="mt-1 text-sm text-black/45">Quick schedule view from job due dates. Google-linked jobs are marked.</p>
      </div>
      <a href="https://calendar.google.com" target="_blank" className="hidden min-h-10 items-center rounded-xl border border-black/10 bg-white px-3 text-sm font-black text-forest sm:inline-flex">Open Google Calendar</a>
    </div>
    <div className="mb-3 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
      <p className="text-lg font-black">{today.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
      <div className="flex flex-wrap justify-end gap-2 text-xs font-black">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">{linked} Google-linked</span>
        <Link href="/schedule" className={`rounded-full px-3 py-1 ${unscheduled ? "bg-orange-100 text-orange-900" : "bg-black/5 text-black/45"}`}>{unscheduled} unscheduled</Link>
      </div>
    </div>
    <div className="grid grid-cols-7 gap-px px-0 text-center text-[10px] font-black uppercase tracking-wide text-black/35">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-1">{day}</div>)}
    </div>
    <div className="grid grid-cols-7 gap-px">
      {days.map(({ date, key, isCurrentMonth, jobs: dayJobs }) => {
        const isToday = key === todayKey;
        return <div key={key} className={`min-w-0 min-h-20 overflow-hidden border p-1 text-left sm:min-h-24 sm:p-1.5 ${isToday ? "border-forest bg-forest/5" : isCurrentMonth ? "border-black/5 bg-white" : "border-black/5 bg-black/[.025]"}`}>
          <p className={`mb-1 text-[10px] font-black sm:text-xs ${isToday ? "text-forest" : isCurrentMonth ? "text-black/45" : "text-black/25"}`}>{date.getDate()}</p>
          <div className="space-y-0.5">
            {dayJobs.slice(0, 2).map((job) => <Link key={job.jobId} href={`/jobs/${job.jobId}`} className="block min-w-0 max-w-full truncate rounded px-1 py-0.5 text-[9px] font-black leading-tight text-white shadow-sm hover:brightness-95 sm:text-[10px]" style={calendarCrewStyle(job)} title={`${job.customerName} · ${job.assignedCrew || "Unassigned"} · ${job.schedulePlan || "Confirmed"}`}>{job.customerName}</Link>)}
            {dayJobs.length > 2 && <Link href={`/schedule`} className="block rounded bg-black/5 px-1 py-0.5 text-[9px] font-black text-black/45 sm:text-[10px]">+{dayJobs.length - 2} more</Link>}
          </div>
        </div>;
      })}
    </div>
    <div className="mt-4 grid gap-3 px-4 sm:px-6 lg:grid-cols-[1.2fr_.8fr] lg:px-8">
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
    <a href="https://calendar.google.com" target="_blank" className="mx-4 mb-4 mt-4 inline-flex min-h-12 w-[calc(100%-2rem)] items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-3 font-black text-forest sm:hidden">Open Google Calendar</a>
  </section>;
}

function calendarCrewStyle(job: Job) {
  const colors = ["#0f766e", "#2563eb", "#7c3aed", "#c2410c", "#be123c", "#0369a1", "#4d7c0f"];
  const label = job.assignedCrew?.trim() && job.assignedCrew !== "Unassigned" ? job.assignedCrew : "Unassigned";
  const hash = Array.from(label).reduce((total, character) => total + character.charCodeAt(0), 0);
  const color = label === "Unassigned" ? "#6b7280" : colors[hash % colors.length];
  return job.schedulePlan === "Tentative"
    ? { backgroundColor: color, backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.35) 0 4px, transparent 4px 8px)" }
    : { backgroundColor: color };
}

function compareScheduledJobs(a: Job, b: Job) {
  return `${a.dueDate}T${a.scheduledTime || "99:99"}`.localeCompare(`${b.dueDate}T${b.scheduledTime || "99:99"}`);
}
