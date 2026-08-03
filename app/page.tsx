import Link from "next/link";
import { ArrowRightIcon, CalendarDaysIcon, CheckCircleIcon, ClipboardDocumentListIcon, ClockIcon, ExclamationTriangleIcon, PlusIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { getJobs } from "@/lib/jobs";
import { MonthlyCalendar } from "@/components/MonthlyCalendar";
import { filterServerJobsForUser, getServerUser } from "@/lib/server-auth";
import { buildJobReminders, formatReminderDate, reminderTone } from "@/lib/reminders";
import { getUserRole, isDatabaseConfigured } from "@/lib/auth";
import { isReceiptBackupMissing } from "@/lib/receipt-backup";
import type { Job, JobActivity } from "@/lib/types";

export const dynamic = "force-dynamic";

const activeStatuses = ["New", "Scheduled", "In Progress", "Waiting on Parts", "Needs Inspection"];
const closedStatuses = ["Complete", "Billed", "Paid"];
const priorityRank = { Urgent: 0, High: 1, Normal: 2, Low: 3 };

export default async function Dashboard() {
  const jobs = await filterServerJobsForUser(await getJobs());
  const user = await getServerUser();
  const role = isDatabaseConfigured() ? getUserRole(user) : "Admin";
  const isEmployee = role === "Employee";
  const now = new Date();
  const today = new Date().toLocaleDateString("en-CA");
  const todaysJobs = jobs.filter((job) => job.dueDate === today);
  const activeJobs = jobs.filter((job) => activeStatuses.includes(job.status));
  const waitingJobs = jobs.filter((job) => job.status === "Waiting on Parts");
  const reviewJobs = jobs.filter((job) => job.status === "Needs Inspection");
  const billingJobs = jobs.filter((job) => job.invoiceStatus === "Ready");
  const reminders = buildJobReminders(jobs, today);
  const dueReminders = reminders.filter((reminder) => reminder.bucket === "Overdue" || reminder.bucket === "Today");
  const attentionItems = buildAttentionItems(jobs, dueReminders, today).slice(0, 6);
  const recentActivity = latestActivity(jobs).slice(0, 5);

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-widest text-forest">{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{isEmployee ? "My Field Dashboard" : "Company Command"}</h1>
        <p className="mt-1 text-sm font-semibold text-black/50">{isEmployee ? "What needs your attention in the field today." : "What needs attention today across jobs, parts, review, and billing."}</p>
      </div>
      {isEmployee
        ? <Link href="/field" className="btn-primary sm:self-auto">Open my jobs <ArrowRightIcon className="size-5" /></Link>
        : <Link href="/jobs/new" className="btn-primary sm:self-auto">New Job <PlusIcon className="size-5" /></Link>}
    </div>

    <section className="card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">Today’s Snapshot</h2>
        <span className="text-xs font-black uppercase tracking-wide text-black/35">{activeJobs.length} active</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SnapshotMetric label="Due today" value={todaysJobs.length} href="/today" icon={<ClockIcon />} tone="bg-lime text-ink" />
        <SnapshotMetric label="Active jobs" value={activeJobs.length} href="/jobs" icon={<WrenchScrewdriverIcon />} tone="bg-blue-100 text-blue-900" />
        <SnapshotMetric label="Waiting parts" value={waitingJobs.length} href="/waiting-on-parts" icon={<ExclamationTriangleIcon />} tone="bg-orange-100 text-orange-900" />
        <SnapshotMetric label="Needs review" value={reviewJobs.length} href="/ready-check" icon={<CheckCircleIcon />} tone="bg-cyan-100 text-cyan-900" />
        <SnapshotMetric label="Ready billing" value={billingJobs.length} href="/billing" icon={<ClipboardDocumentListIcon />} tone="bg-emerald-100 text-emerald-900" />
      </div>
    </section>

    <section className="card overflow-hidden">
      <SectionHeader title="Needs Attention" detail="Highest priority field, parts, paperwork, review, billing, and follow-up items." actionHref="/command" actionLabel={isEmployee ? undefined : "View all"} />
      <div className="divide-y divide-black/5">
        {attentionItems.length ? attentionItems.map((item) => <AttentionRow key={item.key} item={item} />) : <EmptyRow message="Nothing urgent needs attention right now." />}
      </div>
    </section>

    <section className="card overflow-hidden">
      <SectionHeader title="Today’s Work" detail="Jobs due or scheduled today." actionHref="/today" actionLabel="View all" />
      <div className="divide-y divide-black/5">
        {todaysJobs.length ? todaysJobs.map((job) => <TodayJobRow key={job.jobId} job={job} />) : <EmptyRow message="No jobs scheduled for today." />}
      </div>
    </section>

    <section className="card overflow-hidden">
      <SectionHeader title="Follow-up Reminders" detail="Only overdue and due-today follow-ups." actionHref="/reminders" actionLabel="View all" />
      <div className="divide-y divide-black/5">
        {dueReminders.slice(0, 4).length ? dueReminders.slice(0, 4).map((reminder) => <Link key={reminder.id} href={`/jobs/${reminder.job.jobId}#operations`} className="block p-3 hover:bg-black/[.02] sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{reminder.job.jobId} · {reminder.job.customerName}</p>
              <p className="mt-1 line-clamp-2 text-sm font-black">{reminder.entry.message}</p>
              <p className="mt-1 text-xs font-semibold text-black/45">{formatReminderDate(reminder.dueDate)} · {reminder.entry.type}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${reminderTone(reminder.bucket)}`}>{reminder.bucket === "Today" ? "Due today" : reminder.bucket}</span>
          </div>
        </Link>) : <EmptyRow message="No overdue or due-today follow-ups." />}
      </div>
    </section>

    <MonthlyCalendar jobs={jobs} today={now} />

    {recentActivity.length > 0 && <section className="card overflow-hidden">
      <SectionHeader title="Recent Activity" detail="Latest reliable notes from job history." />
      <div className="divide-y divide-black/5">
        {recentActivity.map(({ job, activity }) => <Link key={`${job.jobId}-${activity.id}`} href={`/jobs/${job.jobId}#operations`} className="block p-3 hover:bg-black/[.02] sm:p-4">
          <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.customerName}</p>
          <p className="mt-1 line-clamp-2 text-sm font-black">{activity.message}</p>
          <p className="mt-1 text-xs font-semibold text-black/45">{activity.createdBy} · {new Date(activity.createdAt).toLocaleString()}</p>
        </Link>)}
      </div>
    </section>}
  </div>;
}

