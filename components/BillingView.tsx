"use client";

import { useAuthUser } from "./AuthGate";

import { AddNewSelect } from "./AddNewSelect";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BanknotesIcon, CheckCircleIcon, ClipboardDocumentListIcon, ClockIcon, ExclamationTriangleIcon, ReceiptPercentIcon } from "@heroicons/react/24/outline";
import { authFetch, jobUpdateBody } from "@/lib/client-auth";
import { factoryCostGrandTotal, getFactoryCostTotals } from "@/lib/factory-costs";
import { isReceiptBackupMissing } from "@/lib/receipt-backup";
import type { Job, JobActivity } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { billingBoardState, billingBoardStates, billingBlockers, isReadyForBilling, paymentFollowUpForBilling, readinessScore, type BillingBoardState } from "@/lib/job-readiness";

type OfficeBillingAction = {
  id: string;
  job: Job;
  title: string;
  reason: string;
  href: string;
  priority: "High" | "Normal";
};

type PaymentFollowUp = NonNullable<ReturnType<typeof paymentFollowUpForBilling>> & { job: Job };

export function BillingView() {
  const user = useAuthUser();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"All" | BillingBoardState>("Ready to Invoice");
  const [copiedJobId, setCopiedJobId] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [copyFallback, setCopyFallback] = useState<{ jobId: string; text: string } | null>(null);

  useEffect(() => {
    authFetch("/api/jobs").then((response) => response.json()).then((data) => setJobs(Array.isArray(data) ? data : [])).finally(() => setLoading(false));
  }, []);

  const billable = useMemo(() => jobs.filter((job) => ["Complete", "Billed", "Paid"].includes(job.status) || ["Ready", "Needs more info", "Draft", "Sent to Billing", "Sent", "On hold"].includes(job.invoiceStatus)), [jobs]);
  const boardGroups = useMemo(() => Object.fromEntries(billingBoardStates.map((state) => [state, jobs.filter((job) => billingBoardState(job) === state)])) as Record<BillingBoardState, Job[]>, [jobs]);
  const filtered = filter === "All" ? jobs : boardGroups[filter] || [];
  const notReady = boardGroups["Not Ready"].length;
  const readyToInvoice = boardGroups["Ready to Invoice"].length;
  const withBilling = boardGroups["With billing"].length;
  const invoiced = boardGroups["Invoice sent"].length;
  const paid = boardGroups["Paid / Complete"].length;
  const officeActions = useMemo(() => jobs.flatMap((job) => {
    const action = officeBillingActionFor(job);
    return action ? [{ ...action, id: `${job.jobId}-office-billing-action`, job }] : [];
  }).sort((a, b) => officeActionRank(a.priority) - officeActionRank(b.priority) || a.job.customerName.localeCompare(b.job.customerName)), [jobs]);
  const paymentFollowUps = useMemo(() => jobs.flatMap((job) => {
    const followUp = paymentFollowUpForBilling(job);
    return followUp ? [{ ...followUp, job }] : [];
  }).sort((a, b) => Number(b.pastDue) - Number(a.pastDue) || a.invoiceTimestamp - b.invoiceTimestamp || a.job.customerName.localeCompare(b.job.customerName)), [jobs]);
  const receiptTotal = billable.reduce((sum, job) => sum + (job.receipts || []).reduce((total, receipt) => total + (Number(receipt.amount) || 0), 0), 0);
  const factoryCostTotal = billable.reduce((sum, job) => sum + factoryCostGrandTotal(job), 0);
  const fileTotal = billable.reduce((sum, job) => sum + (job.workOrderFiles?.length || 0), 0);
  const lanes = [
    { label: "Not Ready", value: notReady, detail: "Billing blockers open", icon: <ExclamationTriangleIcon />, tone: notReady ? "bg-orange-100 text-orange-900" : "bg-content/5 text-content/65" },
    { label: "Ready to Invoice", value: readyToInvoice, detail: "Cleared by billing readiness", icon: <CheckCircleIcon />, tone: readyToInvoice ? "bg-emerald-100 text-emerald-900" : "bg-content/5 text-content/65" },
    { label: "With billing", value: withBilling, detail: "Awaiting invoice creation", icon: <ClipboardDocumentListIcon />, tone: withBilling ? "bg-blue-50 text-blue-900" : "bg-content/5 text-content/65" },
    { label: "Invoice sent", value: invoiced, detail: "Customer invoice recorded as sent", icon: <BanknotesIcon />, tone: invoiced ? "bg-blue-100 text-blue-900" : "bg-content/5 text-content/65" },
    { label: "Paid / Complete", value: paid, detail: "Payment recorded", icon: <ClockIcon />, tone: paid ? "bg-lime/60 text-ink" : "bg-content/5 text-content/65" },
  ];

  async function updateBilling(job: Job, invoiceStatus: string, message: string, extra: Partial<Job> = {}) {
    const activity: JobActivity = {
      id: `activity-${Date.now()}`,
      type: "Invoice",
      message,
      createdAt: new Date().toISOString(),
      createdBy: "Billing",
      audience: "Admin",
      notify: invoiceStatus === "Needs more info",
    };
    const patch: Partial<Job> = {
      ...extra,
      invoiceStatus,
      activityLog: [activity, ...(job.activityLog || [])].slice(0, 50),
    };
    setSaveError("");
    try {
    const response = await authFetch(`/api/jobs/${job.jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: jobUpdateBody(job, patch, user?.id) });
    const saved = await response.json();
    if (!response.ok) throw new Error(saved.error || "Billing update could not be saved.");
    setJobs((old) => old.map((item) => item.jobId === job.jobId ? { ...item, ...saved } : item));
    } catch (caught) { setSaveError(caught instanceof Error ? caught.message : "Billing update could not be saved."); }
  }

  async function copyBillingSummary(job: Job) {
    const receiptSum = (job.receipts || []).reduce((sum, receipt) => sum + (Number(receipt.amount) || 0), 0);
    const factoryCosts = getFactoryCostTotals(job.factoryCost);
    const blockers = billingBlockers(job);
    const summary = [
      `Billing handoff - ${job.jobId}`,
      `Customer: ${job.customerName}`,
      `Source: ${job.source}${job.dealerName ? ` - ${job.dealerName}` : ""}`,
      `Factory WO: ${job.factoryWorkOrderNumber || "N/A"}`,
      `Address: ${job.address}, ${job.city}`,
      `Phone: ${job.phone || "N/A"}`,
      `Job type: ${job.jobType || "N/A"}`,
      `Status: ${job.status}`,
      `Invoice status: ${job.invoiceStatus || "Not started"}`,
      `Invoice date: ${job.invoiceDate || "Not recorded"}`,
      `Invoice amount: ${job.invoiceAmount === undefined ? "Not recorded" : `$${job.invoiceAmount.toFixed(2)}`}`,
      `Payment due date: ${job.paymentDueDate || "Not recorded"}`,
      `Paid date: ${job.paidDate || "Not recorded"}`,
      `Closeout score: ${readinessScore(job)}%`,
      `Receipts: ${job.receipts?.length || 0} totaling $${receiptSum.toFixed(2)}`,
      job.source === "Factory" ? `Factory cost total: $${factoryCosts.grandTotal.toFixed(2)}` : "",
      job.source === "Factory" ? `Factory breakdown: mileage $${factoryCosts.mileage.toFixed(2)}, labor $${(factoryCosts.driveTime + factoryCosts.helper).toFixed(2)}, per diem $${factoryCosts.perDiem.toFixed(2)}, receipts $${(factoryCosts.hotel + factoryCosts.materials + factoryCosts.otherReceipts).toFixed(2)}` : "",
      `Files: ${job.workOrderFiles?.length || 0}`,
      `Sign-offs: ${job.signoffs?.length || 0}`,
      `Completion notes: ${job.completionNotes || "Missing"}`,
      blockers.length ? `Blockers: ${blockers.map((blocker) => blocker.label).join(", ")}` : "Blockers: None",
    ].filter(Boolean).join("\n");
    setCopiedJobId("");
    setCopyFallback(null);
    setCopyMessage("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(summary);
      setCopiedJobId(job.jobId);
      setCopyMessage(`Billing summary for ${job.jobId} copied.`);
      window.setTimeout(() => setCopiedJobId((current) => current === job.jobId ? "" : current), 2200);
    } catch {
      setCopyMessage(`Could not copy ${job.jobId}. Retry, or select and copy its summary below.`);
      setCopyFallback({ jobId: job.jobId, text: summary });
    }
  }

  return <div className="mx-auto max-w-7xl space-y-5">
    {copyMessage && <p role="status" className="card p-4 text-sm font-semibold">{copyMessage}</p>}
    {saveError && <p role="alert" className="card p-4 text-orange-800">{saveError}</p>}
    <section className="rounded-2xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><BanknotesIcon className="size-7" /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-lime">Billing command</p>
          <h1 className="text-3xl font-bold">Invoice handoff</h1>
          <p className="mt-1 text-sm text-white/65">Review closeout packets, receipts, paperwork, blockers, and invoice status before billing.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <HeroMetric label="Jobs tracked" value={jobs.length} />
        <HeroMetric label="Ready to invoice" value={readyToInvoice} />
        <HeroMetric label="Not ready" value={notReady} />
        <HeroMetric label="Receipt total" value={`$${receiptTotal.toFixed(0)}`} />
        <HeroMetric label="Factory costs" value={`$${factoryCostTotal.toFixed(0)}`} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-4">
        <Link href="/documents" className="min-h-12 rounded-xl bg-lime px-4 py-3 text-center font-bold text-ink">Documents</Link>
        <Link href="/reports" className="min-h-12 rounded-xl bg-white/10 px-4 py-3 text-center font-bold text-white">Reports</Link>
        <a href="/api/reports/export?type=billing-review" className="min-h-12 rounded-xl bg-white/10 px-4 py-3 text-center font-bold text-white">Billing CSV</a>
        {user?.role === "Admin" && <Link href="/settings" className="min-h-12 rounded-xl bg-white/10 px-4 py-3 text-center font-bold text-white">Invoice settings</Link>}
      </div>
    </section>

    <section className="space-y-3">
      <div><p className="text-xs font-bold uppercase tracking-widest text-accent">Billing status board</p><h2 className="mt-1 text-xl font-bold">Billing dashboard summary</h2><p className="mt-1 text-sm font-semibold text-content/65">Each count is a current lifecycle group using the shared billing readiness check and existing invoice records.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {lanes.map((lane) => <BillingLane key={lane.label} {...lane} onClick={() => setFilter(lane.label as BillingBoardState)} />)}
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Paid/closed" value={paid} icon={<CheckCircleIcon />} />
      <Metric label="Receipt dollars" value={`$${receiptTotal.toFixed(2)}`} icon={<ReceiptPercentIcon />} />
      <Metric label="Factory totals" value={`$${factoryCostTotal.toFixed(2)}`} icon={<BanknotesIcon />} />
      <Metric label="Backup files" value={fileTotal} icon={<ClipboardDocumentListIcon />} />
    </section>

    <section className="card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink"><BanknotesIcon className="size-5" /></span>
        <div>
          <h2 className="font-bold">Invoice Simple guardrail</h2>
          <p className="mt-1 text-sm font-semibold text-content/65">This queue prepares invoice handoffs. It does not create Invoice Simple invoices yet; that connector can be added later after account/API details are chosen.</p>
        </div>
      </div>
    </section>

    <section className="card overflow-hidden">
      <div className="border-b border-content/10 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Office daily action queue</p>
        <h2 className="mt-1 text-lg font-bold">Billing work that needs action</h2>
      </div>
      <div className="hidden grid-cols-[minmax(9rem,.8fr)_minmax(12rem,1fr)_minmax(15rem,1.5fr)_auto] gap-4 border-b border-content/10 bg-sand/60 px-4 py-3 text-xs font-bold uppercase tracking-wide text-content/65 md:grid">
        <span>Action</span><span>Customer / job</span><span>Reason</span><span>Open</span>
      </div>
      {officeActions.length ? <div className="divide-y divide-content/10">{officeActions.map((action) => <OfficeBillingActionRow key={action.id} action={action} />)}</div> : <div className="p-6 text-center text-sm font-semibold text-content/65">No office billing actions right now.</div>}
    </section>

    <section className="card overflow-hidden">
      <div className="border-b border-content/10 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Payment follow-up</p>
        <h2 className="mt-1 text-lg font-bold">Invoiced jobs to review</h2>
        <p className="mt-1 text-sm font-semibold text-content/65">Past-due invoices appear first. Jobs without a due date show invoice age instead.</p>
      </div>
      {paymentFollowUps.length ? <div className="divide-y divide-content/10">{paymentFollowUps.map((followUp) => <PaymentFollowUpRow key={followUp.job.jobId} followUp={followUp} />)}</div> : <div className="p-6 text-center text-sm font-semibold text-content/65">No payment follow-up needed right now.</div>}
    </section>

    <section className="card p-3 sm:p-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <p className="text-sm font-bold text-content/65">{loading ? "Loading billing jobs…" : `${filtered.length} jobs in ${filter === "All" ? "all billing states" : filter}`}</p>
        <AddNewSelect choiceKey="billingState" value={filter} onChange={(event) => setFilter(event.target.value === "Invoiced" ? "Invoice sent" : event.target.value as "All" | BillingBoardState)} className="field !min-h-11 !py-2 text-sm font-bold">
          <option>All</option>
          {billingBoardStates.map((state) => <option key={state}>{state}</option>)}
        </AddNewSelect>
      </div>
    </section>

    <div className="grid gap-3">
      {!loading && filtered.length === 0 ? <div className="card p-8 text-center"><p className="font-bold">No billing jobs in this filter.</p></div> : null}
      {filtered.map((job) => <div key={job.jobId} className="card p-4">
        {(() => {
          const blockers = billingBlockers(job);
          const score = readinessScore(job);
          const receiptSum = (job.receipts || []).reduce((sum, receipt) => sum + (Number(receipt.amount) || 0), 0);
          const factoryCosts = getFactoryCostTotals(job.factoryCost);
          const receiptBackupMissing = isReceiptBackupMissing(job);
          return <>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-accent">{job.jobId} · {job.source}</p>
            <h2 className="mt-1 text-xl font-bold">{job.customerName}</h2>
            <p className="text-sm font-semibold text-content/65">{job.address}, {job.city}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={job.status} />
            <span className="rounded-full bg-lime/60 px-3 py-1 text-xs font-bold text-ink">Invoice: {job.invoiceStatus || "Not started"}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${blockers.length ? "bg-orange-100 text-orange-800" : "bg-forest text-white"}`}>{score}% ready</span>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-sm font-semibold text-content/65 sm:grid-cols-4">
          <InfoPill label="Receipts" value={`${job.receipts?.length || 0} · $${receiptSum.toFixed(2)}`} />
          <InfoPill label="Factory total" value={job.source === "Factory" ? `$${factoryCosts.grandTotal.toFixed(2)}` : "N/A"} />
          <InfoPill label="Files" value={job.workOrderFiles?.length || 0} />
          <InfoPill label="Sign-offs" value={job.signoffs?.length || 0} />
          <InfoPill label="Notes" value={job.completionNotes ? "Added" : "Missing"} />
          <InfoPill label="Invoice date" value={job.invoiceDate || "Not recorded"} />
          <InfoPill label="Invoice amount" value={job.invoiceAmount === undefined ? "Not recorded" : `$${job.invoiceAmount.toFixed(2)}`} />
          <InfoPill label="Payment due" value={job.paymentDueDate || "Not recorded"} />
          <InfoPill label="Paid date" value={job.paidDate || "Not recorded"} />
        </div>
        {job.source === "Factory" && <FactoryCostBreakdown totals={factoryCosts} />}
        {receiptBackupMissing && <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-900">
          Receipt backup missing for entered dollars. <Link href={`/jobs/${job.jobId}#receipts`} className="underline">Open receipts</Link>
        </div>}
        {blockers.length > 0 && <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">Needs review: {blockers.map((blocker) => blocker.label).join(", ")}</p>}
        <div className="mt-3 grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <Link href={`/jobs/${job.jobId}`} className="min-h-11 rounded-xl border border-content/10 bg-surface px-3 py-2 text-center text-sm font-bold text-content">Open job</Link>
          <Link href={`/jobs/${job.jobId}/packet`} className="min-h-11 rounded-xl border border-content/10 bg-surface px-3 py-2 text-center text-sm font-bold text-content">Packet</Link>
          <Link href={`/jobs/${job.jobId}#billing-handoff`} className="min-h-11 rounded-xl border border-content/10 bg-surface px-3 py-2 text-center text-sm font-bold text-content">Handoff</Link>
          <button type="button" onClick={() => copyBillingSummary(job)} className="min-h-11 rounded-xl border border-content/10 bg-surface px-3 py-2 text-sm font-bold text-content">{copiedJobId === job.jobId ? "Copied" : "Copy Summary"}</button>
          <button type="button" disabled={blockers.length > 0} onClick={() => updateBilling(job, "Ready", "Billing queue: marked Ready for Invoice.")} className="min-h-11 rounded-xl bg-forest px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Ready</button>
          <button type="button" onClick={() => updateBilling(job, "Needs more info", "Billing queue: marked Needs more info.")} className="min-h-11 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-900">Need Info</button>
          <button type="button" disabled={blockers.length > 0 || job.invoiceStatus !== "Ready"} onClick={() => updateBilling(job, "Sent to Billing", "Billing queue: sent to billing.")} className="min-h-11 rounded-xl bg-ink px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Send to billing</button>
          <button type="button" disabled={blockers.length > 0 || !["Sent to Billing", "Ready", "Draft"].includes(job.invoiceStatus)} onClick={() => updateBilling(job, "Sent", "Billing queue: invoice sent to customer.", { status: job.status === "Complete" ? "Billed" : job.status })} className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-900 disabled:opacity-50">Invoice sent</button>
          <button type="button" onClick={() => updateBilling(job, "On hold", "Billing queue: invoice placed on hold for follow-up.")} className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">On Hold</button>
          <button type="button" disabled={blockers.length > 0 || (!["Sent", "Billed", "Paid"].includes(job.invoiceStatus) && job.status !== "Billed")} onClick={() => updateBilling(job, "Paid", "Billing queue: invoice marked paid.", { status: "Paid" })} className="min-h-11 rounded-xl bg-lime px-3 py-2 text-sm font-bold text-ink disabled:opacity-50">Paid</button>
        </div>
        {copyFallback?.jobId === job.jobId && <label className="mt-3 block text-sm font-bold">Billing summary<textarea readOnly value={copyFallback.text} onFocus={event => event.target.select()} className="field mt-1 min-h-56" /></label>}
        </>;
        })()}
      </div>)}
    </div>
  </div>;
}

