import Link from "next/link";
import { BellAlertIcon, CalendarDaysIcon, CameraIcon, ClipboardDocumentListIcon, CurrencyDollarIcon, ExclamationTriangleIcon, UserGroupIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/lib/types";
import { isReadyForBilling, openParts } from "@/lib/job-readiness";
import { isReceiptBackupMissing } from "@/lib/receipt-backup";
import { PriorityBadge, StatusBadge } from "./StatusBadge";

type IssueType = "Overdue" | "Waiting Parts" | "Missing Paperwork" | "Missing Photos" | "Needs Review" | "Ready Billing" | "Overdue Follow-up" | "Unassigned" | "Unscheduled";
type IssueItem = {
  job: Job;
  issues: IssueType[];
  primaryReason: string;
  href: string;
  rank: number;
};

const closedStatuses = ["Complete", "Billed", "Paid"];
const issueOrder: IssueType[] = ["Overdue", "Waiting Parts", "Missing Paperwork", "Missing Photos", "Needs Review", "Ready Billing", "Overdue Follow-up", "Unassigned", "Unscheduled"];

export function CommandCenterView({ jobs }: { jobs: Job[] }) {
  const today = new Date().toLocaleDateString("en-CA");
  const active = jobs.filter((job) => !closedStatuses.includes(job.status));
  const counts = buildIssueCounts(jobs, today);
  const queue = buildIssueQueue(jobs, today).slice(0, 10);
  const totalIssues = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><BellAlertIcon className="size-7" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-lime">Manager exceptions</p>
          <h1 className="text-3xl font-black">Operations</h1>
          <p className="mt-1 text-sm text-white/55">What operational problem needs manager action?</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HeroMetric label="Open jobs" value={active.length} />
        <HeroMetric label="Issue types" value={issueOrder.filter((issue) => counts[issue] > 0).length} />
        <HeroMetric label="Total flags" value={totalIssues} />
        <HeroMetric label="Shown now" value={queue.length} />
      </div>
    </section>

    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-9">
      <IssueCountCard label="Overdue" value={counts.Overdue} href="/jobs" icon={<ExclamationTriangleIcon />} tone={counts.Overdue ? "bg-red-100 text-red-900" : "bg-black/5 text-black/45"} />
      <IssueCountCard label="Parts" value={counts["Waiting Parts"]} href="/waiting-on-parts" icon={<WrenchScrewdriverIcon />} tone={counts["Waiting Parts"] ? "bg-orange-100 text-orange-900" : "bg-black/5 text-black/45"} />
      <IssueCountCard label="Paperwork" value={counts["Missing Paperwork"]} href="/documents" icon={<ClipboardDocumentListIcon />} tone={counts["Missing Paperwork"] ? "bg-amber-100 text-amber-900" : "bg-black/5 text-black/45"} />
      <IssueCountCard label="Photos" value={counts["Missing Photos"]} href="/tasks" icon={<CameraIcon />} tone={counts["Missing Photos"] ? "bg-blue-100 text-blue-900" : "bg-black/5 text-black/45"} />
      <IssueCountCard label="Review" value={counts["Needs Review"]} href="/ready-check" icon={<ClipboardDocumentListIcon />} tone={counts["Needs Review"] ? "bg-violet-100 text-violet-900" : "bg-black/5 text-black/45"} />
      <IssueCountCard label="Billing" value={counts["Ready Billing"]} href="/billing" icon={<CurrencyDollarIcon />} tone={counts["Ready Billing"] ? "bg-emerald-100 text-emerald-900" : "bg-black/5 text-black/45"} />
      <IssueCountCard label="Follow-up" value={counts["Overdue Follow-up"]} href="/communication?filter=follow-up" icon={<BellAlertIcon />} tone={counts["Overdue Follow-up"] ? "bg-red-100 text-red-900" : "bg-black/5 text-black/45"} />
      <IssueCountCard label="Unassigned" value={counts.Unassigned} href="/dispatch" icon={<UserGroupIcon />} tone={counts.Unassigned ? "bg-orange-100 text-orange-900" : "bg-black/5 text-black/45"} />
      <IssueCountCard label="Unscheduled" value={counts.Unscheduled} href="/schedule" icon={<CalendarDaysIcon />} tone={counts.Unscheduled ? "bg-blue-100 text-blue-900" : "bg-black/5 text-black/45"} />
    </section>

    <section className="card overflow-hidden">
      <div className="flex flex-col gap-1 bg-sand p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-black">Manager exception queue</h2>
          <p className="text-sm font-semibold text-black/45">Top {queue.length} jobs needing manager action, grouped so each job appears once.</p>
        </div>
        <Link href="/tasks" className="text-sm font-black text-forest">View tasks</Link>
      </div>
      <div className="divide-y divide-black/5">
        {queue.length ? queue.map((item) => <IssueRow key={item.job.jobId} item={item} />) : <p className="p-6 text-center text-sm font-semibold text-black/35">No manager exceptions are open right now.</p>}
      </div>
    </section>
  </div>;
}

function buildIssueCounts(jobs: Job[], today: string): Record<IssueType, number> {
  return Object.fromEntries(issueOrder.map((issue) => [issue, jobs.filter((job) => jobIssues(job, today).includes(issue)).length])) as Record<IssueType, number>;
}

function buildIssueQueue(jobs: Job[], today: string): IssueItem[] {
  return jobs.map((job) => {
    const issues = jobIssues(job, today);
    return {
      job,
      issues,
      primaryReason: issueReason(job, issues[0], today),
      href: issueHref(job, issues[0]),
      rank: issueRank(issues[0]),
    };
  }).filter((item) => item.issues.length > 0)
    .sort((a, b) => a.rank - b.rank || priorityRank(a.job.priority) - priorityRank(b.job.priority) || dueRank(a.job).localeCompare(dueRank(b.job)));
}

function jobIssues(job: Job, today: string): IssueType[] {
  const isClosed = closedStatuses.includes(job.status);
  const reviewStage = isReviewOrCloseoutStage(job);
  const issues: IssueType[] = [];
  if (!isClosed && job.dueDate && job.dueDate < today) issues.push("Overdue");
  if (!isClosed && (job.status === "Waiting on Parts" || openParts(job).length > 0)) issues.push("Waiting Parts");
  if (reviewStage && missingRequiredPaperwork(job)) issues.push("Missing Paperwork");
  if (reviewStage && missingRequiredPhotos(job)) issues.push("Missing Photos");
  if (!isClosed && job.status === "Needs Inspection") issues.push("Needs Review");
  if (isReadyForBilling(job) && !["Paid", "Sent", "Sent to Billing"].includes(job.invoiceStatus || "")) issues.push("Ready Billing");
  if ((job.activityLog || []).some((entry) => entry.notify && !entry.resolvedAt && entry.followUpDueDate && entry.followUpDueDate < today)) issues.push("Overdue Follow-up");
  if (!isClosed && !job.fullCrew && !job.assignedEmployeeIds?.length && (!job.assignedCrew || job.assignedCrew === "Unassigned")) issues.push("Unassigned");
  if (["New", "Scheduled", "In Progress"].includes(job.status) && !job.dueDate) issues.push("Unscheduled");
  return issues;
}

function isReviewOrCloseoutStage(job: Job) {
  return job.status === "Needs Inspection" || closedStatuses.includes(job.status) || ["Ready", "Draft", "Sent to Billing", "Sent"].includes(job.invoiceStatus || "");
}

function missingRequiredPaperwork(job: Job) {
  return !job.paperworkPickedUp && !(job.workOrderFiles || []).length && !(job.paperworkItems || []).some((item) => ["Collected", "Submitted", "Not needed"].includes(item.status)) || isReceiptBackupMissing(job);
}

function missingRequiredPhotos(job: Job) {
  if (job.status === "Paid" || job.status === "Billed") return false;
  return !(job.afterPhotos || []).length;
}

function issueReason(job: Job, issue: IssueType | undefined, today: string) {
  if (issue === "Overdue") return `Due ${formatDate(job.dueDate)} and still ${job.status}.`;
  if (issue === "Waiting Parts") return openParts(job).length ? `${openParts(job).length} open part request${openParts(job).length === 1 ? "" : "s"}.` : "Job is marked waiting on parts.";
  if (issue === "Missing Paperwork") return isReceiptBackupMissing(job) ? "Receipt backup or job paperwork is missing." : "Work order or paperwork pickup is missing.";
  if (issue === "Missing Photos") return "After photos are missing from review or closeout.";
  if (issue === "Needs Review") return "Job is waiting for manager review.";
  if (issue === "Ready Billing") return "Job is marked ready for billing.";
  if (issue === "Overdue Follow-up") return overdueFollowUpText(job, today);
  if (issue === "Unassigned") return "No crew or employee assignment is set.";
  if (issue === "Unscheduled") return "Active job does not have a due date.";
  return "Review this job.";
}

function issueHref(job: Job, issue: IssueType | undefined) {
  if (issue === "Waiting Parts") return `/jobs/${job.jobId}#parts-needed`;
  if (issue === "Missing Paperwork") return `/jobs/${job.jobId}#paperwork`;
  if (issue === "Missing Photos") return `/jobs/${job.jobId}#photos`;
  if (issue === "Ready Billing") return `/jobs/${job.jobId}#billing-handoff`;
  if (issue === "Overdue Follow-up") return `/jobs/${job.jobId}#operations`;
  if (issue === "Unassigned" || issue === "Unscheduled") return `/jobs/${job.jobId}/edit`;
  return `/jobs/${job.jobId}`;
}

function IssueRow({ item }: { item: IssueItem }) {
  return <div className="p-4 hover:bg-black/[.02]">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{item.job.jobId}</p>
        <h3 className="mt-1 text-lg font-black">{item.job.customerName}</h3>
        <p className="mt-1 text-sm font-semibold text-black/55">{item.primaryReason}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {item.issues.slice(0, 4).map((issue) => <span key={issue} className="rounded-full bg-sand px-3 py-1 text-xs font-black text-black/55">{issue}</span>)}
          {item.issues.length > 4 && <span className="rounded-full bg-sand px-3 py-1 text-xs font-black text-black/55">+{item.issues.length - 4} more</span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:items-end">
        <StatusBadge status={item.job.status} />
        <PriorityBadge priority={item.job.priority} />
      </div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <Link href={item.href} className="min-h-11 rounded-xl bg-forest px-3 py-2 text-center text-sm font-black text-white">Open Issue</Link>
      <Link href={`/jobs/${item.job.jobId}`} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm font-black text-ink">Open Job</Link>
      <span className="hidden min-h-11 items-center rounded-xl bg-sand px-3 py-2 text-sm font-bold text-black/45 sm:inline-flex">{item.job.assignedCrew || "Unassigned"}</span>
    </div>
  </div>;
}

function IssueCountCard({ label, value, href, icon, tone }: { label: string; value: number; href: string; icon: React.ReactNode; tone: string }) {
  return <Link href={href} className="card block p-3 transition active:scale-[.98]">
    <div className={`mb-2 grid size-9 place-items-center rounded-xl ${tone} [&>svg]:size-5`}>{icon}</div>
    <p className="text-2xl font-black">{value}</p>
    <p className="mt-0.5 text-[11px] font-black uppercase tracking-wide text-black/45">{label}</p>
  </Link>;
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/10 p-4">
    <p className="text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-white/55">{label}</p>
  </div>;
}

function overdueFollowUpText(job: Job, today: string) {
  const entry = (job.activityLog || []).find((item) => item.notify && !item.resolvedAt && item.followUpDueDate && item.followUpDueDate < today);
  return entry ? `Follow-up overdue: ${entry.message}` : "Follow-up is overdue.";
}

function formatDate(value: string) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "no date";
}

function issueRank(issue: IssueType | undefined) {
  return issue ? issueOrder.indexOf(issue) : 99;
}

function dueRank(job: Job) {
  return job.dueDate || "9999-99-99";
}

function priorityRank(priority: Job["priority"]) {
  return { Urgent: 0, High: 1, Normal: 2, Low: 3 }[priority] || 4;
}
