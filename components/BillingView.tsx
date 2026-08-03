"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BanknotesIcon, CheckCircleIcon, ClipboardDocumentListIcon, ClockIcon, ExclamationTriangleIcon, ReceiptPercentIcon } from "@heroicons/react/24/outline";
import { authFetch } from "@/lib/client-auth";
import { factoryCostGrandTotal, getFactoryCostTotals } from "@/lib/factory-costs";
import { isReceiptBackupMissing } from "@/lib/receipt-backup";
import type { Job, JobActivity } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { billingBlockers, isReadyForBilling, readinessScore } from "@/lib/job-readiness";

const billingStatuses = ["Ready", "Needs review", "Needs more info", "Draft", "Sent to Billing", "Sent", "On hold", "Not started", "Paid"];

export function BillingView() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Ready");
  const [copiedJobId, setCopiedJobId] = useState("");

  useEffect(() => {
    authFetch("/api/jobs").then((response) => response.json()).then((data) => setJobs(Array.isArray(data) ? data : [])).finally(() => setLoading(false));
  }, []);

  const billable = useMemo(() => jobs.filter((job) => ["Complete", "Billed", "Paid"].includes(job.status) || ["Ready", "Needs more info", "Draft", "Sent to Billing", "Sent", "On hold"].includes(job.invoiceStatus)), [jobs]);
  const filtered = billable.filter((job) => filter === "All" || (filter === "Needs review" ? !isReadyForBilling(job) : job.invoiceStatus === filter || (filter === "Ready" && job.invoiceStatus === "Ready")));
  const ready = billable.filter((job) => job.invoiceStatus === "Ready").length;
  const needsReview = billable.filter((job) => !isReadyForBilling(job)).length;
  const needsInfo = billable.filter((job) => job.invoiceStatus === "Needs more info").length;
  const sent = billable.filter((job) => job.invoiceStatus === "Sent" || job.invoiceStatus === "Sent to Billing").length;
  const paid = billable.filter((job) => job.status === "Paid" || job.invoiceStatus === "Paid").length;
  const receiptTotal = billable.reduce((sum, job) => sum + (job.receipts || []).reduce((total, receipt) => total + (Number(receipt.amount) || 0), 0), 0);
  const factoryCostTotal = billable.reduce((sum, job) => sum + factoryCostGrandTotal(job), 0);
  const fileTotal = billable.reduce((sum, job) => sum + (job.workOrderFiles?.length || 0), 0);
  const lanes = [
    { label: "Ready", value: ready, detail: "Can send to billing", filter: "Ready", icon: <CheckCircleIcon />, tone: ready ? "bg-emerald-100 text-emerald-900" : "bg-black/5 text-black/45" },
    { label: "Review", value: needsReview, detail: "Packet blockers", filter: "Needs review", icon: <ExclamationTriangleIcon />, tone: needsReview ? "bg-orange-100 text-orange-900" : "bg-black/5 text-black/45" },
    { label: "Needs info", value: needsInfo, detail: "Waiting on details", filter: "Needs more info", icon: <ClockIcon />, tone: needsInfo ? "bg-amber-100 text-amber-900" : "bg-black/5 text-black/45" },
    { label: "Sent", value: sent, detail: "In invoice queue", filter: "Sent to Billing", icon: <BanknotesIcon />, tone: sent ? "bg-blue-100 text-blue-900" : "bg-black/5 text-black/45" },
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
    const response = await authFetch(`/api/jobs/${job.jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const saved = await response.json();
    if (!response.ok) return;
    setJobs((old) => old.map((item) => item.jobId === job.jobId ? { ...item, ...saved } : item));
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
      `Closeout score: ${readinessScore(job)}%`,
      `Receipts: ${job.receipts?.length || 0} totaling $${receiptSum.toFixed(2)}`,
      job.source === "Factory" ? `Factory cost total: $${factoryCosts.grandTotal.toFixed(2)}` : "",
      job.source === "Factory" ? `Factory breakdown: mileage $${factoryCosts.mileage.toFixed(2)}, labor $${(factoryCosts.driveTime + factoryCosts.helper).toFixed(2)}, per diem $${factoryCosts.perDiem.toFixed(2)}, receipts $${(factoryCosts.hotel + factoryCosts.materials + factoryCosts.otherReceipts).toFixed(2)}` : "",
      `Files: ${job.workOrderFiles?.length || 0}`,
      `Sign-offs: ${job.signoffs?.length || 0}`,
      `Completion notes: ${job.completionNotes || "Missing"}`,
      blockers.length ? `Blockers: ${blockers.map((blocker) => blocker.label).join(", ")}` : "Blockers: None",
    ].filter(Boolean).join("\n");
    await navigator.clipboard?.writeText(summary);
    setCopiedJobId(job.jobId);
    window.setTimeout(() => setCopiedJobId((current) => current === job.jobId ? "" : current), 2200);
  }

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><BanknotesIcon className="size-7" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-lime">Billing command</p>
          <h1 className="text-3xl font-black">Invoice handoff</h1>
          <p className="mt-1 text-sm text-white/55">Review closeout packets, receipts, paperwork, blockers, and invoice status before billing.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <HeroMetric label="Billable jobs" value={billable.length} />
        <HeroMetric label="Ready" value={ready} />
        <HeroMetric label="Review" value={needsReview} />
        <HeroMetric label="Receipt total" value={`$${receiptTotal.toFixed(0)}`} />
        <HeroMetric label="Factory costs" value={`$${factoryCostTotal.toFixed(0)}`} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-4">
        <Link href="/documents" className="min-h-12 rounded-xl bg-lime px-4 py-3 text-center font-black text-ink">Documents</Link>
        <Link href="/reports" className="min-h-12 rounded-xl bg-white/10 px-4 py-3 text-center font-black text-white">Reports</Link>
        <a href="/api/reports/export?type=billing-review" className="min-h-12 rounded-xl bg-white/10 px-4 py-3 text-center font-black text-white">Billing CSV</a>
        <Link href="/settings" className="min-h-12 rounded-xl bg-white/10 px-4 py-3 text-center font-black text-white">Invoice settings</Link>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {lanes.map((lane) => <BillingLane key={lane.label} {...lane} onClick={() => setFilter(lane.filter)} />)}
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
          <h2 className="font-black">Invoice Simple guardrail</h2>
          <p className="mt-1 text-sm font-semibold text-black/50">This queue prepares invoice handoffs. It does not create Invoice Simple invoices yet; that connector can be added later after account/API details are chosen.</p>
        </div>
      </div>
    </section>

    <section className="card p-3 sm:p-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <p className="text-sm font-bold text-black/45">{loading ? "Loading billing jobs…" : `${filtered.length} jobs in this view`}</p>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="field !min-h-11 !py-2 text-sm font-bold">
          <option>All</option>
          {billingStatuses.map((status) => <option key={status}>{status}</option>)}
        </select>
      </div>
    </section>

    <div className="grid gap-3">
      {!loading && filtered.length === 0 ? <div className="card p-8 text-center"><p className="font-black">No billing jobs in this filter.</p></div> : null}
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
            <p className="text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.source}</p>
            <h2 className="mt-1 text-xl font-black">{job.customerName}</h2>
            <p className="text-sm font-semibold text-black/50">{job.address}, {job.city}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={job.status} />
            <span className="rounded-full bg-lime/60 px-3 py-1 text-xs font-black text-ink">Invoice: {job.invoiceStatus || "Not started"}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${blockers.length ? "bg-orange-100 text-orange-800" : "bg-forest text-white"}`}>{score}% ready</span>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-sm font-semibold text-black/50 sm:grid-cols-4">
          <InfoPill label="Receipts" value={`${job.receipts?.length || 0} · $${receiptSum.toFixed(2)}`} />
          <InfoPill label="Factory total" value={job.source === "Factory" ? `$${factoryCosts.grandTotal.toFixed(2)}` : "N/A"} />
          <InfoPill label="Files" value={job.workOrderFiles?.length || 0} />
          <InfoPill label="Sign-offs" value={job.signoffs?.length || 0} />
          <InfoPill label="Notes" value={job.completionNotes ? "Added" : "Missing"} />
        </div>
        {job.source === "Factory" && <FactoryCostBreakdown totals={factoryCosts} />}
        {receiptBackupMissing && <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-900">
          Receipt backup missing for entered dollars. <Link href={`/jobs/${job.jobId}#receipts`} className="underline">Open receipts</Link>
        </div>}
        {blockers.length > 0 && <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">Needs review: {blockers.map((blocker) => blocker.label).join(", ")}</p>}
        <div className="mt-3 grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <Link href={`/jobs/${job.jobId}`} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm font-black text-ink">Open Job</Link>
          <Link href={`/jobs/${job.jobId}/packet`} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm font-black text-ink">Packet</Link>
          <Link href={`/jobs/${job.jobId}#billing-handoff`} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm font-black text-ink">Handoff</Link>
          <button type="button" onClick={() => copyBillingSummary(job)} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-ink">{copiedJobId === job.jobId ? "Copied" : "Copy Summary"}</button>
          <button type="button" disabled={blockers.length > 0} onClick={() => updateBilling(job, "Ready", "Billing queue: marked Ready for Invoice.")} className="min-h-11 rounded-xl bg-forest px-3 py-2 text-sm font-black text-white disabled:opacity-50">Ready</button>
          <button type="button" onClick={() => updateBilling(job, "Needs more info", "Billing queue: marked Needs more info.")} className="min-h-11 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-black text-orange-900">Need Info</button>
          <button type="button" disabled={job.invoiceStatus !== "Ready"} onClick={() => updateBilling(job, "Sent to Billing", "Billing queue: sent to billing.")} className="min-h-11 rounded-xl bg-ink px-3 py-2 text-sm font-black text-white disabled:opacity-50">Sent to Billing</button>
          <button type="button" disabled={!["Sent to Billing", "Ready", "Draft"].includes(job.invoiceStatus)} onClick={() => updateBilling(job, "Sent", "Billing queue: invoice sent to customer.", { status: job.status === "Complete" ? "Billed" : job.status })} className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-900 disabled:opacity-50">Invoice Sent</button>
          <button type="button" onClick={() => updateBilling(job, "On hold", "Billing queue: invoice placed on hold for follow-up.")} className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-black text-amber-900">On Hold</button>
          <button type="button" disabled={!["Sent", "Billed", "Paid"].includes(job.invoiceStatus) && job.status !== "Billed"} onClick={() => updateBilling(job, "Paid", "Billing queue: invoice marked paid.", { status: "Paid" })} className="min-h-11 rounded-xl bg-lime px-3 py-2 text-sm font-black text-ink disabled:opacity-50">Paid</button>
        </div>
        </>;
        })()}
      </div>)}
    </div>
  </div>;
}