function officeBillingActionFor(job: Job): Omit<OfficeBillingAction, "id" | "job"> | null {
  const lifecycle = billingBoardState(job);
  const hasBillingHandoff = ["Complete", "Billed"].includes(job.status) || ["Ready", "Needs more info", "Draft", "Sent to Billing", "Sent", "On hold"].includes(job.invoiceStatus);
  if (!hasBillingHandoff) return null;

  if (job.invoiceStatus === "Needs more info") {
    return { title: "Complete billing handoff", reason: "Office requested more paperwork, notes, receipt detail, or closeout backup.", href: `/jobs/${job.jobId}#billing-handoff`, priority: "High" };
  }
  if (job.invoiceStatus === "On hold") {
    return { title: "Review billing hold", reason: "This billing handoff is currently on hold.", href: `/jobs/${job.jobId}#billing-handoff`, priority: "High" };
  }
  if (isReceiptBackupMissing(job)) {
    return { title: "Attach receipt backup", reason: "Entered receipt dollars need an uploaded receipt file.", href: `/jobs/${job.jobId}#receipts`, priority: "High" };
  }
  if (lifecycle === "Not Ready" && !isReadyForBilling(job)) {
    const blockers = billingBlockers(job);
    return { title: `Resolve billing blockers (${readinessScore(job)}% ready)`, reason: blockers.map((blocker) => blocker.label).join(", ") || "Review closeout before billing.", href: `/jobs/${job.jobId}#billing-handoff`, priority: "High" };
  }
  if (lifecycle === "Ready to Invoice") {
    return { title: "Ready to invoice", reason: "Completion is ready for billing review.", href: `/jobs/${job.jobId}#billing-handoff`, priority: "Normal" };
  }
  if (lifecycle === "With billing") {
    return { title: "Create invoice", reason: "The closeout packet is in the billing queue for invoice creation.", href: `/jobs/${job.jobId}#billing-handoff`, priority: "Normal" };
  }
  return null;
}

