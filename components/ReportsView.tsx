"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownTrayIcon, BanknotesIcon, BellAlertIcon, CalendarDaysIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, ClipboardDocumentListIcon, ClockIcon, ExclamationTriangleIcon, PrinterIcon, ReceiptPercentIcon, UserCircleIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import type { Job, TimeEntry } from "@/lib/types";
import { billingBlockers, billingBoardState, intakeCompleteness, openParts, paymentFollowUpForBilling, readinessScore } from "@/lib/job-readiness";
import { closedJobStatuses, isUnassigned, recordedTravelSessions, recordedWorkSessions, type RecordedFieldSession } from "@/lib/field-activity";
import { isReceiptBackupMissing } from "@/lib/receipt-backup";
import { StatusBadge } from "./StatusBadge";

type ReportPeriod = "Today" | "This Week" | "This Month" | "Custom Range";
type JobSession = RecordedFieldSession & { job: Job };

export function ReportsView({ jobs }: { jobs: Job[] }) {
  const [period, setPeriod] = useState<ReportPeriod>("Today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const today = new Date().toLocaleDateString("en-CA");
  const customRangeError = customRangeValidationError(customStartDate, customEndDate);
  const selectedRange = period === "Custom Range"
    ? customRangeError ? undefined : { label: `${customStartDate} through ${customEndDate}`, start: customStartDate, end: customEndDate }
    : reportPeriodRange(period, today);
  const selectedRangeLabel = selectedRange?.label || "custom range (dates required)";
  const isInSelectedRange = (value?: string) => selectedRange ? isDateInRange(value, selectedRange) : false;
  const active = jobs.filter((job) => !closedJobStatuses.includes(job.status));
  const needsInformation = active.filter((job) => !intakeCompleteness(job).core.every((check) => check.ok));
  const readyToSchedule = active.filter((job) => intakeCompleteness(job).core.every((check) => check.ok) && !job.dueDate);
  const scheduled = active.filter((job) => Boolean(job.dueDate));
  const billingStates = jobs.map((job) => billingBoardState(job));
  const scheduledJobs = active.filter((job) => isInSelectedRange(job.dueDate));
  const scheduledByJobType = reportBreakdown(scheduledJobs, (job) => job.jobType?.trim() || "Job type not recorded");
  const scheduledByAssignment = reportBreakdown(scheduledJobs.filter((job) => !isUnassigned(job)), assignmentLabel);
  const unassignedScheduled = scheduledJobs.filter(isUnassigned);
  const partsRows = jobs.flatMap((job) => openParts(job).map((part) => ({ job, part })));
  const billingJobs = jobs.filter((job) => ["Complete", "Billed", "Paid"].includes(job.status) || ["Ready", "Needs more info", "Draft", "Sent to Billing", "Sent", "On hold"].includes(job.invoiceStatus));
  const timeRows = jobs.flatMap((job) => (job.timeEntries || []).map((entry) => ({ job, entry }))).filter(({ entry }) => isInSelectedRange(entry.createdAt)).sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt));
  const workSessions = jobs.flatMap((job) => recordedWorkSessions(job.timeEntries || []).map((session) => ({ job, ...session }))).filter(({ start, end }) => isInSelectedRange(start.createdAt) && isInSelectedRange(end.createdAt));
  const travelSessions = jobs.flatMap((job) => recordedTravelSessions(job.timeEntries || []).map((session) => ({ job, ...session }))).filter(({ start, end }) => isInSelectedRange(start.createdAt) && isInSelectedRange(end.createdAt));
  const periodMileageEntries = timeRows.flatMap(({ entry }) => recordedMileageValue(entry.mileage).map((mileage) => ({ entry, mileage })));
  const employeeActivity = fieldActivityByEmployee(workSessions, travelSessions, periodMileageEntries);
  const signoffRows = jobs.flatMap((job) => (job.signoffs || []).map((signoff) => ({ job, signoff }))).filter(({ signoff }) => isInSelectedRange(signoff.signedAt)).sort((a, b) => b.signoff.signedAt.localeCompare(a.signoff.signedAt));
  const invoicedInPeriod = jobs.filter((job) => isInSelectedRange(job.invoiceDate));
  const paidInPeriod = jobs.filter((job) => isInSelectedRange(job.paidDate));
  const recordedInvoiceAmountsInPeriod = invoicedInPeriod.flatMap((job) => typeof job.invoiceAmount === "number" && Number.isFinite(job.invoiceAmount) ? [job.invoiceAmount] : []);
  const unknownInvoiceAmountsInPeriod = invoicedInPeriod.length - recordedInvoiceAmountsInPeriod.length;
  const paymentFollowUpsInPeriod = jobs.flatMap((job) => {
    const followUp = paymentFollowUpForBilling(job);
    return followUp && isInSelectedRange(job.paymentDueDate) ? [followUp] : [];
  });
  const pastDueInPeriod = paymentFollowUpsInPeriod.filter((followUp) => followUp.pastDue);
  const customerCount = uniqueCustomerCount(jobs);
  const followUps = jobs.reduce((total, job) => total + (job.activityLog || []).filter((entry) => entry.notify && !entry.resolvedAt).length, 0);
  const billingAttention = billingJobs.filter((job) => billingBlockers(job).length || ["Needs more info", "On hold", "Draft"].includes(job.invoiceStatus)).length;
  const receiptBackupMissing = jobs.filter((job) => isReceiptBackupMissing(job)).length;
  const overdue = active.filter((job) => job.dueDate && job.dueDate < today).length;
  const reportHealth = [
    { label: "Customers", value: customerCount, detail: `${jobs.length} total jobs`, icon: <UserCircleIcon />, tone: "bg-blue-50 text-blue-900" },
    { label: "Open parts", value: partsRows.length, detail: "Parts run rows", icon: <WrenchScrewdriverIcon />, tone: partsRows.length ? "bg-orange-50 text-orange-900" : "bg-forest/5 text-forest" },
    { label: "Follow-ups", value: followUps, detail: "Unresolved flags", icon: <BellAlertIcon />, tone: followUps ? "bg-red-50 text-red-900" : "bg-forest/5 text-forest" },
    { label: "Billing attention", value: billingAttention, detail: `${billingJobs.length} billing jobs`, icon: <BanknotesIcon />, tone: billingAttention ? "bg-orange-50 text-orange-900" : "bg-forest/5 text-forest" },
    { label: "Receipt backup", value: receiptBackupMissing, detail: "Missing uploads", icon: <ReceiptPercentIcon />, tone: receiptBackupMissing ? "bg-orange-50 text-orange-900" : "bg-forest/5 text-forest" },
    { label: "Overdue", value: overdue, detail: "Active past due", icon: <ExclamationTriangleIcon />, tone: overdue ? "bg-red-50 text-red-900" : "bg-forest/5 text-forest" },
  ];
  const executiveSnapshot = [
    { label: "Active jobs", value: active.length, detail: "Open current-state jobs", icon: <ClipboardDocumentListIcon />, tone: "bg-blue-50 text-blue-900" },
    { label: "Needs information", value: needsInformation.length, detail: "Active jobs with incomplete intake", icon: <ExclamationTriangleIcon />, tone: needsInformation.length ? "bg-orange-50 text-orange-900" : "bg-forest/5 text-forest" },
    { label: "Ready to schedule", value: readyToSchedule.length, detail: "Complete intake; no scheduled date", icon: <CalendarDaysIcon />, tone: readyToSchedule.length ? "bg-lime text-ink" : "bg-forest/5 text-forest" },
    { label: "Scheduled", value: scheduled.length, detail: "Active jobs with a scheduled date", icon: <CalendarDaysIcon />, tone: scheduled.length ? "bg-blue-50 text-blue-900" : "bg-forest/5 text-forest" },
    { label: "Ready to invoice", value: billingStates.filter((state) => state === "Ready to Invoice").length, detail: "Current billing readiness", icon: <CheckCircleIcon />, tone: "bg-emerald-100 text-emerald-900" },
    { label: "Invoiced", value: billingStates.filter((state) => state === "Invoiced").length, detail: "Current billing lifecycle", icon: <BanknotesIcon />, tone: "bg-blue-100 text-blue-900" },
    { label: "Paid / complete", value: billingStates.filter((state) => state === "Paid / Complete").length, detail: "Payment or completed status recorded", icon: <CheckCircleIcon />, tone: "bg-lime/60 text-ink" },
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
        <p className="text-xs font-black uppercase tracking-widest text-lime">Current-state executive snapshot</p>
        <h2 className="mt-1 text-2xl font-black">Manager reporting at a glance</h2>
        <p className="mt-1 text-sm text-white/55">These are current-state metrics, not historical results for a date range.</p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {executiveSnapshot.map((item) => <SnapshotMetric key={item.label} {...item} />)}
      </div>
    </section>

    <section className="card overflow-hidden">
      <div className="bg-sand p-4">
        <p className="text-xs font-black uppercase tracking-widest text-forest">Field activity report</p>
        <h2 className="mt-1 text-lg font-black">Recorded field activity for {selectedRangeLabel}</h2>
        <p className="mt-1 text-sm font-semibold text-black/50">Recorded work-session and travel time require paired events within this period. They are field records, not payroll, labor, cost, or productivity measures.</p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <SnapshotMetric label="Recorded work-session time" value={formatRecordedMinutes(workSessions)} detail={workSessions.length ? `${workSessions.length} fully paired sessions` : "Not recorded; incomplete sessions excluded"} icon={<ClockIcon />} tone="bg-blue-50 text-blue-900" />
        <SnapshotMetric label="Recorded travel time" value={formatRecordedMinutes(travelSessions)} detail={travelSessions.length ? `${travelSessions.length} fully paired trips` : "Not recorded; incomplete trips excluded"} icon={<CalendarDaysIcon />} tone="bg-forest/5 text-forest" />
        <SnapshotMetric label="Recorded mileage" value={formatMileage(periodMileageEntries.map(({ mileage }) => mileage))} detail={periodMileageEntries.length ? `${periodMileageEntries.length} reliable entries` : "Not recorded"} icon={<ClockIcon />} tone="bg-forest/5 text-forest" />
        <SnapshotMetric label="Jobs with field activity" value={new Set(timeRows.map(({ job }) => job.jobId)).size} detail={`${timeRows.length} recorded entries in period`} icon={<ClipboardDocumentListIcon />} tone="bg-lime/60 text-ink" />
      </div>
      <div className="border-t border-black/5 p-4">
        <p className="mb-3 text-sm font-black">Employee activity where recorded</p>
        {employeeActivity.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{employeeActivity.map((employee) => <div key={employee.name} className="rounded-xl bg-sand p-3"><p className="font-black">{employee.name}</p><p className="mt-1 text-sm font-semibold text-black/55">Work {employee.workRecorded ? formatMinutes(employee.workMinutes) : "Not recorded"} · Travel {employee.travelRecorded ? formatMinutes(employee.travelMinutes) : "Not recorded"} · {employee.mileageRecorded ? `${employee.mileage.toFixed(1)} mi` : "Not recorded"}</p></div>)}</div> : <p className="text-sm font-semibold text-black/40">No reliably attributed employee activity is recorded for this period.</p>}
      </div>
    </section>

    <section aria-labelledby="date-based-reporting">
      <p className="text-xs font-black uppercase tracking-widest text-forest">Date-based operational reporting</p>
      <h2 id="date-based-reporting" className="mt-1 text-xl font-black">{period} dispatch and recorded activity</h2>
      <p className="mt-1 text-sm font-semibold text-black/50">Scheduling uses due date, field records use their recorded timestamp, invoices use invoice date, and payments use paid date. These controls do not change current-state metrics.</p>
      <div className="mt-3 flex flex-wrap gap-2 print:hidden" role="group" aria-label="Report period">
        {(["Today", "This Week", "This Month", "Custom Range"] as ReportPeriod[]).map((option) => <button key={option} type="button" onClick={() => setPeriod(option)} aria-pressed={period === option} className={`min-h-11 rounded-xl px-4 py-2 text-sm font-black ${period === option ? "bg-forest text-white" : "border border-black/10 bg-white text-forest"}`}>{option}</button>)}
      </div>
      {period === "Custom Range" && <div className="mt-3 grid gap-3 rounded-2xl border border-black/10 bg-sand p-3 sm:grid-cols-2 print:hidden">
        <label className="grid gap-1 text-sm font-black text-forest">Start Date<input type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} max={customEndDate || undefined} className="min-h-11 rounded-xl border border-black/15 bg-white px-3 font-semibold text-ink" /></label>
        <label className="grid gap-1 text-sm font-black text-forest">End Date<input type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} min={customStartDate || undefined} className="min-h-11 rounded-xl border border-black/15 bg-white px-3 font-semibold text-ink" /></label>
        {customRangeError && <p className="sm:col-span-2 text-sm font-bold text-red-800" role="alert">{customRangeError}</p>}
      </div>}
    </section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SnapshotMetric label="Scheduled jobs" value={scheduledJobs.length} detail="Due date in selected period" icon={<CalendarDaysIcon />} tone="bg-blue-50 text-blue-900" />
      <SnapshotMetric label="Field activity" value={timeRows.length} detail="Time-entry timestamps in period" icon={<ClockIcon />} tone="bg-forest/5 text-forest" />
      <SnapshotMetric label="Invoice records" value={invoicedInPeriod.length} detail="Invoice date in selected period" icon={<BanknotesIcon />} tone="bg-blue-100 text-blue-900" />
      <SnapshotMetric label="Payment records" value={paidInPeriod.length} detail="Paid date in selected period; no dollar amount inferred" icon={<CheckCircleIcon />} tone="bg-lime/60 text-ink" />
    </section>

    <section className="card overflow-hidden">
      <div className="bg-sand p-4">
        <p className="text-xs font-black uppercase tracking-widest text-forest">Billing performance</p>
        <h2 className="mt-1 text-lg font-black">Recorded billing for {selectedRangeLabel}</h2>
        <p className="mt-1 text-sm font-semibold text-black/50">Invoices use invoice date. Payment follow-up and past-due counts use recorded payment due date; paid dates do not establish paid amounts.</p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <SnapshotMetric label="Jobs invoiced" value={invoicedInPeriod.length} detail="Invoice date in selected period" icon={<BanknotesIcon />} tone="bg-blue-100 text-blue-900" />
        <SnapshotMetric label="Recorded invoice amount" value={formatMoney(recordedInvoiceAmountsInPeriod)} detail={unknownInvoiceAmountsInPeriod ? `${recordedInvoiceAmountsInPeriod.length} recorded; ${unknownInvoiceAmountsInPeriod} unknown` : `${recordedInvoiceAmountsInPeriod.length} recorded invoice amounts`} icon={<BanknotesIcon />} tone="bg-forest/5 text-forest" />
        <SnapshotMetric label="Payment follow-up" value={paymentFollowUpsInPeriod.length} detail="Payment due date in selected period" icon={<BellAlertIcon />} tone={paymentFollowUpsInPeriod.length ? "bg-orange-50 text-orange-900" : "bg-forest/5 text-forest"} />
        <SnapshotMetric label="Past due" value={pastDueInPeriod.length} detail="Past due only when payment due date proves it" icon={<ExclamationTriangleIcon />} tone={pastDueInPeriod.length ? "bg-red-50 text-red-900" : "bg-forest/5 text-forest"} />
      </div>
      <div className="grid gap-3 border-t border-black/5 p-4 sm:grid-cols-3">
        <SnapshotMetric label="Ready to invoice" value={billingStates.filter((state) => state === "Ready to Invoice").length} detail="Current billing readiness" icon={<CheckCircleIcon />} tone="bg-emerald-100 text-emerald-900" />
        <SnapshotMetric label="Invoiced" value={billingStates.filter((state) => state === "Invoiced").length} detail="Current billing lifecycle" icon={<BanknotesIcon />} tone="bg-blue-100 text-blue-900" />
        <SnapshotMetric label="Paid / complete" value={billingStates.filter((state) => state === "Paid / Complete").length} detail="Current payment or completion status" icon={<CheckCircleIcon />} tone="bg-lime/60 text-ink" />
      </div>
    </section>

    <section className="card overflow-hidden">
      <div className="bg-sand p-4">
        <p className="text-xs font-black uppercase tracking-widest text-forest">Scheduling report</p>
        <h2 className="mt-1 text-lg font-black">Scheduled work for {selectedRangeLabel}</h2>
        <p className="mt-1 text-sm font-semibold text-black/50">Active jobs grouped by scheduled date, job type, and recorded assignment. This is not a utilization or capacity measure.</p>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-3">
        <ReportBreakdown title="By job type" rows={scheduledByJobType} emptyText="No scheduled jobs in this period." />
        <ReportBreakdown title="By crew / assignment" rows={scheduledByAssignment} emptyText="No assigned scheduled jobs in this period." />
        <div className="rounded-2xl bg-orange-50 p-4 text-orange-950">
          <p className="text-xs font-black uppercase tracking-wide text-orange-800">Unassigned scheduled jobs</p>
          <p className="mt-2 text-3xl font-black">{unassignedScheduled.length}</p>
          <p className="mt-1 text-sm font-semibold text-orange-900/70">Scheduled jobs without a recorded crew or employee assignment.</p>
          {unassignedScheduled.length > 0 && <div className="mt-3 space-y-2">{unassignedScheduled.slice(0, 4).map((job) => <Link key={job.jobId} href={`/jobs/${job.jobId}/edit`} className="block rounded-xl bg-white/70 px-3 py-2 text-sm font-black hover:bg-white">{job.customerName || "Customer not recorded"} <span className="text-orange-900/55">· {job.jobId}</span></Link>)}</div>}
        </div>
      </div>
    </section>

    <section className="card overflow-hidden">
      <div className="bg-sand p-4">
        <p className="text-xs font-black uppercase tracking-widest text-forest">Operational health</p>
        <h2 className="mt-1 text-lg font-black">Current office handoff</h2>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
        <ReportHeader title="Scheduled dispatch" subtitle={`${scheduledJobs.length} active jobs due ${selectedRangeLabel.toLowerCase()}`} />
        <div className="divide-y divide-black/5">{scheduledJobs.length ? scheduledJobs.map((job) => <JobLine key={job.jobId} job={job} />) : <EmptyLine text={`No active jobs due ${selectedRangeLabel.toLowerCase()}.`} />}</div>
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
        <ReportHeader title="Time & trip log" subtitle={`${timeRows.length} entries recorded ${selectedRangeLabel.toLowerCase()}`} />
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
        <ReportHeader title="Sign-offs" subtitle={`${signoffRows.length} approval records recorded ${selectedRangeLabel.toLowerCase()}`} />
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
        <ReportHeader title="Billing review" subtitle={`${billingJobs.length} current completed/billing jobs`} />
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