function HeroMetric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-2xl bg-white/10 p-4">
    <p className="text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-white/55">{label}</p>
  </div>;
}

function BillingLane({ label, value, detail, icon, tone, onClick }: { label: string; value: number; detail: string; icon: React.ReactNode; tone: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="card p-4 text-left active:scale-[.99]">
    <div className={`mb-3 grid size-10 place-items-center rounded-xl ${tone} [&>svg]:size-5`}>{icon}</div>
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="font-black">{label}</h2>
        <p className="mt-1 text-xs font-semibold text-black/45">{detail}</p>
      </div>
      <p className="text-3xl font-black">{value}</p>
    </div>
  </button>;
}

function InfoPill({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-sand p-3">
    <p className="text-xs font-black uppercase tracking-wide text-black/35">{label}</p>
    <p className="mt-1 font-black text-ink">{value}</p>
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
      <p className="text-sm font-black text-blue-950">Factory cost breakdown</p>
      <p className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-900">${totals.grandTotal.toFixed(2)}</p>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map(([label, value]) => <div key={label} className="rounded-xl bg-white p-2">
        <p className="text-[10px] font-black uppercase tracking-wide text-blue-900/55">{label}</p>
        <p className="font-black text-blue-950">${Number(value).toFixed(2)}</p>
      </div>)}
    </div>
  </div>;
}

function Metric({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return <div className="card p-4">
    <div className="mb-3 grid size-10 place-items-center rounded-xl bg-lime/70 [&>svg]:size-5">{icon}</div>
    <p className="text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-black/45">{label}</p>
  </div>;
}