function officeActionRank(priority: OfficeBillingAction["priority"]) {
  return priority === "High" ? 0 : 1;
}

function OfficeBillingActionRow({ action }: { action: OfficeBillingAction }) {
  return <div className="grid gap-2 px-4 py-4 md:grid-cols-[minmax(9rem,.8fr)_minmax(12rem,1fr)_minmax(15rem,1.5fr)_auto] md:items-center md:gap-4">
    <div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${action.priority === "High" ? "bg-orange-100 text-orange-800" : "bg-lime/60 text-ink"}`}>{action.priority}</span><p className="font-bold">{action.title}</p></div>
    <p className="text-sm font-bold text-content/65"><span className="mr-1 text-xs font-bold uppercase tracking-wide text-content/65 md:hidden">Job</span>{action.job.customerName} <span className="text-content/65">· {action.job.jobId}</span></p>
    <p className="text-sm font-semibold text-content/65"><span className="mr-1 text-xs font-bold uppercase tracking-wide text-content/65 md:hidden">Reason</span>{action.reason}</p>
    <Link href={action.href} className="mt-1 min-h-11 rounded-xl bg-forest px-4 py-2 text-center text-sm font-bold text-white md:mt-0">Open job</Link>
  </div>;
}

function PaymentFollowUpRow({ followUp }: { followUp: PaymentFollowUp }) {
  const { job } = followUp;
  return <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(14rem,1fr)_auto] sm:items-center">
    <div>
      <p className="font-bold">{job.customerName} <span className="text-content/65">· {job.jobId}</span></p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-content/65">
        {job.invoiceAmount !== undefined && <span>Invoice amount: ${job.invoiceAmount.toFixed(2)}</span>}
        {job.invoiceDate && <span>Invoice date: {job.invoiceDate}</span>}
        {job.paymentDueDate && <span>Payment due: {job.paymentDueDate}</span>}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${followUp.pastDue ? "bg-orange-100 text-orange-800" : "bg-sand text-content/65"}`}>{followUp.label}</span>
      <Link href={`/jobs/${job.jobId}`} className="min-h-11 rounded-xl bg-forest px-4 py-2 text-center text-sm font-bold text-white">Open job</Link>
    </div>
  </div>;
}