function buildAttentionItems(jobs: Job[], reminders: ReturnType<typeof buildJobReminders>, today: string) {
  const items: Array<{ key: string; job: Job; reason: string; tone: string; rank: number }> = [];
  const seen = new Set<string>();
  const add = (job: Job, reason: string, tone: string, rank: number) => {
    if (seen.has(job.jobId)) return;
    seen.add(job.jobId);
    items.push({ key: `${job.jobId}-${rank}`, job, reason, tone, rank });
  };

  jobs.forEach((job) => {
    if (job.dueDate && job.dueDate < today && !closedStatuses.includes(job.status)) add(job, "Overdue job", "bg-red-100 text-red-900", 0);
  });
  jobs.forEach((job) => {
    if (job.status === "Waiting on Parts") add(job, job.partsNeeded || "Waiting on parts", "bg-orange-100 text-orange-900", 1);
  });
  jobs.forEach((job) => {
    if (job.status === "Needs Inspection") add(job, "Needs manager review", "bg-cyan-100 text-cyan-900", 2);
  });
  jobs.forEach((job) => {
    if (job.invoiceStatus === "Ready") add(job, "Ready for billing", "bg-emerald-100 text-emerald-900", 3);
  });
  jobs.forEach((job) => {
    if (!job.paperworkPickedUp || isReceiptBackupMissing(job)) add(job, !job.paperworkPickedUp ? "Missing paperwork pickup" : "Missing receipt backup", "bg-yellow-100 text-yellow-900", 4);
  });
  jobs.forEach((job) => {
    if (!closedStatuses.includes(job.status) && (!(job.beforePhotos || []).length || !(job.serialTagPhotos || []).length)) add(job, "Missing required photos", "bg-purple-100 text-purple-900", 5);
  });
  reminders.forEach((reminder) => add(reminder.job, `Follow-up ${reminder.bucket.toLowerCase()}`, "bg-blue-100 text-blue-900", 6));

  return items.sort((a, b) => a.rank - b.rank || priorityRank[a.job.priority] - priorityRank[b.job.priority] || (a.job.dueDate || "9999-99-99").localeCompare(b.job.dueDate || "9999-99-99"));
}

