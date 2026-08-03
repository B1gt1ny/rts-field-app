import Link from "next/link";
import { BellAlertIcon, CalendarDaysIcon, CameraIcon, ChatBubbleLeftRightIcon, ClipboardDocumentListIcon, CurrencyDollarIcon, ExclamationTriangleIcon, UserGroupIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/lib/types";
import { PriorityBadge, StatusBadge } from "./StatusBadge";
import { isReadyForBilling, openParts } from "@/lib/job-readiness";
import { buildJobTasks, type JobTask } from "@/lib/job-tasks";

type CommandItem = {
  id: string;
  title: string;
  detail: string;
  tone: string;
  icon: React.ReactNode;
  href: string;
  job?: Job;
};

export function CommandCenterView({ jobs }: { jobs: Job[] }) {
  const tasks = buildJobTasks(jobs);
  const items = tasks.slice(0, 40).map(taskToCommandItem);
  const today = new Date().toLocaleDateString("en-CA");
  const active = jobs.filter((job) => !["Complete", "Billed", "Paid"].includes(job.status));
  const urgent = active.filter((job) => job.priority === "Urgent").length;
  const todayJobs = active.filter((job) => job.dueDate === today).length;
  const followUps = jobs.reduce((sum, job) => sum + (job.activityLog || []).filter((entry) => entry.notify && !entry.resolvedAt).length, 0);
  const overdueFollowUps = jobs.reduce((sum, job) => sum + (job.activityLog || []).filter((entry) => entry.notify && !entry.resolvedAt && entry.followUpDueDate && entry.followUpDueDate < today).length, 0);
  const unassigned = active.filter((job) => !job.fullCrew && !job.assignedEmployeeIds?.length && (!job.assignedCrew || job.assignedCrew === "Unassigned")).length;
  const unscheduled = active.filter((job) => !job.dueDate).length;
  const waitingParts = jobs.filter((job) => job.status === "Waiting on Parts" || (job.partsItems || []).some((part) => ["Needed", "Ordered", "Picked up"].includes(part.status))).length;
  const inspections = active.filter((job) => job.status === "Needs Inspection").length;
  const missingPaperwork = active.filter((job) => !job.paperworkPickedUp && !(job.workOrderFiles || []).length).length;
  const billing = jobs.filter((job) => job.invoiceStatus === "Ready").length;
  const billingReview = jobs.filter((job) => ["Complete", "Billed"].includes(job.status) && !isReadyForBilling(job)).length;
  const photoIssues = jobs.filter((job) => job.status === "Complete" && !(job.afterPhotos || []).length).length;
  const topUrgentJobs = active.filter((job) => job.priority === "Urgent" || job.status === "Waiting on Parts" || openParts(job).length).slice(0, 6);
  const lanes = [
    { label: "Today", value: todayJobs, detail: "Jobs due today", href: "/today-command", icon: <CalendarDaysIcon />, tone: "bg-lime text-ink" },
    { label: "Follow-ups", value: followUps, detail: `${overdueFollowUps} overdue`, href: "/communication?filter=follow-up", icon: <ChatBubbleLeftRightIcon />, tone: followUps ? "bg-orange-100 text-orange-900" : "bg-black/5 text-black/45" },
    { label: "Dispatch", value: unassigned, detail: "Need handoff/assignment", href: "/dispatch", icon: <UserGroupIcon />, tone: unassigned ? "bg-orange-100 text-orange-900" : "bg-black/5 text-black/45" },
    { label: "Schedule", value: unscheduled, detail: "Need dates", href: "/schedule", icon: <CalendarDaysIcon />, tone: unscheduled ? "bg-blue-100 text-blue-900" : "bg-black/5 text-black/45" },
    { label: "Parts", value: waitingParts, detail: "Open part blockers", href: "/waiting-on-parts", icon: <WrenchScrewdriverIcon />, tone: waitingParts ? "bg-orange-100 text-orange-900" : "bg-black/5 text-black/45" },
    { label: "Inspection", value: inspections, detail: "Manager review queue", href: "/ready-check", icon: <ClipboardDocumentListIcon />, tone: inspections ? "bg-violet-100 text-violet-900" : "bg-black/5 text-black/45" },
    { label: "Paperwork", value: missingPaperwork, detail: "Missing work orders/files", href: "/documents", icon: <ClipboardDocumentListIcon />, tone: missingPaperwork ? "bg-amber-100 text-amber-900" : "bg-black/5 text-black/45" },
    { label: "Billing", value: billing + billingReview, detail: `${billing} ready · ${billingReview} review`, href: "/billing", icon: <CurrencyDollarIcon />, tone: billing + billingReview ? "bg-emerald-100 text-emerald-900" : "bg-black/5 text-black/45" },
    { label: "Photos", value: photoIssues, detail: "Closeout proof gaps", href: "/tasks", icon: <CameraIcon />, tone: photoIssues ? "bg-blue-100 text-blue-900" : "bg-black/5 text-black/45" },
  ];

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><BellAlertIcon className="size-7" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-lime">Manager mission control</p>
          <h1 className="text-3xl font-black">Company Command</h1>
          <p className="mt-1 text-sm text-white/55">One place for urgent work, follow-ups, dispatch, schedule gaps, parts, paperwork, photos, and billing.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <HeroMetric label="Active jobs" value={active.length} />
        <HeroMetric label="Today" value={todayJobs} />
        <HeroMetric label="Urgent" value={urgent} />
        <HeroMetric label="Follow-ups" value={followUps} />
        <HeroMetric label="Action items" value={tasks.length} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-4">
        <Link href="/today-command" className="min-h-12 rounded-xl bg-lime px-4 py-3 text-center font-black text-ink">Today Command</Link>
        <Link href="/dispatch" className="min-h-12 rounded-xl bg-white/10 px-4 py-3 text-center font-black text-white">Dispatch</Link>
        <Link href="/communication" className="min-h-12 rounded-xl bg-white/10 px-4 py-3 text-center font-black text-white">Communication</Link>
        <Link href="/jobs/new" className="min-h-12 rounded-xl bg-white/10 px-4 py-3 text-center font-black text-white">Add Job</Link>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {lanes.map((lane) => <CommandLane key={lane.label} {...lane} />)}
    </section>

    <section className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
      <div className="space-y-5">
        <section className="card overflow-hidden">
          <div className="bg-sand p-4">
            <h2 className="font-black">Hot jobs</h2>
            <p className="text-sm font-semibold text-black/45">Urgent, waiting parts, or open part requests.</p>
          </div>
          <div className="divide-y divide-black/5">
            {topUrgentJobs.length ? topUrgentJobs.map((job) => <Link key={job.jobId} href={`/jobs/${job.jobId}`} className="block p-4 hover:bg-black/[.02]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.city || "No city"}</p>
                  <h3 className="mt-1 font-black">{job.customerName}</h3>
                  <p className="mt-1 text-xs font-semibold text-black/45">{job.assignedCrew || "Unassigned"} · {job.dueDate || "No date"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1"><StatusBadge status={job.status} /><PriorityBadge priority={job.priority} /></div>
              </div>
            </Link>) : <p className="p-6 text-center text-sm font-semibold text-black/35">No hot jobs right now.</p>}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="font-black">Command rule</h2>
          <p className="mt-1 text-sm font-semibold text-black/50">This page recommends where to work next. Calendar, CompanyCam, billing, and customer contact stay behind explicit buttons on real jobs.</p>
        </section>
      </div>

      <section className="card p-4 sm:p-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Attention queue</h2>
          <p className="text-sm text-black/45">{items.length ? `${items.length} action items found` : "No major action items right now"}</p>
        </div>
        <Link href="/jobs" className="text-sm font-extrabold text-forest">All jobs</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.length ? items.map((item) => <div key={item.id} className="rounded-2xl border border-black/10 bg-sand p-4 transition hover:bg-white hover:shadow-soft">
          <div className="flex items-start gap-3">
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${item.tone} [&>svg]:size-5`}>{item.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black">{item.title}</h3>
                {item.job && <><StatusBadge status={item.job.status} /><PriorityBadge priority={item.job.priority} /></>}
              </div>
              <p className="mt-1 text-sm font-semibold text-black/55">{item.detail}</p>
              {item.job && <p className="mt-2 truncate text-xs font-black uppercase tracking-wide text-black/35">{item.job.jobId} · {item.job.customerName} · {item.job.city}</p>}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Link href={item.href} className="min-h-10 rounded-xl bg-forest px-3 py-2 text-center text-xs font-black text-white">Open issue</Link>
            {item.job && <Link href={`/jobs/${item.job.jobId}`} className="min-h-10 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-xs font-black text-ink">Job profile</Link>}
            {item.job && <Link href={`/jobs/${item.job.jobId}/edit`} className="min-h-10 rounded-xl bg-ink px-3 py-2 text-center text-xs font-black text-white">Edit</Link>}
          </div>
        </div>) : <div className="rounded-2xl bg-sand p-8 text-center md:col-span-2">
          <p className="font-black">Nothing major is screaming right now.</p>
          <p className="mt-1 text-sm text-black/45">That’s the app equivalent of a quiet shop. Suspicious, but nice.</p>
        </div>}
      </div>
      </section>
    </section>
  </div>;
}

function taskToCommandItem(task: JobTask): CommandItem {
  return {
    id: task.id,
    title: task.title,
    detail: task.detail,
    tone: taskTone(task),
    icon: taskIcon(task),
    href: task.href,
    job: task.job,
  };
}

function taskTone(task: JobTask) {
  if (task.category === "Urgent") return "bg-red-100 text-red-800";
  if (task.category === "Follow-up") return "bg-violet-100 text-violet-800";
  if (task.category === "Parts") return task.title.includes("picked up") ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800";
  if (task.category === "Paperwork") return "bg-amber-100 text-amber-800";
  if (task.category === "Photos") return "bg-blue-100 text-blue-800";
  if (task.category === "Billing") return task.priority === "High" ? "bg-orange-100 text-orange-800" : "bg-lime text-ink";
  return "bg-sand text-ink";
}

function taskIcon(task: JobTask) {
  if (task.category === "Urgent") return <ExclamationTriangleIcon />;
  if (task.category === "Follow-up") return <BellAlertIcon />;
  if (task.category === "Parts") return <WrenchScrewdriverIcon />;
  if (task.category === "Paperwork") return <ClipboardDocumentListIcon />;
  if (task.category === "Photos") return <CameraIcon />;
  if (task.category === "Billing") return <CurrencyDollarIcon />;
  return <BellAlertIcon />;
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/10 p-4">
    <p className="text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-white/55">{label}</p>
  </div>;
}

function CommandLane({ label, value, detail, href, icon, tone }: { label: string; value: number; detail: string; href: string; icon: React.ReactNode; tone: string }) {
  return <Link href={href} className="card block p-4 transition hover:-translate-y-0.5 hover:shadow-soft">
    <div className={`mb-3 grid size-10 place-items-center rounded-xl ${tone} [&>svg]:size-5`}>{icon}</div>
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="font-black">{label}</h2>
        <p className="mt-1 text-xs font-semibold text-black/45">{detail}</p>
      </div>
      <p className="text-3xl font-black">{value}</p>
    </div>
  </Link>;
}