function HeroMetric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-2xl bg-white/10 p-4">
    <p className="text-3xl font-bold">{value}</p>
    <p className="mt-1 text-xs font-bold text-white/65">{label}</p>
  </div>;
}

function BillingLane({ label, value, detail, icon, tone, onClick }: { label: string; value: number; detail: string; icon: React.ReactNode; tone: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="card p-4 text-left active:scale-[.99]">
    <div className={`mb-3 grid size-10 place-items-center rounded-xl ${tone} [&>svg]:size-5`}>{icon}</div>
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="font-bold">{label}</h2>
        <p className="mt-1 text-xs font-semibold text-content/65">{detail}</p>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  </button>;
}

function InfoPill({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-sand p-3">
    <p className="text-xs font-bold uppercase tracking-wide text-content/65">{label}</p>
    <p className="mt-1 font-bold text-content">{value}</p>
  </div>;
}

function FactoryCostBreakdown({ totals }: { totals: ReturnType<typeof getFactoryCostTotals> }) {
  const items = [
    ["Mileage", totals.mileage],
    ["Labor", totals.driveTime + totals.helper],
    ["Per diem", totals.perDiem],
    ["Hotel", totals.hotel],
    ["Materials", totals.materials],
    ["Other", totals.otherReceipts],
  ];
  return <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
    <div className="mb-2 flex items-center justify-between gap-3">
      <p className="text-sm font-bold text-blue-950">Factory cost breakdown</p>
      <p className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-blue-900">${totals.grandTotal.toFixed(2)}</p>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map(([label, value]) => <div key={label} className="rounded-xl bg-surface p-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-blue-900">{label}</p>
        <p className="font-bold text-blue-950">${Number(value).toFixed(2)}</p>
      </div>)}
    </div>
  </div>;
}

function Metric({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return <div className="card p-4">
    <div className="mb-3 grid size-10 place-items-center rounded-xl bg-lime/70 [&>svg]:size-5">{icon}</div>
    <p className="text-3xl font-bold">{value}</p>
    <p className="mt-1 text-xs font-bold text-content/65">{label}</p>
  </div>;
}
