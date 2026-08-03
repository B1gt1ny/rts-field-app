import Link from "next/link";
import { BellAlertIcon, CalendarDaysIcon, CheckCircleIcon, ChatBubbleLeftRightIcon, ClipboardDocumentListIcon, MapPinIcon, PhoneIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import type { Job, JobActivity } from "@/lib/types";
import { billingBlockers, openParts } from "@/lib/job-readiness";
import { buildJobReminders, formatReminderDate, reminderTone } from "@/lib/reminders";
import { PriorityBadge, StatusBadge } from "./StatusBadge";

const activeStatuses = ["New", "Scheduled", "In Progress", "Waiting on Parts", "Needs Inspection"];
type AttentionItem = { id: string; job: Job; title: string; detail: string; tone: "red" | "orange" | "blue" | "green"; href: string; actionLabel: string; actionHref: string; handoffLabel?: string; handoffHref?: string };

export function TodayCommandView({ jobs }: { jobs: Job[] }) {
  const today = new Date().toLocaleDateString("en-CA");
  const todaysJobs = jobs.filter((job) => job.dueDate === today && !["Complete", "Billed", "Paid"].includes(job.status));
  const reminders = buildJobReminders(jobs, today);
  const urgentReminders = reminders.filter((reminder) => reminder.bucket === "Overdue" || reminder.bucket === "Today" || reminder.bucket === "Unscheduled").slice(0, 8);
  const structuredPartsRows = jobs.flatMap((job) => openParts(job).map((part) => ({ job, part })));
  const legacyPartsRows = jobs
    .filter((job) => !openParts(job).length && (job.status === "Waiting on Parts" || job.partsNeeded.trim()))
    .map((job) => ({
      job,
      part: { id: `legacy-${job.jobId}`, name: job.partsNeeded.trim() || "Parts needed", quantity: "", status: "Needed", notes: job.partsNeeded.trim() || "This job is marked as waiting on parts." },
    }));
  const partsRows = [...structuredPartsRows, ...legacyPartsRows].slice(0, 8);
  const activeJobs = jobs.filter((job) => activeStatuses.includes(job.status));
  const completeToday = jobs.filter((job) => job.dueDate === today && ["Complete", "Billed", "Paid"].includes(job.status)).length;
  const fieldActivityRows = jobs
    .flatMap((job) => (job.activityLog || []).map((entry) => ({ job, entry })))
    .filter(({ entry }) => entry.createdAt?.slice(0, 10) === today)
    .sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt))
    .slice(0, 10);
  const attentionItems = buildAttentionItems(jobs, today).slice(0, 10);
  const urgentAttention = attentionItems.filter((item) => item.tone === "red").length;
  const reviewAttention = attentionItems.filter((item) => item.tone === "orange").length;
  const scheduleAttention = attentionItems.filter((item) => item.tone === "blue").length;

  return <div className="mx-auto max-w-6xl space-y-5">
    <section className="rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><CalendarDaysIcon className="size-7" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-lime">{new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="text-3xl font-black">Today</h1>
          <p className="mt-1 text-sm text-white/55">Daily work screen for what crews need to do next: jobs, route actions, reminders, parts, and closeout.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <HeroMetric label="Due today" value={todaysJobs.length} />
        <HeroMetric label="Attention" value={attentionItems.length} />
        <HeroMetric label="Open reminders" value={urgentReminders.length} />
        <HeroMetric label="Open parts" value={partsRows.length} />
        <HeroMetric label="Field updates" value={fieldActivityRows.length} />
        <HeroMetric label="Done today" value={completeToday} />
      </div>
    </section>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <Metric label="All active" value={activeJobs.length} href="/jobs" icon={<ClipboardDocumentListIcon />} tone="bg-blue-100" />
      <Metric label="Do next" value={attentionItems.length} href="#today-next" icon={<BellAlertIcon />} tone="bg-red-100" />
      <Metric label="Today jobs" value={todaysJobs.length} href="/today" icon={<CalendarDaysIcon />} tone="bg-lime" />
      <Metric label="Reminders" value={urgentReminders.length} href="/reminders" icon={<BellAlertIcon />} tone="bg-orange-100" />
      <Metric label="Parts" value={partsRows.length} href="/waiting-on-parts" icon={<WrenchScrewdriverIcon />} tone="bg-amber-100" />
      <Metric label="Field updates" value={fieldActivityRows.length} href="/communication" icon={<ChatBubbleLeftRightIcon />} tone="bg-emerald-100" />
    </section>

    <section id="today-next" className="card overflow-hidden">
      <SectionHeader title="What needs done next" subtitle={`${attentionItems.length} field action${attentionItems.length === 1 ? "" : "s"} across notes, parts, overdue jobs, closeout, and scheduling`} href="/tasks" />
      <div className="grid grid-cols-3 gap-2 border-b border-black/5 p-3">
        <MiniAttention label="Urgent" value={urgentAttention} tone="bg-red-100 text-red-900" />
        <MiniAttention label="Review" value={reviewAttention} tone="bg-orange-100 text-orange-900" />
        <MiniAttention label="Schedule" value={scheduleAttention} tone="bg-blue-100 text-blue-900" />
      </div>
      <div className="divide-y divide-black/5">
        {attentionItems.length ? attentionItems.map((item) => <div key={item.id} className="p-4 hover:bg-black/[.02]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={item.href} className="truncate text-xs font-black uppercase tracking-wide text-forest">{item.job.jobId} · {item.job.customerName} · {item.job.city}</Link>
              <Link href={item.href} className="mt-1 block font-black">{item.title}</Link>
              <p className="mt-1 text-sm font-semibold text-black/50">{item.detail}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${attentionTone(item.tone)}`}>{item.tone === "red" ? "Urgent" : item.tone === "orange" ? "Review" : item.tone === "green" ? "Closeout" : "Schedule"}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Link href={item.actionHref} className="min-h-11 rounded-xl bg-forest px-3 py-2 text-center text-sm font-black text-white">{item.actionLabel}</Link>
            <Link href={item.handoffHref || `/jobs/${item.job.jobId}/edit`} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm font-black text-ink">{item.handoffLabel || "Assign / edit"}</Link>
            <Link href={`/jobs/${item.job.jobId}`} className="min-h-11 rounded-xl bg-sand px-3 py-2 text-center text-sm font-black text-ink sm:block">Open job</Link>
          </div>
        </div>) : <Empty text="Nothing is waiting on the daily work list right now." />}
      </div>
    </section>

    <section className="card overflow-hidden">
      <SectionHeader title="Today’s jobs" subtitle={`${todaysJobs.length} active job${todaysJobs.length === 1 ? "" : "s"} due today`} href="/jobs" />
      <div className="grid gap-3 p-3 md:grid-cols-2">
        {todaysJobs.length ? todaysJobs.map((job) => <TodayJobCard key={job.jobId} job={job} />) : <Empty text="No active jobs due today." />}
      </div>
    </section>

    <section className="card overflow-hidden">
      <SectionHeader title="Today field activity" subtitle={`${fieldActivityRows.length} crew update${fieldActivityRows.length === 1 ? "" : "s"} logged today`} href="/communication" />
      <div className="divide-y divide-black/5">
        {fieldActivityRows.length ? fieldActivityRows.map(({ job, entry }) => <Link key={`${job.jobId}-${entry.id}`} href={`/jobs/${job.jobId}#operations`} className="block p-4 hover:bg-black/[.02]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.customerName} · {job.city}</p>
              <h3 className="mt-1 line-clamp-2 font-black">{entry.message}</h3>
              <p className="mt-1 text-xs font-semibold text-black/45">{entry.createdBy || "Crew"} · {formatActivityTime(entry.createdAt)} · {entry.type}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${activityTone(entry)}`}>{entry.notify && !entry.resolvedAt ? "Follow-up" : entry.type}</span>
          </div>
        </Link>) : <Empty text="No field updates logged today yet." />}
      </div>
    </section>

    <section className="card overflow-hidden">
      <SectionHeader title="Reminder command" subtitle={`${urgentReminders.length} overdue, due-today, or unscheduled follow-up${urgentReminders.length === 1 ? "" : "s"}`} href="/reminders" />
      <div className="divide-y divide-black/5">
        {urgentReminders.length ? urgentReminders.map((reminder) => <Link key={reminder.id} href={`/jobs/${reminder.job.jobId}#operations`} className="block p-4 hover:bg-black/[.02]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-forest">{reminder.job.jobId} · {reminder.job.customerName}</p>
              <h3 className="mt-1 font-black">{reminder.entry.message}</h3>
              <p className="mt-1 text-xs font-semibold text-black/45">{formatReminderDate(reminder.dueDate)} · {reminder.entry.type}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${reminderTone(reminder.bucket)}`}>{reminder.bucket === "Today" ? "Due today" : reminder.bucket}</span>
          </div>
        </Link>) : <Empty text="No urgent reminders right now." />}
      </div>
    </section>

    <section className="card overflow-hidden">
      <SectionHeader title="Parts attention" subtitle={`${partsRows.length} open part request${partsRows.length === 1 ? "" : "s"}`} href="/waiting-on-parts" />
      <div className="divide-y divide-black/5">
        {partsRows.length ? partsRows.map(({ job, part }) => <Link key={`${job.jobId}-${part.id}`} href={`/jobs/${job.jobId}#parts-needed`} className="block p-4 hover:bg-black/[.02]">
          <p className="text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.customerName}</p>
          <h3 className="mt-1 font-black">{part.quantity ? `${part.quantity} × ${part.name}` : part.name}</h3>
          <p className="mt-1 text-sm font-semibold text-black/50">{part.status} · {job.city} · {job.assignedCrew}</p>
          {part.notes && <p className="mt-2 rounded-xl bg-sand p-3 text-sm font-semibold text-black/55">{part.notes}</p>}
        </Link>) : <Empty text="No open structured parts." />}
      </div>
    </section>
  </div>;
}