function SnapshotMetric({ label, value, detail, icon, tone }: { label: string; value: number | string; detail: string; icon: React.ReactNode; tone: string }) {
  return <div className={`rounded-2xl p-4 ${tone}`}>
    <div className="[&>svg]:size-5">{icon}</div>
    <p className="mt-3 text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-black uppercase tracking-wide opacity-75">{label}</p>
    <p className="mt-1 text-xs font-bold text-black/45">{detail}</p>
  </div>;
}

function formatMoney(amounts: number[]) {
  if (!amounts.length) return "Not recorded";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amounts.reduce((total, amount) => total + amount, 0));
}

function formatMileage(amounts: number[]) {
  return amounts.length ? `${amounts.reduce((total, amount) => total + amount, 0).toFixed(1)} mi` : "Not recorded";
}

function reportPeriodRange(period: ReportPeriod, today: string) {
  if (period === "Today") return { label: "today", start: today, end: today };
  if (period === "This Month") return { label: "this month", start: `${today.slice(0, 7)}-01`, end: `${today.slice(0, 7)}-31` };
  const date = new Date(`${today}T00:00:00`);
  const mondayOffset = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { label: "this week", start: dateKey(start), end: dateKey(end) };
}

function customRangeValidationError(start: string, end: string) {
  if (!start || !end) return "Start Date and End Date are required for a custom range.";
  if (start > end) return "Start Date must be on or before End Date.";
  return "";
}

