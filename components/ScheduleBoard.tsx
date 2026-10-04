"use client";

import Link from "next/link";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, MapPinIcon, PhoneIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import type { Job } from "@/lib/types";
import { authFetch, jobUpdateBody } from "@/lib/client-auth";
import { intakeCompleteness, type ReadinessCheck } from "@/lib/job-readiness";
import { closedJobStatuses } from "@/lib/field-activity";
import { PriorityBadge, StatusBadge } from "./StatusBadge";
import { calendarJobStyle } from "@/lib/job-colors";

export function ScheduleBoard({ jobs, canEditSchedule }: { jobs: Job[]; canEditSchedule: boolean }) {
  const [scheduleJobs, setScheduleJobs] = useState(jobs);
  const today = new Date();
  const todayKey = dateKey(today);
  const weekEndKey = dateKey(addDays(today, 6));
  const active = scheduleJobs.filter((job) => !closedJobStatuses.includes(job.status));
  const nextSevenDays = active.filter((job) => job.dueDate && job.dueDate >= todayKey && job.dueDate <= weekEndKey).sort(compareScheduledJobs);
  const unscheduled = active.filter((job) => !job.dueDate);

  async function scheduleJob(jobId: string, dueDate: string, scheduledTime = "", schedulePlan: Job["schedulePlan"] = "Confirmed") {
    const response = await authFetch(`/api/jobs/${jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: jobUpdateBody(scheduleJobs.find((job) => job.jobId === jobId) || {}, { dueDate, scheduledTime, schedulePlan }) });
    const saved = await response.json();
    if (!response.ok) throw new Error(saved.error || "The job could not be scheduled.");
    setScheduleJobs((current) => current.map((job) => job.jobId === jobId ? { ...job, ...saved } : job));
  }

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="rounded-2xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><CalendarDaysIcon className="size-7" /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-lime">Schedule command</p>
          <h1 className="text-3xl font-bold">Monthly scheduling</h1>
          {!canEditSchedule && <p className="mt-2 inline-flex rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-lime">Read-only schedule</p>}
          <p className="mt-1 text-sm text-white/65">{canEditSchedule ? "Review active work, then open the real job form to schedule or adjust it." : "Review your assigned work. Schedule changes are managed by your dispatcher."}</p>
        </div>
      </div>
    </section>

    <div className="grid gap-5 xl:grid-cols-2">
      <ScheduleColumn title="Next 7 Days" description="Active jobs scheduled from today through the next six days" jobs={nextSevenDays} canEditSchedule={canEditSchedule} />
      <ScheduleColumn title="Needs Scheduling" description="Active jobs without a scheduled date" jobs={unscheduled} unscheduled canEditSchedule={canEditSchedule} />
    </div>

    <MonthlySchedule jobs={active} unscheduledJobs={unscheduled} today={today} onSchedule={scheduleJob} canEditSchedule={canEditSchedule} />
  </div>;
}

function ScheduleColumn({ title, description, jobs, unscheduled, canEditSchedule }: { title: string; description: string; jobs: Job[]; unscheduled?: boolean; canEditSchedule: boolean }) {
  const unscheduledIntake = unscheduled ? jobs.map((job) => {
    const missing = intakeCompleteness(job).core.filter((check) => !check.ok);
    return { job, missing };
  }) : [];
  const readyToSchedule = unscheduledIntake.filter(({ missing }) => missing.length === 0).map(({ job }) => job);
  const needsInformation = unscheduledIntake.filter(({ missing }) => missing.length > 0);

  return <section className="card overflow-hidden">
    <div className={`p-4 ${unscheduled ? "bg-orange-50 text-orange-950" : "bg-sand"}`}>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm font-semibold text-content/65">{description}</p>
    </div>
    <div className="divide-y divide-content/5">
      {!jobs.length ? <p className="p-6 text-center text-sm font-semibold text-content/65">No jobs in this lane.</p> : unscheduled ? <>
        {readyToSchedule.length > 0 && <div className="divide-y divide-content/5">
          <p className="bg-sand px-4 py-2 text-xs font-bold uppercase tracking-wide text-accent">Ready to Schedule</p>
          {readyToSchedule.map((job) => <ScheduleCard key={job.jobId} job={job} canEditSchedule={canEditSchedule} />)}
        </div>}
        {needsInformation.length > 0 && <div className="divide-y divide-content/5">
          <p className="bg-orange-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-orange-900">Needs Information</p>
          {needsInformation.map(({ job, missing }) => <ScheduleCard key={job.jobId} job={job} missingCoreChecks={missing} canEditSchedule={canEditSchedule} />)}
        </div>}
      </> : jobs.map((job) => <ScheduleCard key={job.jobId} job={job} canEditSchedule={canEditSchedule} />)}
    </div>
  </section>;
}

function ScheduleCard({ job, missingCoreChecks, canEditSchedule }: { job: Job; missingCoreChecks?: ReadinessCheck[]; canEditSchedule: boolean }) {
  return <Link href={canEditSchedule ? `/jobs/${job.jobId}/edit` : `/jobs/${job.jobId}`} className="block p-4 transition hover:bg-sand/60">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-accent">{job.dueDate ? formatSchedule(job) : "Needs date"} · {job.jobId}</p>
        <h3 className="mt-1 truncate font-bold">{job.customerName}</h3>
        <p className="mt-1 truncate text-xs font-semibold text-content/65">{job.assignedCrew || "Unassigned"} · {job.jobType || "Job"} · {job.city || "No city"}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1"><StatusBadge status={job.status} /><PriorityBadge priority={job.priority} /></div>
    </div>
    <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-accent"><MapPinIcon className="size-4" />{job.address || "Add address"}</p>
    {missingCoreChecks && <div className="mt-3">
      <p className="text-xs font-bold text-orange-900">Needs Information · {missingCoreChecks.length}</p>
      <p className="mt-1 text-xs font-semibold text-content/65">{missingCoreChecks.slice(0, 3).map((check) => check.label).join(" · ")}</p>
      <span className="mt-2 inline-block text-xs font-bold text-accent">{canEditSchedule ? "Edit job" : "Open job"} →</span>
    </div>}
  </Link>;
}

function MonthlySchedule({ jobs, unscheduledJobs, today, onSchedule, canEditSchedule }: { jobs: Job[]; unscheduledJobs: Job[]; today: Date; onSchedule: (jobId: string, dueDate: string, scheduledTime?: string, schedulePlan?: Job["schedulePlan"]) => Promise<void>; canEditSchedule: boolean }) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [crewFilter, setCrewFilter] = useState("All");
  const [jobTypeFilter, setJobTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedScheduledTime, setSelectedScheduledTime] = useState("");
  const [selectedSchedulePlan, setSelectedSchedulePlan] = useState<Job["schedulePlan"]>("Confirmed");
  const [selectedEventJobId, setSelectedEventJobId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  const todayKey = dateKey(today);
  const crews = Array.from(new Set(jobs.map((job) => job.assignedCrew || "Unassigned").filter(Boolean))).sort();
  const jobTypes = Array.from(new Set(jobs.map((job) => job.jobType || "Job").filter(Boolean))).sort();
  const statuses = Array.from(new Set(jobs.map((job) => job.status))).sort();
  const calendarJobs = jobs.filter((job) =>
    (crewFilter === "All" || (job.assignedCrew || "Unassigned") === crewFilter)
    && (jobTypeFilter === "All" || (job.jobType || "Job") === jobTypeFilter)
    && (statusFilter === "All" || job.status === statusFilter),
  );
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());
  const calendarEnd = new Date(monthEnd);
  calendarEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));
  const dayCount = Math.round((calendarEnd.getTime() - calendarStart.getTime()) / 86400000) + 1;
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(calendarStart, index);
    const key = dateKey(date);
    return { date, key, isCurrentMonth: date.getMonth() === visibleMonth.getMonth(), jobs: calendarJobs.filter((job) => job.dueDate === key).sort(compareScheduledJobs) };
  });
  const schedulingChoices = [...unscheduledJobs, ...jobs.filter((job) => Boolean(job.dueDate))];
  const selectedEventJob = calendarJobs.find((job) => job.jobId === selectedEventJobId);

  function openScheduler(date: string) {
    setSelectedDate(date);
    setSelectedJobId(schedulingChoices[0]?.jobId || "");
    setSelectedScheduledTime(schedulingChoices[0]?.scheduledTime || "");
    setSelectedSchedulePlan(schedulingChoices[0]?.schedulePlan || "Confirmed");
    setError("");
  }

  function openEvent(job: Job) {
    setSelectedEventJobId(job.jobId);
    setSelectedDate("");
    setError("");
  }

  async function saveSchedule() {
    if (!selectedDate || !selectedJobId) return;
    setSaving(true);
    setError("");
    try {
      await onSchedule(selectedJobId, selectedDate, selectedScheduledTime, selectedSchedulePlan);
      setSelectedDate("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The job could not be scheduled.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="card overflow-hidden">
    <div className="border-b border-content/5 bg-sand px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
          <p className="mt-1 hidden text-sm font-semibold text-content/65 sm:block">Scheduled jobs use the same dates and assignments shown to employees.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid size-11 place-items-center rounded-lg border border-content/10 bg-surface text-content hover:bg-content/5" aria-label="Previous month"><ChevronLeftIcon className="size-4" /></button>
          <button type="button" onClick={() => setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))} className="min-h-11 rounded-lg border border-content/10 bg-surface px-2 text-xs font-bold text-content hover:bg-content/5">Today</button>
          <button type="button" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid size-11 place-items-center rounded-lg border border-content/10 bg-surface text-content hover:bg-content/5" aria-label="Next month"><ChevronRightIcon className="size-4" /></button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <CalendarFilter label="Crew" value={crewFilter} options={crews} onChange={setCrewFilter} />
        <CalendarFilter label="Job type" value={jobTypeFilter} options={jobTypes} onChange={setJobTypeFilter} />
        <CalendarFilter label="Status" value={statusFilter} options={statuses} onChange={setStatusFilter} />
      </div>
    </div>
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-0">
        <div className="grid grid-cols-7 gap-px text-center text-xs font-bold uppercase tracking-wide text-content/65">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-1">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-px">
          {days.map(({ date, key, isCurrentMonth, jobs: dayJobs }) => <CalendarDay key={key} date={date} dateKey={key} jobs={dayJobs} isToday={key === todayKey} isCurrentMonth={isCurrentMonth} onSelectDate={canEditSchedule ? openScheduler : undefined} onSelectEvent={openEvent} />)}
        </div>
        </div>
      </div>
    </div>
    {selectedEventJob && <CalendarEventPanel key={selectedEventJob.jobId} job={selectedEventJob} saving={saving} error={error} canEditSchedule={canEditSchedule} onClose={() => setSelectedEventJobId("")} onScheduleChange={async (dueDate, scheduledTime, schedulePlan) => {
      setSaving(true);
      setError("");
      try {
        await onSchedule(selectedEventJob.jobId, dueDate, scheduledTime, schedulePlan);
        setSelectedEventJobId("");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The job date could not be updated.");
      } finally {
        setSaving(false);
      }
    }} />}
    {canEditSchedule && selectedDate && <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-3 sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="schedule-date-title">
      <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-widest text-accent">Schedule job</p><h3 id="schedule-date-title" className="mt-1 text-xl font-bold">{formatDate(selectedDate)}</h3></div>
          <button type="button" onClick={() => setSelectedDate("")} disabled={saving} className="min-h-11 rounded-lg px-3 text-sm font-bold text-content/65 hover:bg-content/5">Cancel</button>
        </div>
        {schedulingChoices.length ? <>
          <label className="mt-4 block text-sm font-bold" htmlFor="schedule-job">Active job</label>
          <select id="schedule-job" value={selectedJobId} onChange={(event) => { const job = schedulingChoices.find((item) => item.jobId === event.target.value); setSelectedJobId(event.target.value); setSelectedScheduledTime(job?.scheduledTime || ""); setSelectedSchedulePlan(job?.schedulePlan || "Confirmed"); }} className="mt-1 min-h-12 w-full rounded-xl border border-content/10 bg-surface px-3 font-bold text-content">
            {schedulingChoices.map((job) => <option key={job.jobId} value={job.jobId}>{job.dueDate ? "Move" : "Needs scheduling"} · {job.customerName} · {job.jobId}</option>)}
          </select>
          <label className="mt-3 block text-sm font-bold" htmlFor="schedule-time">Time / All Day</label>
          <div className="mt-1 flex gap-2"><input id="schedule-time" type="time" value={selectedScheduledTime} onChange={(event) => setSelectedScheduledTime(event.target.value)} className="min-h-12 min-w-0 flex-1 rounded-xl border border-content/10 bg-surface px-3 font-bold text-content" /><button type="button" onClick={() => setSelectedScheduledTime("")} className="min-h-12 shrink-0 rounded-xl border border-content/10 bg-surface px-3 text-sm font-bold text-content">All Day</button></div>
          <label className="mt-3 block text-sm font-bold" htmlFor="schedule-plan">Calendar plan<select id="schedule-plan" value={selectedSchedulePlan || "Confirmed"} onChange={(event) => setSelectedSchedulePlan(event.target.value as Job["schedulePlan"])} className="mt-1 min-h-12 w-full rounded-xl border border-content/10 bg-surface px-3 font-bold text-content"><option value="Confirmed">Confirmed — solid color</option><option value="Tentative">Tentative — striped color</option></select></label>
          <p className="mt-2 text-xs font-semibold text-content/65">Jobs needing scheduling are listed first. Crew and other job details stay unchanged.</p>
          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
          <button type="button" onClick={saveSchedule} disabled={saving || !selectedJobId} className="mt-4 min-h-12 w-full rounded-xl bg-forest px-4 py-3 font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Schedule on this date"}</button>
        </> : <p className="mt-4 rounded-xl bg-sand p-3 text-sm font-semibold text-content/65">No active jobs are available to schedule.</p>}
      </div>
    </div>}
  </section>;
}

function CalendarFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="text-xs font-bold text-content/65"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-lg border border-content/10 bg-surface px-3 text-sm font-bold text-content"><option value="All">{label}: All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function CalendarDay({ date, dateKey: key, jobs, isToday, isCurrentMonth, onSelectDate, onSelectEvent }: { date: Date; dateKey: string; jobs: Job[]; isToday: boolean; isCurrentMonth: boolean; onSelectDate?: (date: string) => void; onSelectEvent: (job: Job) => void }) {
  const [showAll, setShowAll] = useState(false);
  const visibleJobs = showAll ? jobs : jobs.slice(0, 2);
  return <div className={`min-w-0 min-h-24 overflow-hidden border p-1 sm:p-1.5 text-left ${isToday ? "border-forest bg-forest/5" : isCurrentMonth ? "border-content/5 bg-surface" : "border-content/5 bg-content/[.025]"}`}>
    {onSelectDate ? <button type="button" onClick={() => onSelectDate(key)} aria-label={`Schedule work for ${formatDate(key)}`} className={`mb-1 min-h-8 w-full rounded px-0.5 text-xs font-bold hover:bg-content/5 ${isToday ? "text-accent" : isCurrentMonth ? "text-content/65" : "text-content/65"}`}>{date.getDate()}</button> : <span className={`mb-1 block px-0.5 text-xs font-bold ${isToday ? "text-accent" : isCurrentMonth ? "text-content/65" : "text-content/65"}`}>{date.getDate()}</span>}
    <div className="space-y-0.5">
      {visibleJobs.map((job) => <button key={job.jobId} type="button" onClick={() => onSelectEvent(job)} className="block min-h-8 w-full min-w-0 max-w-full truncate rounded px-1 py-1 text-left text-[9px] font-bold leading-tight text-white sm:text-xs shadow-sm hover:brightness-95" style={calendarJobStyle(job)} title={`${job.customerName} · ${job.assignedCrew || "Unassigned"} · ${job.schedulePlan || "Confirmed"}`}>{job.customerName}</button>)}
      {jobs.length > 2 && <button type="button" onClick={() => setShowAll((expanded) => !expanded)} className="block min-h-8 w-full max-w-full truncate rounded bg-content/5 px-1 py-1 text-left text-xs font-bold leading-tight text-content/65 hover:bg-content/10">{showAll ? "Show less" : `+${jobs.length - 2} more`}</button>}
    </div>
  </div>;
}

function CalendarEventPanel({ job, saving, error, onClose, onScheduleChange, canEditSchedule }: { job: Job; saving: boolean; error: string; onClose: () => void; onScheduleChange: (dueDate: string, scheduledTime: string, schedulePlan: Job["schedulePlan"]) => Promise<void>; canEditSchedule: boolean }) {
  const [dueDate, setDueDate] = useState(job.dueDate);
  const [scheduledTime, setScheduledTime] = useState(job.scheduledTime || "");
  const [schedulePlan, setSchedulePlan] = useState<Job["schedulePlan"]>(job.schedulePlan || "Confirmed");
  const changed = dueDate !== job.dueDate || scheduledTime !== (job.scheduledTime || "") || schedulePlan !== (job.schedulePlan || "Confirmed");

  return <section className="border-t border-content/5 bg-surface p-4 sm:p-5" aria-live="polite">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="truncate text-lg font-bold">{job.customerName}</h3><p className="mt-1 text-sm font-semibold text-content/65">{job.jobType || "Job"} · {job.jobId}</p></div>
      <button type="button" onClick={onClose} disabled={saving} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-bold text-content/65 hover:bg-content/5">Close</button>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <p className="min-w-0 rounded-xl bg-sand p-3"><span className="block text-xs font-bold uppercase tracking-wide text-content/65">Date</span><span className="mt-1 block truncate font-bold">{formatDate(job.dueDate)}</span></p>
      <p className="min-w-0 rounded-xl bg-sand p-3"><span className="block text-xs font-bold uppercase tracking-wide text-content/65">Time / All Day</span><span className="mt-1 block truncate font-bold">{formatTimeOrAllDay(job.scheduledTime)}</span></p>
      <p className="min-w-0 rounded-xl bg-sand p-3"><span className="block text-xs font-bold uppercase tracking-wide text-content/65">Crew</span><span className="mt-1 block truncate font-bold">{job.assignedCrew || "Unassigned"}</span></p>
      <p className="min-w-0 rounded-xl bg-sand p-3"><span className="block text-xs font-bold uppercase tracking-wide text-content/65">Calendar</span><span className="mt-1 block font-bold">{job.schedulePlan || "Confirmed"}</span></p>
    </div>
    <p className="mt-2 truncate text-sm font-semibold text-content/65">{shortAddress(job.address) || job.city || "Address not set"}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <Link href={`/jobs/${job.jobId}`} className="min-h-11 rounded-xl bg-forest px-3 py-2 text-sm font-bold text-white">Open Job</Link>
      {canEditSchedule && <Link href={`/jobs/${job.jobId}/edit`} className="min-h-11 rounded-xl border border-content/10 bg-surface px-3 py-2 text-sm font-bold text-content">Edit Job</Link>}
      <a href={`https://maps.google.com/?q=${encodeURIComponent([job.address, job.city].filter(Boolean).join(", "))}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-content/10 bg-surface px-3 py-2 text-sm font-bold text-content"><MapPinIcon className="size-4" />Map</a>
      {job.phone && <a href={`tel:${job.phone}`} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-content/10 bg-surface px-3 py-2 text-sm font-bold text-content"><PhoneIcon className="size-4" />Call Customer</a>}
    </div>
    {canEditSchedule && <div className="mt-4 border-t border-content/5 pt-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"><label className="block text-sm font-bold" htmlFor={`event-date-${job.jobId}`}>Date<input id={`event-date-${job.jobId}`} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-content/10 bg-surface px-3 font-bold text-content" /></label><label className="block text-sm font-bold" htmlFor={`event-time-${job.jobId}`}>Time / All Day<div className="mt-1 flex gap-2"><input id={`event-time-${job.jobId}`} type="time" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-content/10 bg-surface px-3 font-bold text-content" /><button type="button" onClick={() => setScheduledTime("")} className="min-h-11 shrink-0 rounded-xl border border-content/10 bg-surface px-3 text-sm font-bold text-content">All Day</button></div></label><label className="block text-sm font-bold" htmlFor={`event-plan-${job.jobId}`}>Calendar plan<select id={`event-plan-${job.jobId}`} value={schedulePlan || "Confirmed"} onChange={(event) => setSchedulePlan(event.target.value as Job["schedulePlan"])} className="mt-1 min-h-11 w-full rounded-xl border border-content/10 bg-surface px-3 font-bold text-content"><option value="Confirmed">Confirmed</option><option value="Tentative">Tentative (striped)</option></select></label><button type="button" onClick={() => onScheduleChange(dueDate, scheduledTime, schedulePlan)} disabled={saving || !dueDate || !changed} className="min-h-11 rounded-xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save schedule"}</button></div>
      {error && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
    </div>}
  </section>;
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

function formatSchedule(job: Job) {
  return `${formatDate(job.dueDate)} · ${formatTimeOrAllDay(job.scheduledTime)}`;
}

function formatTimeOrAllDay(scheduledTime?: string) {
  return scheduledTime ? new Date(`1970-01-01T${scheduledTime}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "All Day";
}

function compareScheduledJobs(a: Job, b: Job) {
  return `${a.dueDate}T${a.scheduledTime || "99:99"}`.localeCompare(`${b.dueDate}T${b.scheduledTime || "99:99"}`);
}

function shortAddress(address: string) {
  return address.split(",")[0]?.trim() || "";
}