function latestActivity(jobs: Job[]) {
  return jobs.flatMap((job) => (job.activityLog || []).map((activity) => ({ job, activity })))
    .filter(({ activity }) => activity.createdAt)
    .sort((a, b) => b.activity.createdAt.localeCompare(a.activity.createdAt));
}

function SectionHeader({ title, detail, actionHref, actionLabel }: { title: string; detail: string; actionHref?: string; actionLabel?: string }) {
  return <div className="flex items-center justify-between gap-3 bg-sand p-3 sm:p-4">
    <div className="min-w-0">
      <h2 className="text-lg font-black sm:text-xl">{title}</h2>
      <p className="mt-0.5 text-xs font-semibold text-black/45 sm:text-sm">{detail}</p>
    </div>
    {actionHref && actionLabel && <Link href={actionHref} className="shrink-0 text-sm font-extrabold text-forest">{actionLabel}</Link>}
  </div>;
}

function SnapshotMetric({ label, value, href, icon, tone }: { label: string; value: number; href: string; icon: React.ReactNode; tone: string }) {
  return <Link href={href} className="rounded-2xl border border-black/10 bg-white p-3 active:scale-[.99]">
    <div className={`mb-2 grid size-9 place-items-center rounded-xl ${tone} [&>svg]:size-5`}>{icon}</div>
    <p className="text-2xl font-black">{value}</p>
    <p className="mt-0.5 text-[11px] font-black uppercase tracking-wide text-black/45">{label}</p>
  </Link>;
}

function AttentionRow({ item }: { item: { job: Job; reason: string; tone: string } }) {
  return <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
    <div className="min-w-0">
      <p className="truncate text-sm font-black">{item.job.customerName}</p>
      <p className="mt-0.5 truncate text-xs font-semibold text-black/45">{item.job.jobId} · {item.job.city || "No city"} · {item.job.assignedCrew || "Unassigned"}</p>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <span className={`hidden rounded-full px-3 py-1 text-xs font-black sm:inline-flex ${item.tone}`}>{item.reason}</span>
      <Link href={`/jobs/${item.job.jobId}`} className="rounded-xl bg-forest px-3 py-2 text-xs font-black text-white">Open job</Link>
    </div>
  </div>;
}

function TodayJobRow({ job }: { job: Job }) {
  return <div className="grid grid-cols-[1fr_auto] items-center gap-3 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:p-4">
    <div className="min-w-0">
      <p className="truncate text-sm font-black">{job.jobId} · {job.customerName}</p>
      <p className="mt-0.5 truncate text-xs font-semibold text-black/45">{job.city || "No city"}</p>
    </div>
    <p className="hidden truncate text-sm font-semibold text-black/55 sm:block">{job.assignedCrew || "Unassigned"}</p>
    <span className="hidden rounded-full bg-black/5 px-3 py-1 text-center text-xs font-black text-black/55 sm:inline-block">{job.status}</span>
    <Link href={`/jobs/${job.jobId}`} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-black text-forest">Open</Link>
  </div>;
}

function EmptyRow({ message }: { message: string }) {
  return <p className="p-4 text-center text-sm font-semibold text-black/35">{message}</p>;
}
