import Link from "next/link";
import { CalendarDaysIcon, CheckCircleIcon, MapPinIcon, PhoneIcon } from "@heroicons/react/24/outline";
import type { Job, JobActivity } from "@/lib/types";
import { openParts } from "@/lib/job-readiness";
import { buildJobReminders, formatReminderDate, reminderTone } from "@/lib/reminders";
import { StatusBadge } from "./StatusBadge";

type TodayAction = {
  id: string;
  job: Job;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
  rank: number;
};

const closedStatuses = ["Complete", "Billed", "Paid"];

export function TodayCommandView({ jobs }: { jobs: Job[] }) {
  const today = new Date().toLocaleDateString("en-CA");
  const todaysJobs = jobs.filter((job) => job.dueDate === today && !closedStatuses.includes(job.status));
  const immediateActions = buildTodayActions(todaysJobs).slice(0, 8);
  const reminders = buildJobReminders(jobs, today)
    .filter((reminder) => reminder.bucket === "Today" || (reminder.bucket === "Overdue" && reminder.job.dueDate === today))
    .slice(0, 4);
  const fieldActivityRows = jobs
    .flatMap((job) => (job.activityLog || []).map((entry) => ({ job, entry })))
    .filter(({ entry }) => entry.createdAt?.slice(0, 10) === today)
    .sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt))
    .slice(0, 5);

  return <div className="mx-auto max-w-5xl space-y-5">
    <section className="rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><CalendarDaysIcon className="size-7" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-lime">{new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-1 text-3xl font-black">Today</h1>
          <p className="mt-1 text-sm text-white/55">Daily execution list for what must happen today.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <HeroMetric label="Jobs today" value={todaysJobs.length} />
        <HeroMetric label="Immediate actions" value={immediateActions.length} />
      </div>
    </section>

    <section className="card overflow-hidden">
      <SectionHeader title="Today’s Jobs" subtitle={`${todaysJobs.length} active job${todaysJobs.length === 1 ? "" : "s"} due or scheduled today`} href="/jobs" />
      <div className="divide-y divide-black/5">
        {todaysJobs.length ? todaysJobs.map((job) => <TodayJobRow key={job.jobId} job={job} />) : <Empty text="No active jobs are scheduled for today." />}
      </div>
    </section>

    <section className="card overflow-hidden">
      <SectionHeader title="Immediate Actions" subtitle={`${immediateActions.length} item${immediateActions.length === 1 ? "" : "s"} blocking today’s work`} href="/tasks" />
      <div className="divide-y divide-black/5">
        {immediateActions.length ? immediateActions.map((item) => <ActionRow key={item.id} item={item} />) : <Empty text="No immediate blockers for today’s jobs." />}
      </div>
    </section>

    <section className="card overflow-hidden">
      <SectionHeader title="Today’s Reminders" subtitle="Due-today reminders plus overdue follow-ups tied to today’s work" href="/reminders" />
      <div className="divide-y divide-black/5">
        {reminders.length ? reminders.map((reminder) => <Link key={reminder.id} href={`/jobs/${reminder.job.jobId}#operations`} className="block p-4 hover:bg-black/[.02]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{reminder.job.jobId} · {reminder.job.customerName}</p>
              <h3 className="mt-1 line-clamp-2 font-black">{reminder.entry.message}</h3>
              <p className="mt-1 text-xs font-semibold text-black/45">{formatReminderDate(reminder.dueDate)} · {reminder.entry.type}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${reminderTone(reminder.bucket)}`}>{reminder.bucket === "Today" ? "Due today" : "Overdue"}</span>
          </div>
        </Link>) : <Empty text="No reminders tied to today’s work." />}
      </div>
    </section>

    <section className="card overflow-hidden">
      <SectionHeader title="Today’s Field Updates" subtitle={`${fieldActivityRows.length} update${fieldActivityRows.length === 1 ? "" : "s"} logged today`} href="/communication" />
      <div className="divide-y divide-black/5">
        {fieldActivityRows.length ? fieldActivityRows.map(({ job, entry }) => <FieldUpdateRow key={`${job.jobId}-${entry.id}`} job={job} entry={entry} />) : <Empty text="No field updates logged today yet." />}
      </div>
    </section>
  </div>;
}

function TodayJobRow({ job }: { job: Job }) {
  return <div className="p-4 hover:bg-black/[.02]">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{job.jobId}</p>
        <h2 className="mt-1 text-lg font-black">{job.customerName}</h2>
        <p className="mt-1 text-sm font-semibold text-black/50">{job.city || "No city"} · {job.assignedCrew || "Unassigned"}</p>
        <p className="mt-2 text-sm font-semibold text-black/55">{nextAction(job)}</p>
      </div>
      <StatusBadge status={job.status} />
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2">
      <a href={`tel:${job.phone}`} className={`min-h-11 rounded-xl px-3 py-2 text-center text-sm font-black ${job.phone ? "bg-forest text-white" : "pointer-events-none bg-black/5 text-black/25"}`}><PhoneIcon className="mx-auto mb-0.5 size-5" />Call</a>
      <a href={`https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city}`)}`} target="_blank" className="min-h-11 rounded-xl bg-ink px-3 py-2 text-center text-sm font-black text-white"><MapPinIcon className="mx-auto mb-0.5 size-5" />Map</a>
      <Link href={`/jobs/${job.jobId}`} className="min-h-11 rounded-xl bg-lime px-3 py-2 text-center text-sm font-black text-ink"><CheckCircleIcon className="mx-auto mb-0.5 size-5" />Open</Link>
    </div>
  </div>;
}