function isDateInRange(value: string | undefined, range: { start: string; end: string }) {
  const date = value?.slice(0, 10);
  return Boolean(date && date >= range.start && date <= range.end);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function recordedMileageValue(value?: string) {
  if (value === undefined || value.trim() === "") return [];
  const mileage = Number(value);
  return Number.isFinite(mileage) && mileage >= 0 ? [mileage] : [];
}

function formatRecordedMinutes(sessions: JobSession[]) {
  return sessions.length ? formatMinutes(sessions.reduce((total, session) => total + session.minutes, 0)) : "Not recorded";
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? remainder ? `${hours}h ${remainder}m` : `${hours}h` : `${remainder}m`;
}

function fieldActivityByEmployee(workSessions: JobSession[], travelSessions: JobSession[], mileageEntries: Array<{ entry: TimeEntry; mileage: number }>) {
  const activity = new Map<string, { name: string; workMinutes: number; travelMinutes: number; mileage: number; workRecorded: boolean; travelRecorded: boolean; mileageRecorded: boolean }>();
  const add = (name: string, change: Partial<{ workMinutes: number; travelMinutes: number; mileage: number; workRecorded: boolean; travelRecorded: boolean; mileageRecorded: boolean }>) => {
    const existing = activity.get(name) || { name, workMinutes: 0, travelMinutes: 0, mileage: 0, workRecorded: false, travelRecorded: false, mileageRecorded: false };
    existing.workMinutes += change.workMinutes || 0;
    existing.travelMinutes += change.travelMinutes || 0;
    existing.mileage += change.mileage || 0;
    existing.workRecorded ||= Boolean(change.workRecorded);
    existing.travelRecorded ||= Boolean(change.travelRecorded);
    existing.mileageRecorded ||= Boolean(change.mileageRecorded);
    activity.set(name, existing);
  };
  for (const session of workSessions) if (session.employeeName) add(session.employeeName, { workMinutes: session.minutes, workRecorded: true });
  for (const session of travelSessions) if (session.employeeName) add(session.employeeName, { travelMinutes: session.minutes, travelRecorded: true });
  for (const { entry, mileage } of mileageEntries) if (entry.employeeName?.trim()) add(entry.employeeName.trim(), { mileage, mileageRecorded: true });
  return [...activity.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function reportBreakdown(jobs: Job[], labelFor: (job: Job) => string) {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const label = labelFor(job);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function assignmentLabel(job: Job) {
  if (job.fullCrew) return "Full crew";
  if (job.assignedCrew?.trim() && job.assignedCrew !== "Unassigned") return job.assignedCrew;
  return job.assignedEmployeeIds?.length === 1 ? "Assigned employee" : `${job.assignedEmployeeIds?.length || 0} assigned employees`;
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

function ReportBreakdown({ title, rows, emptyText }: { title: string; rows: Array<{ label: string; value: number }>; emptyText: string }) {
  return <div className="rounded-2xl border border-black/5">
    <div className="border-b border-black/5 px-4 py-3"><h3 className="font-black">{title}</h3></div>
    <div className="divide-y divide-black/5">{rows.length ? rows.map((row) => <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3"><span className="min-w-0 truncate text-sm font-semibold text-black/60">{row.label}</span><span className="rounded-full bg-forest/5 px-3 py-1 text-sm font-black text-forest">{row.value}</span></div>) : <p className="p-4 text-sm font-semibold text-black/40">{emptyText}</p>}</div>
  </div>;
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
