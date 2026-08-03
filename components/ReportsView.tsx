"use client";

import Link from "next/link";
import { ArrowDownTrayIcon, BanknotesIcon, BellAlertIcon, CalendarDaysIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, ClipboardDocumentListIcon, ClockIcon, ExclamationTriangleIcon, PrinterIcon, ReceiptPercentIcon, UserCircleIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/lib/types";
import { billingBlockers, openParts, readinessScore } from "@/lib/job-readiness";
import { isReceiptBackupMissing } from "@/lib/receipt-backup";
import { StatusBadge } from "./StatusBadge";

export function ReportsView({ jobs }: { jobs: Job[] }) {
  const today = new Date().toLocaleDateString("en-CA");
  const active = jobs.filter((job) => !["Complete", "Billed", "Paid"].includes(job.status));
  const todaysJobs = active.filter((job) => job.dueDate === today);
  const partsRows = jobs.flatMap((job) => openParts(job).map((part) => ({ job, part })));
  const billingJobs = jobs.filter((job) => ["Complete", "Billed", "Paid"].includes(job.status) || ["Ready", "Needs more info", "Draft", "Sent to Billing", "Sent", "On hold"].includes(job.invoiceStatus));
  const timeRows = jobs.flatMap((job) => (job.timeEntries || []).map((entry) => ({ job, entry }))).sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt));
  const signoffRows = jobs.flatMap((job) => (job.signoffs || []).map((signoff) => ({ job, signoff }))).sort((a, b) => b.signoff.signedAt.localeCompare(a.signoff.signedAt));
  const customerCount = uniqueCustomerCount(jobs);
  const followUps = jobs.reduce((total, job) => total + (job.activityLog || []).filter((entry) => entry.notify && !entry.resolvedAt).length, 0);
  const billingAttention = billingJobs.filter((job) => billingBlockers(job).length || ["Needs more info", "On hold", "Draft"].includes(job.invoiceStatus)).length;
  const receiptBackupMissing = jobs.filter((job) => isReceiptBackupMissing(job)).length;
  const overdue = active.filter((job) => job.dueDate && job.dueDate < today).length;
  const reportHealth = [
    { label: "Customers", value: customerCount, detail: `${jobs.length} total jobs`, icon: <UserCircleIcon />, tone: "bg-blue-50 text-blue-900" },
    { label: "Due today", value: todaysJobs.length, detail: "Active dispatch work", icon: <CalendarDaysIcon />, tone: "bg-lime text-ink" },
    { label: "Open parts", value: partsRows.length, detail: "Parts run rows", icon: <WrenchScrewdriverIcon />, tone: partsRows.length ? "bg-orange-50 text-orange-900" : "bg-forest/5 text-forest" },
    { label: "Follow-ups", value: followUps, detail: "Unresolved flags", icon: <BellAlertIcon />, tone: followUps ? "bg-red-50 text-red-900" : "bg-forest/5 text-forest" },
    { label: "Billing attention", value: billingAttention, detail: `${billingJobs.length} billing jobs`, icon: <BanknotesIcon />, tone: billingAttention ? "bg-orange-50 text-orange-900" : "bg-forest/5 text-forest" },
    { label: "Receipt backup", value: receiptBackupMissing, detail: "Missing uploads", icon: <ReceiptPercentIcon />, tone: receiptBackupMissing ? "bg-orange-50 text-orange-900" : "bg-forest/5 text-forest" },
    { label: "Overdue", value: overdue, detail: "Active past due", icon: <ExclamationTriangleIcon />, tone: overdue ? "bg-red-50 text-red-900" : "bg-forest/5 text-forest" },
  ];

  return <div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><ClipboardDocumentListIcon className="size-7" /></span>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-widest text-forest">Manager reports</p>
          <h1 className="text-3xl font-black">Reports & exports</h1>
          <p className="mt-1 text-sm text-black/50">Printable field handoffs and CSV exports for office work, parts runs, and billing review.</p>
        </div>
      </div>
      <button type="button" onClick={() => globalThis.print()} className="btn-secondary print:hidden"><PrinterIcon className="size-5" />Print Reports</button>
    </div>

    <section className="card overflow-hidden">
      <div className="bg-ink p-4 text-white">
        <p className="text-xs font-black uppercase tracking-widest text-lime">Manager snapshot</p>
        <h2 className="mt-1 text-2xl font-black">Office handoff at a glance</h2>
        <p className="mt-1 text-sm text-white/55">A quick read before printing, exporting, billing, or sending crews out.</p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        {reportHealth.map((item) => <SnapshotMetric key={item.label} {...item} />)}
      </div>
    </section>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:hidden">
      <ExportCard title="All jobs CSV" description="Full job list for spreadsheet backup." href="/api/reports/export?type=all-jobs" icon={<ClipboardDocumentListIcon />} />
      <ExportCard title="Daily dispatch CSV" description="Today’s active work for crews." href="/api/reports/export?type=daily-dispatch" icon={<CalendarDaysIcon />} />
      <ExportCard title="Parts run CSV" description="Open structured parts requests." href="/api/reports/export?type=parts-run" icon={<WrenchScrewdriverIcon />} />
      <ExportCard title="Billing review CSV" description="Closeout readiness and blockers." href="/api/reports/export?type=billing-review" icon={<BanknotesIcon />} />
      <ExportCard title="Customer summary CSV" description="Customer totals, repeat work, parts, follow-ups, and billing attention." href="/api/reports/export?type=customer-summary" icon={<UserCircleIcon />} />
      <ExportCard title="Document manifest CSV" description="Work orders, paperwork, signed docs, receipts, file links, and job ownership." href="/api/reports/export?type=document-manifest" icon={<ArrowDownTrayIcon />} />
      <ExportCard title="Time log CSV" description="Crew time, trip notes, and mileage." href="/api/reports/export?type=time-log" icon={<ClockIcon />} />
      <ExportCard title="Sign-offs CSV" description="Completion and approval records." href="/api/reports/export?type=signoffs" icon={<CheckCircleIcon />} />
      <ExportCard title="Communication CSV" description="Job updates and follow-up flags." href="/api/reports/export?type=communications" icon={<ChatBubbleLeftRightIcon />} />
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="card overflow-hidden">
        <ReportHeader title="Daily dispatch" subtitle={`${todaysJobs.length} active jobs due today`} />
        <div className="divide-y divide-black/5">{todaysJobs.length ? todaysJobs.map((job) => <JobLine key={job.jobId} job={job} />) : <EmptyLine text="No active jobs due today." />}</div>
      </section>

      <section className="card overflow-hidden">
        <ReportHeader title="Parts run" subtitle={`${partsRows.length} open structured parts`} />
        <div className="divide-y divide-black/5">{partsRows.length ? partsRows.map(({ job, part }) => <div key={`${job.jobId}-${part.id}`} className="p-4">
          <p className="text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.customerName}</p>
          <h3 className="mt-1 font-black">{part.quantity} × {part.name}</h3>
          <p className="mt-1 text-sm font-semibold text-black/50">{part.status} · {job.city} · {job.assignedCrew}</p>
          {part.notes && <p className="mt-2 rounded-xl bg-sand p-3 text-sm font-semibold text-black/55">{part.notes}</p>}
        </div>) : <EmptyLine text="No structured open parts right now." />}</div>
      </section>

      <section className="card overflow-hidden xl:col-span-2">
        <ReportHeader title="Recent time & trip log" subtitle={`${timeRows.length} entries across jobs`} />
        <div className="divide-y divide-black/5">{timeRows.length ? timeRows.slice(0, 12).map(({ job, entry }) => <Link key={`${job.jobId}-${entry.id}`} href={`/jobs/${job.jobId}#time-log`} className="block p-4 hover:bg-black/[.02]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.customerName}</p>
              <h3 className="mt-1 font-black">{entry.type}{entry.mileage ? ` · ${entry.mileage} miles` : ""}</h3>
              <p className="mt-1 text-sm font-semibold text-black/50">{entry.employeeName} · {new Date(entry.createdAt).toLocaleString()}</p>
            </div>
            <StatusBadge status={job.status} />
          </div>
          {entry.notes && <p className="mt-3 rounded-xl bg-sand p-3 text-sm font-semibold text-black/55">{entry.notes}</p>}
        </Link>) : <EmptyLine text="No time log entries yet." />}</div>
      </section>

      <section className="card overflow-hidden xl:col-span-2">
        <ReportHeader title="Recent sign-offs" subtitle={`${signoffRows.length} approval records across jobs`} />
        <div className="divide-y divide-black/5">{signoffRows.length ? signoffRows.slice(0, 12).map(({ job, signoff }) => <Link key={`${job.jobId}-${signoff.id}`} href={`/jobs/${job.jobId}#signoffs`} className="block p-4 hover:bg-black/[.02]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.customerName}</p>
              <h3 className="mt-1 font-black">{signoff.type}</h3>
              <p className="mt-1 text-sm font-semibold text-black/50">{signoff.signerName} · {signoff.signerRole} · {new Date(signoff.signedAt).toLocaleString()}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${signoff.accepted ? "bg-forest text-white" : "bg-orange-100 text-orange-800"}`}>{signoff.accepted ? "Accepted" : "Needs review"}</span>
          </div>
          {signoff.notes && <p className="mt-3 rounded-xl bg-sand p-3 text-sm font-semibold text-black/55">{signoff.notes}</p>}
        </Link>) : <EmptyLine text="No sign-offs saved yet." />}</div>
      </section>

      <section className="card overflow-hidden xl:col-span-2">
        <ReportHeader title="Billing review" subtitle={`${billingJobs.length} completed/billing jobs`} />
        <div className="divide-y divide-black/5">{billingJobs.length ? billingJobs.map((job) => {
          const blockers = billingBlockers(job);
          const receiptBackupMissing = isReceiptBackupMissing(job);
          return <Link key={job.jobId} href={receiptBackupMissing ? `/jobs/${job.jobId}#receipts` : `/jobs/${job.jobId}`} className="block p-4 hover:bg-black/[.02]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.source}</p>
                <h3 className="mt-1 font-black">{job.customerName}</h3>
                <p className="mt-1 text-sm font-semibold text-black/50">Invoice: {job.invoiceStatus} · {job.city}</p>
              </div>
              <div className="flex flex-wrap gap-2"><StatusBadge status={job.status} /><span className={`rounded-full px-3 py-1 text-xs font-black ${blockers.length || receiptBackupMissing ? "bg-orange-100 text-orange-800" : "bg-forest text-white"}`}>{readinessScore(job)}% ready</span>{receiptBackupMissing && <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-800">Receipt backup missing</span>}</div>
            </div>
            {receiptBackupMissing && <p className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-900">Uploaded receipt backup is missing for entered receipt dollars. Tap to open receipts.</p>}
            {blockers.length > 0 && <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">Blockers: {blockers.map((blocker) => blocker.label).join(", ")}</p>}
          </Link>;
        }) : <EmptyLine text="No billing jobs yet." />}</div>
      </section>
    </div>
  </div>;
}

function SnapshotMetric({ label, value, detail, icon, tone }: { label: string; value: number; detail: string; icon: React.ReactNode; tone: string }) {
  return <div className={`rounded-2xl p-4 ${tone}`}>
    <div className="[&>svg]:size-5">{icon}</div>
    <p className="mt-3 text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-black uppercase tracking-wide opacity-75">{label}</p>
    <p className="mt-1 text-xs font-bold text-black/45">{detail}</p>
  </div>;
}

function ExportCard({ title, description, href, icon }: { title: string; description: string; href: string; icon: React.ReactNode }) {
  return <a href={href} className="card flex min-h-36 flex-col justify-between p-4">
    <div className="grid size-10 place-items-center rounded-xl bg-lime/70 text-ink [&>svg]:size-5">{icon}</div>
    <div>
      <h2 className="font-black">{title}</h2>
      <p className="mt-1 text-sm font-semibold text-black/45">{description}</p>
    </div>
    <span className="mt-3 inline-flex items-center gap-1 text-sm font-black text-forest"><ArrowDownTrayIcon className="size-4" />Download</span>
  </a>;
}

function ReportHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="bg-sand p-4">
    <h2 className="text-lg font-black">{title}</h2>
    <p className="text-sm font-semibold text-black/45">{subtitle}</p>
  </div>;
}

function JobLine({ job }: { job: Job }) {
  return <Link href={`/jobs/${job.jobId}`} className="block p-4 hover:bg-black/[.02]">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.assignedCrew}</p>
        <h3 className="mt-1 font-black">{job.customerName}</h3>
        <p className="mt-1 text-sm font-semibold text-black/50">{job.address}, {job.city}</p>
        {job.scopeNotes && <p className="mt-2 line-clamp-2 text-sm text-black/55">{job.scopeNotes}</p>}
      </div>
      <StatusBadge status={job.status} />
    </div>
  </Link>;
}

function EmptyLine({ text }: { text: string }) {
  return <p className="p-6 text-center text-sm font-semibold text-black/35">{text}</p>;
}

function uniqueCustomerCount(jobs: Job[]) {
  const keys = new Set<string>();
  for (const job of jobs) {
    const phone = (job.phone || "").replace(/\D/g, "");
    keys.add(phone || [job.customerName, job.address, job.city].join("|").toLowerCase().replace(/\s+/g, " ").trim());
  }
  return keys.size;
}