function TodayJobCard({ job }: { job: Job }) {
  return <div className="rounded-2xl border border-black/10 bg-white p-4">
    <Link href={`/jobs/${job.jobId}`} className="block">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.source}</p>
          <h2 className="mt-1 text-xl font-black">{job.customerName}</h2>
          <p className="mt-1 text-sm font-semibold text-black/55">{job.jobType} · {job.city}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-black/55">{job.scopeNotes || "No scope notes."}</p>
    </Link>
    <div className="mt-4 grid grid-cols-3 gap-2">
      <a href={`tel:${job.phone}`} className={`min-h-12 rounded-xl px-3 py-3 text-center text-sm font-black ${job.phone ? "bg-forest text-white" : "pointer-events-none bg-black/5 text-black/25"}`}><PhoneIcon className="mx-auto mb-1 size-5" />Call</a>
      <a href={`https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city}`)}`} target="_blank" className="min-h-12 rounded-xl bg-ink px-3 py-3 text-center text-sm font-black text-white"><MapPinIcon className="mx-auto mb-1 size-5" />Map</a>
      <Link href={`/jobs/${job.jobId}`} className="min-h-12 rounded-xl bg-lime px-3 py-3 text-center text-sm font-black text-ink"><CheckCircleIcon className="mx-auto mb-1 size-5" />Open</Link>
    </div>
    <div className="mt-3 flex flex-wrap gap-2"><PriorityBadge priority={job.priority} /><span className="rounded-full bg-sand px-3 py-1 text-xs font-black text-black/55">{job.assignedCrew || "Unassigned"}</span></div>
  </div>;
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

function MiniAttention({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={`rounded-2xl p-3 text-center ${tone}`}><p className="text-2xl font-black">{value}</p><p className="text-[11px] font-black uppercase tracking-wide">{label}</p></div>;
}

function Metric({ label, value, href, icon, tone }: { label: string; value: number; href: string; icon: React.ReactNode; tone: string }) {
  return <Link href={href} className="card p-4"><div className={`mb-3 grid size-10 place-items-center rounded-xl ${tone} [&>svg]:size-5`}>{icon}</div><p className="text-3xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-black/45">{label}</p></Link>;
}

function Empty({ text }: { text: string }) {
  return <p className="p-6 text-center text-sm font-semibold text-black/35 md:col-span-2">{text}</p>;
}

function formatActivityTime(createdAt: string) {
  return createdAt ? new Date(createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "No time";
}

function activityTone(entry: JobActivity) {
  if (entry.notify && !entry.resolvedAt) return "bg-orange-100 text-orange-900";
  if (entry.type === "Parts") return "bg-amber-100 text-amber-900";
  if (entry.type === "Status" || entry.type === "Time") return "bg-emerald-100 text-emerald-900";
  return "bg-blue-100 text-blue-900";
}

function buildAttentionItems(jobs: Job[], today: string): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const job of jobs) {
    const isClosed = ["Complete", "Billed", "Paid"].includes(job.status);
    const openStructuredParts = openParts(job);
    const flagged = (job.activityLog || []).filter((entry) => entry.notify && !entry.resolvedAt).slice(0, 2);
    for (const entry of flagged) {
      items.push({
        id: `${job.jobId}-${entry.id}-flag`,
        job,
        title: entry.message,
        detail: `${entry.createdBy || "Crew"} flagged ${entry.type}${entry.followUpDueDate ? ` · ${formatReminderDate(entry.followUpDueDate)}` : ""}`,
        tone: entry.followUpDueDate && entry.followUpDueDate < today ? "red" : "orange",
        href: `/jobs/${job.jobId}#operations`,
        actionLabel: "Resolve follow-up",
        actionHref: "/communication?filter=follow-up",
        handoffLabel: "Add manager note",
        handoffHref: `/jobs/${job.jobId}#operations`,
      });
    }
    if (!isClosed && job.dueDate && job.dueDate < today) items.push({
      id: `${job.jobId}-overdue`,
      job,
      title: "Job is overdue",
      detail: `Due ${new Date(`${job.dueDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${job.status}`,
      tone: "red",
      href: `/jobs/${job.jobId}`,
      actionLabel: "Reschedule",
      actionHref: `/jobs/${job.jobId}/edit`,
      handoffLabel: "Dispatch view",
      handoffHref: "/dispatch",
    });
    if (!isClosed && !job.dueDate) items.push({
      id: `${job.jobId}-unscheduled`,
      job,
      title: "Active job needs scheduled",
      detail: `${job.status} · ${job.assignedCrew || "Unassigned"}`,
      tone: "blue",
      href: `/jobs/${job.jobId}/edit`,
      actionLabel: "Schedule job",
      actionHref: `/jobs/${job.jobId}/edit`,
      handoffLabel: "Assign crew",
      handoffHref: `/jobs/${job.jobId}/edit`,
    });
    if (!isClosed && (job.status === "Waiting on Parts" || openStructuredParts.length || job.partsNeeded.trim())) items.push({
      id: `${job.jobId}-parts`,
      job,
      title: "Parts issue needs review",
      detail: openStructuredParts.length ? `${openStructuredParts.length} structured part request${openStructuredParts.length === 1 ? "" : "s"} open` : job.partsNeeded || "Waiting on parts",
      tone: "orange",
      href: `/jobs/${job.jobId}#parts-needed`,
      actionLabel: "Review parts",
      actionHref: `/jobs/${job.jobId}#parts-needed`,
      handoffLabel: "Parts board",
      handoffHref: "/waiting-on-parts",
    });
    if (["Complete", "Billed"].includes(job.status)) {
      const blockers = billingBlockers(job);
      if (blockers.length) items.push({
        id: `${job.jobId}-closeout`,
        job,
        title: "Closeout packet is missing items",
        detail: blockers.map((blocker) => blocker.label).join(", "),
        tone: "green",
        href: `/jobs/${job.jobId}/packet`,
        actionLabel: "Open packet",
        actionHref: `/jobs/${job.jobId}/packet`,
        handoffLabel: "Billing board",
        handoffHref: "/billing",
      });
    }
    if (!isClosed && !(job.beforePhotos || []).length) items.push({
      id: `${job.jobId}-before-photos`,
      job,
      title: "Before photos missing",
      detail: `${job.status} · field proof not uploaded yet`,
      tone: "orange",
      href: `/jobs/${job.jobId}#photos`,
      actionLabel: "Open photos",
      actionHref: `/jobs/${job.jobId}#photos`,
      handoffLabel: "Field app",
      handoffHref: "/field",
    });
  }
  return items.sort((a, b) => attentionRank(a.tone) - attentionRank(b.tone) || (a.job.dueDate || "9999-99-99").localeCompare(b.job.dueDate || "9999-99-99"));
}

function attentionRank(tone: AttentionItem["tone"]) {
  if (tone === "red") return 0;
  if (tone === "orange") return 1;
  if (tone === "blue") return 2;
  return 3;
}

function attentionTone(tone: AttentionItem["tone"]) {
  if (tone === "red") return "bg-red-100 text-red-900";
  if (tone === "orange") return "bg-orange-100 text-orange-900";
  if (tone === "green") return "bg-emerald-100 text-emerald-900";
  return "bg-blue-100 text-blue-900";
}