function ActionRow({ item }: { item: TodayAction }) {
  return <div className="p-4 hover:bg-black/[.02]">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{item.job.jobId} · {item.job.customerName}</p>
        <h3 className="mt-1 font-black">{item.title}</h3>
        <p className="mt-1 text-sm font-semibold text-black/50">{item.detail}</p>
      </div>
      <StatusBadge status={item.job.status} />
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Link href={item.href} className="min-h-11 rounded-xl bg-forest px-3 py-2 text-center text-sm font-black text-white">{item.actionLabel}</Link>
      <Link href={`/jobs/${item.job.jobId}`} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm font-black text-ink">Open Job</Link>
    </div>
  </div>;
}

function FieldUpdateRow({ job, entry }: { job: Job; entry: JobActivity }) {
  return <Link href={`/jobs/${job.jobId}#operations`} className="block p-4 hover:bg-black/[.02]">
    <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.customerName}</p>
    <h3 className="mt-1 line-clamp-2 font-black">{entry.message}</h3>
    <p className="mt-1 text-xs font-semibold text-black/45">{entry.createdBy || "Crew"} · {formatActivityTime(entry.createdAt)} · {entry.type}</p>
  </Link>;
}

function buildTodayActions(jobs: Job[]): TodayAction[] {
  return jobs.flatMap((job) => todayIssues(job).map((issue, index) => ({
    id: `${job.jobId}-${issue.title}-${index}`,
    job,
    ...issue,
  }))).sort((a, b) => a.rank - b.rank || priorityRank(a.job.priority) - priorityRank(b.job.priority));
}

function todayIssues(job: Job): Omit<TodayAction, "id" | "job">[] {
  const issues: Omit<TodayAction, "id" | "job">[] = [];
  const assigned = Boolean(job.fullCrew || job.assignedEmployeeIds?.length || (job.assignedCrew && job.assignedCrew !== "Unassigned"));
  const parts = openParts(job);
  if (!assigned) issues.push({ title: "Assign today’s work", detail: "This job is due today but has no assigned crew.", href: `/jobs/${job.jobId}/edit`, actionLabel: "Assign", rank: 0 });
  if (job.status === "New" || job.status === "Scheduled") issues.push({ title: "Start or update status", detail: `${job.status} job is on today’s schedule.`, href: `/jobs/${job.jobId}`, actionLabel: "Open Job", rank: 1 });
  if (job.status === "Waiting on Parts" || parts.length > 0) issues.push({ title: "Parts blocking today", detail: parts.length ? `${parts.length} open part request${parts.length === 1 ? "" : "s"}.` : "Job is waiting on parts.", href: `/jobs/${job.jobId}#parts-needed`, actionLabel: "Review Parts", rank: 2 });
  if (job.status === "Needs Inspection") issues.push({ title: "Review required today", detail: "Job is waiting for manager review.", href: `/jobs/${job.jobId}`, actionLabel: "Review", rank: 3 });
  if (job.status === "Complete" && (!(job.afterPhotos || []).length || !job.completionNotes?.trim())) issues.push({ title: "Closeout needs proof", detail: "Completion notes or after photos are missing.", href: `/jobs/${job.jobId}#complete-job`, actionLabel: "Closeout", rank: 4 });
  const etaNeeded = (job.activityLog || []).some((entry) => entry.notify && !entry.resolvedAt && entry.followUpDueDate === new Date().toLocaleDateString("en-CA") && /eta|arrival|on the way|customer/i.test(entry.message));
  if (etaNeeded) issues.push({ title: "Customer ETA needed", detail: "A customer-facing follow-up is due today.", href: `/jobs/${job.jobId}#operations`, actionLabel: "Open Note", rank: 5 });
  return issues;
}

function nextAction(job: Job) {
  if (!job.assignedCrew || job.assignedCrew === "Unassigned") return "Next: assign crew";
  if (job.status === "New" || job.status === "Scheduled") return "Next: start or update the job";
  if (job.status === "Waiting on Parts" || openParts(job).length) return "Next: resolve parts blocker";
  if (job.status === "Needs Inspection") return "Next: manager review";
  if (job.status === "In Progress") return "Next: continue work and add field update";
  return "Next: open job";
}

function SectionHeader({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return <div className="flex items-center justify-between gap-3 bg-sand p-4">
    <div><h2 className="text-lg font-black">{title}</h2><p className="text-sm font-semibold text-black/45">{subtitle}</p></div>
    <Link href={href} className="text-sm font-black text-forest">View</Link>
  </div>;
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-white/55">{label}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="p-5 text-center text-sm font-semibold text-black/35">{text}</p>;
}

function formatActivityTime(createdAt: string) {
  return createdAt ? new Date(createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "No time";
}

function priorityRank(priority: Job["priority"]) {
  return { Urgent: 0, High: 1, Normal: 2, Low: 3 }[priority] || 4;
}
