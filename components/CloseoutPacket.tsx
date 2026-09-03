"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CameraIcon, CheckCircleIcon, ClipboardDocumentListIcon, PrinterIcon, ReceiptPercentIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { authFetch } from "@/lib/client-auth";
import { factoryCostGrandTotal, getFactoryCostTotals } from "@/lib/factory-costs";
import { isReceiptBackupMissing } from "@/lib/receipt-backup";
import type { Job, JobActivity, PaperworkItem } from "@/lib/types";
import { billingBlockers, closeoutChecks, openParts, readinessScore } from "@/lib/job-readiness";
import { PriorityBadge, StatusBadge } from "./StatusBadge";

export function CloseoutPacket({ job }: { job: Job }) {
  const paperwork = job.paperworkItems?.length ? job.paperworkItems : defaultPacketPaperwork(job);
  const receipts = job.receipts || [];
  const signoffs = job.signoffs || [];
  const files = job.workOrderFiles || [];
  const parts = openParts(job);
  const receiptTotal = receipts.reduce((sum, receipt) => sum + (Number(receipt.amount) || 0), 0);
  const factoryTotal = factoryCostGrandTotal(job);
  const factoryCosts = getFactoryCostTotals(job.factoryCost);
  const receiptBackupMissing = isReceiptBackupMissing(job);
  const blockers = billingBlockers(job);
  const checks = closeoutChecks(job);
  const photos = [
    { label: "Before", items: job.beforePhotos || [] },
    { label: "Damage", items: job.damagePhotos || [] },
    { label: "Serial / VIN", items: job.serialTagPhotos || [] },
    { label: "After", items: job.afterPhotos || [] },
  ];

  return <div className="mx-auto max-w-5xl space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
      <Link href={`/jobs/${job.jobId}`} className="btn-secondary"><ArrowLeftIcon className="size-5" />Back to Job</Link>
      <button type="button" onClick={() => window.print()} className="btn-primary"><PrinterIcon className="size-5" />Print Closeout Packet</button>
    </div>

    <section className="card overflow-hidden">
      <div className="bg-ink p-5 text-white sm:p-7">
        <p className="text-xs font-black uppercase tracking-[.25em] text-lime">Field Service Closeout Packet</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{job.customerName}</h1>
            <p className="mt-1 text-sm font-semibold text-white/65">{job.jobId} · {job.source}{job.dealerName ? ` · ${job.dealerName}` : ""}{job.factoryWorkOrderNumber ? ` · WO ${job.factoryWorkOrderNumber}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2"><StatusBadge status={job.status} /><PriorityBadge priority={job.priority} /></div>
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
        <PacketField label="Customer phone" value={job.phone || "Not provided"} />
        <PacketField label="Address" value={`${job.address}, ${job.city}`} />
        <PacketField label="Due date" value={formatDate(job.dueDate)} />
        <PacketField label="Assigned employees" value={job.assignedCrew || "Unassigned"} />
        <PacketField label="Home size" value={job.homeSize || "Unknown"} />
        <PacketField label="Job type" value={job.jobType || "Work order"} />
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-4">
      <PacketMetric label="Billing ready" value={`${readinessScore(job)}%`} />
      <PacketMetric label="Paperwork files" value={files.length} />
      <PacketMetric label={job.source === "Factory" ? "Factory total" : "Receipts"} value={`$${(job.source === "Factory" ? factoryTotal : receiptTotal).toFixed(2)}`} />
      <PacketMetric label="Sign-offs" value={signoffs.length} />
    </section>

    {receiptBackupMissing && <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
      <p className="text-sm font-black text-orange-900">Receipt backup missing</p>
      <p className="mt-1 text-sm font-semibold text-orange-800">Receipt or factory receipt dollars are entered, but no uploaded receipt file is attached to this packet.</p>
      <Link href={`/jobs/${job.jobId}#receipts`} className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-white px-3 py-2 text-sm font-black text-orange-900 print:hidden">Open receipts</Link>
    </section>}

    <BillingPacketActions job={job} blockers={blockers.length} />
    {job.source === "Factory" && <FactoryCostPacketSection totals={factoryCosts} notes={job.factoryCost?.notes || ""} />}

    <section className="card p-5 sm:p-7">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink"><CheckCircleIcon className="size-5" /></span>
        <div>
          <h2 className="text-xl font-black">Billing readiness</h2>
          <p className="text-sm font-semibold text-black/45">{blockers.length ? `Needs attention: ${blockers.map((item) => item.label).join(", ")}` : "Ready for billing review."}</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {checks.map((check) => <div key={check.label} className={`rounded-xl border p-3 ${check.ok ? "border-forest/15 bg-forest/5" : "border-orange-200 bg-orange-50"}`}>
          <p className={`text-xs font-black uppercase tracking-wide ${check.ok ? "text-forest" : "text-orange-800"}`}>{check.ok ? "Ready" : "Needed"}</p>
          <p className="font-black">{check.label}</p>
          <p className="text-xs font-semibold text-black/45">{check.detail}</p>
        </div>)}
      </div>
    </section>

    <section className="grid gap-5 lg:grid-cols-2">
      <PacketSection title="Scope and completion" icon={<ClipboardDocumentListIcon />}>
        <PacketText label="Scope notes" text={job.scopeNotes || "No scope notes added."} />
        <PacketText label="Completion notes" text={job.completionNotes || "Not added yet."} />
      </PacketSection>

      <PacketSection title="Parts" icon={<WrenchScrewdriverIcon />}>
        {parts.length ? parts.map((part) => <div key={part.id} className="rounded-xl bg-sand p-3">
          <p className="font-black">{part.quantity} × {part.name}</p>
          <p className="text-xs font-semibold text-black/45">{part.status} · Requested {formatDateTime(part.requestedAt)} by {part.requestedBy}</p>
          {part.notes && <p className="mt-1 text-sm font-semibold text-black/55">{part.notes}</p>}
        </div>) : <PacketText label="Parts needed" text={job.partsNeeded || "No open structured parts."} />}
      </PacketSection>
    </section>

    <section className="grid gap-5 lg:grid-cols-2">
      <PacketSection title="Paperwork" icon={<ClipboardDocumentListIcon />}>
        {paperwork.map((item) => <div key={item.id} className="rounded-xl bg-sand p-3">
          <p className="font-black">{item.label}</p>
          <p className="text-xs font-black uppercase tracking-wide text-black/40">{item.status}</p>
          {item.notes && <p className="mt-1 text-sm font-semibold text-black/55">{item.notes}</p>}
        </div>)}
        {files.length > 0 && <div className="mt-2 space-y-2">
          <p className="text-sm font-black">Attached files</p>
          {files.map((file) => <a key={file.id} href={file.storageUrl || file.dataUrl} target="_blank" className="block rounded-xl border border-black/10 bg-white p-3 text-sm font-bold text-forest print:text-black">
            {file.fileName}
            <span className="block text-xs text-black/40">{file.category || "File"} · {(file.fileSize / 1024).toFixed(1)} KB · {formatDateTime(file.uploadedAt)}</span>
          </a>)}
        </div>}
      </PacketSection>

      <PacketSection title="Receipts" icon={<ReceiptPercentIcon />}>
        {receipts.length ? receipts.map((receipt) => <div key={receipt.id} className="rounded-xl bg-sand p-3">
          <div className="flex justify-between gap-3">
            <p className="font-black">{receipt.vendor}</p>
            <p className="font-black">${receipt.amount || "0"}</p>
          </div>
          <p className="text-xs font-semibold text-black/45">{receipt.category} · {formatDate(receipt.date)}{receipt.reimbursable ? " · Reimbursable" : ""}</p>
          {receipt.notes && <p className="mt-1 text-sm font-semibold text-black/55">{receipt.notes}</p>}
          {receipt.file && <a href={receipt.file.storageUrl || receipt.file.dataUrl} target="_blank" className="mt-2 inline-block text-sm font-black text-forest print:text-black">Open receipt file</a>}
        </div>) : <p className="rounded-xl bg-sand p-3 text-sm font-semibold text-black/45">No receipts saved.</p>}
      </PacketSection>
    </section>

    <PacketSection title="Sign-offs" icon={<CheckCircleIcon />}>
      {signoffs.length ? signoffs.map((signoff) => <div key={signoff.id} className="rounded-xl bg-sand p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-black">{signoff.type}</p>
            <p className="text-sm font-semibold text-black/55">{signoff.signerName} · {signoff.signerRole} · {formatDateTime(signoff.signedAt)}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${signoff.accepted ? "bg-forest text-white" : "bg-orange-100 text-orange-800"}`}>{signoff.accepted ? "Accepted" : "Needs review"}</span>
        </div>
        {signoff.notes && <p className="mt-2 text-sm font-semibold text-black/55">{signoff.notes}</p>}
        <p className="mt-2 rounded-lg bg-white p-2 text-xs font-bold text-black/45">Typed signature: {signoff.typedSignature}</p>
      </div>) : <p className="rounded-xl bg-sand p-3 text-sm font-semibold text-black/45">No sign-offs saved.</p>}
    </PacketSection>

    <PacketSection title="Photo summary" icon={<CameraIcon />}>
      <div className="grid gap-3 sm:grid-cols-4">
        {photos.map((bucket) => <div key={bucket.label} className="rounded-xl bg-sand p-3 text-center">
          <p className="text-2xl font-black">{bucket.items.length}</p>
          <p className="text-xs font-bold text-black/45">{bucket.label}</p>
        </div>)}
      </div>
      <p className="mt-3 rounded-xl bg-sand p-3 text-sm font-semibold text-black/45">CompanyCam project: {job.companyCamProjectUrl ? "Linked" : job.companyCamProjectId ? `ID ${job.companyCamProjectId}` : "Not linked yet"}</p>
    </PacketSection>
  </div>;
}

function BillingPacketActions({ job, blockers }: { job: Job; blockers: number }) {
  const [invoiceStatus, setInvoiceStatus] = useState(job.invoiceStatus || "Not started");
  const [saving, setSaving] = useState("");
  const [copied, setCopied] = useState(false);
  const receiptTotal = (job.receipts || []).reduce((sum, receipt) => sum + (Number(receipt.amount) || 0), 0);
  const factoryTotal = factoryCostGrandTotal(job);
  const factoryCosts = getFactoryCostTotals(job.factoryCost);

  async function updateBilling(nextStatus: string, message: string, extra: Partial<Job> = {}) {
    setSaving(nextStatus);
    const activity: JobActivity = {
      id: `activity-${Date.now()}`,
      type: "Invoice",
      message,
      createdAt: new Date().toISOString(),
      createdBy: "Billing",
      audience: "Admin",
      notify: nextStatus === "Needs more info",
    };
    const response = await authFetch(`/api/jobs/${job.jobId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...extra,
        invoiceStatus: nextStatus,
        activityLog: [activity, ...(job.activityLog || [])].slice(0, 50),
      } satisfies Partial<Job>),
    });
    if (response.ok) setInvoiceStatus(nextStatus);
    setSaving("");
  }

  async function copyBillingSummary() {
    const summary = [
      `Billing handoff - ${job.jobId}`,
      `Customer: ${job.customerName}`,
      `Source: ${job.source}${job.dealerName ? ` - ${job.dealerName}` : ""}`,
      `Factory WO: ${job.factoryWorkOrderNumber || "N/A"}`,
      `Address: ${job.address}, ${job.city}`,
      `Phone: ${job.phone || "N/A"}`,
      `Job type: ${job.jobType || "N/A"}`,
      `Status: ${job.status}`,
      `Invoice status: ${invoiceStatus || "Not started"}`,
      `Closeout score: ${readinessScore(job)}%`,
      `Receipts: ${job.receipts?.length || 0} totaling $${receiptTotal.toFixed(2)}`,
      job.source === "Factory" ? `Factory cost total: $${factoryTotal.toFixed(2)}` : "",
      job.source === "Factory" ? `Factory breakdown: ${job.factoryCost?.tripCount || "0"} trips, ${job.factoryCost?.miles || "0"} miles, drive $${factoryCosts.driveTime.toFixed(2)}, work $${factoryCosts.work.toFixed(2)}, helper $${factoryCosts.helper.toFixed(2)}, per diem $${factoryCosts.perDiem.toFixed(2)}, receipts $${(factoryCosts.hotel + factoryCosts.meals + factoryCosts.materials + factoryCosts.otherReceipts).toFixed(2)}` : "",
      `Files: ${job.workOrderFiles?.length || 0}`,
      `Sign-offs: ${job.signoffs?.length || 0}`,
      `Completion notes: ${job.completionNotes || "Missing"}`,
      blockers ? `${blockers} closeout blocker${blockers === 1 ? "" : "s"} need review` : "Blockers: None",
    ].filter(Boolean).join("\n");
    await navigator.clipboard?.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return <section id="billing-handoff" className="card p-5 sm:p-7 print:hidden">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink"><ReceiptPercentIcon className="size-5" /></span>
      <div>
        <h2 className="text-xl font-black">Billing handoff</h2>
        <p className="text-sm font-semibold text-black/45">Current invoice status: {invoiceStatus}</p>
      </div>
    </div>
    {blockers > 0 && <p className="mb-3 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">{blockers} closeout blocker{blockers === 1 ? "" : "s"} should be cleaned up before marking ready.</p>}
    <div className="grid gap-2 sm:grid-cols-3">
      <button type="button" disabled={Boolean(saving) || blockers > 0} onClick={() => updateBilling("Ready", "Closeout packet: marked Ready for Invoice.")} className="min-h-12 rounded-xl bg-forest px-4 py-3 font-black text-white disabled:opacity-50">{saving === "Ready" ? "Saving…" : "Ready for Invoice"}</button>
      <button type="button" disabled={Boolean(saving)} onClick={() => updateBilling("Needs more info", "Closeout packet: marked Needs more info.")} className="min-h-12 rounded-xl border-2 border-orange-200 bg-orange-50 px-4 py-3 font-black text-orange-900 disabled:opacity-50">{saving === "Needs more info" ? "Saving…" : "Needs More Info"}</button>
      <button type="button" disabled={Boolean(saving) || invoiceStatus !== "Ready"} onClick={() => updateBilling("Sent to Billing", "Closeout packet: sent to billing queue.")} className="min-h-12 rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black disabled:opacity-50">{saving === "Sent to Billing" ? "Saving…" : "Sent to Billing"}</button>
      <button type="button" disabled={Boolean(saving) || !["Sent to Billing", "Ready", "Draft"].includes(invoiceStatus)} onClick={() => updateBilling("Sent", "Closeout packet: invoice sent to customer.", { status: job.status === "Complete" ? "Billed" : job.status })} className="min-h-12 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 font-black text-blue-900 disabled:opacity-50">{saving === "Sent" ? "Saving…" : "Invoice Sent"}</button>
      <button type="button" disabled={Boolean(saving)} onClick={() => updateBilling("On hold", "Closeout packet: invoice placed on hold for follow-up.")} className="min-h-12 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 font-black text-amber-900 disabled:opacity-50">{saving === "On hold" ? "Saving…" : "On Hold"}</button>
      <button type="button" disabled={Boolean(saving) || (!["Sent", "Paid"].includes(invoiceStatus) && job.status !== "Billed")} onClick={() => updateBilling("Paid", "Closeout packet: invoice marked paid.", { status: "Paid" })} className="min-h-12 rounded-xl bg-lime px-4 py-3 font-black text-ink disabled:opacity-50">{saving === "Paid" ? "Saving…" : "Paid"}</button>
    </div>
    <button type="button" onClick={copyBillingSummary} className="mt-3 min-h-12 w-full rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black">{copied ? "Billing Summary Copied" : "Copy Billing Summary"}</button>
  </section>;
}

function FactoryCostPacketSection({ totals, notes }: { totals: ReturnType<typeof getFactoryCostTotals>; notes: string }) {
  const items = [
    ["Mileage", totals.mileage],
    ["Drive time labor", totals.driveTime],
    ["Work labor", totals.work],
    ["Helper labor", totals.helper],
    ["Per diem", totals.perDiem],
    ["Hotel receipts", totals.hotel],
    ["Meal receipts", totals.meals],
    ["Materials receipts", totals.materials],
    ["Other receipts", totals.otherReceipts],
  ];
  return <PacketSection title="Factory cost breakdown" icon={<ReceiptPercentIcon />}>
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(([label, value]) => <div key={label} className="rounded-xl bg-sand p-3">
        <p className="text-xs font-black uppercase tracking-wide text-black/40">{label}</p>
        <p className="text-lg font-black">${Number(value).toFixed(2)}</p>
      </div>)}
    </div>
    <div className="mt-3 rounded-xl bg-lime/50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-black/45">Factory grand total</p>
      <p className="text-2xl font-black">${totals.grandTotal.toFixed(2)}</p>
    </div>
    {notes && <PacketText label="Cost notes" text={notes} />}
  </PacketSection>;
}

function PacketSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="card p-5 sm:p-7">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink [&>svg]:size-5">{icon}</span>
      <h2 className="pt-2 text-xl font-black">{title}</h2>
    </div>
    <div className="space-y-2">{children}</div>
  </section>;
}

function PacketField({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-sand p-3">
    <p className="text-xs font-black uppercase tracking-wide text-black/35">{label}</p>
    <p className="mt-1 font-extrabold">{value}</p>
  </div>;
}

function PacketMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="card p-4">
    <p className="text-2xl font-black">{value}</p>
    <p className="text-xs font-bold uppercase tracking-wide text-black/40">{label}</p>
  </div>;
}

function PacketText({ label, text }: { label: string; text: string }) {
  return <div className="rounded-xl bg-sand p-3">
    <p className="text-xs font-black uppercase tracking-wide text-black/35">{label}</p>
    <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-black/65">{text}</p>
  </div>;
}

function defaultPacketPaperwork(job: Job): PaperworkItem[] {
  return [
    { id: "work-order", label: job.source === "Factory" ? "Factory work order" : job.source === "Dealer" ? "Dealer paperwork" : "Customer work authorization", status: job.paperworkPickedUp ? "Collected" : "Needed", notes: job.factoryWorkOrderNumber || job.dealerName || "" },
    { id: "completion-signoff", label: "Completion sign-off", status: job.signoffs?.length ? "Collected" : "Needed" },
    { id: "invoice-backup", label: "Invoice backup", status: job.invoiceStatus === "Sent" || job.invoiceStatus === "Paid" ? "Submitted" : "Needed" },
  ];
}

function formatDate(value?: string) {
  if (!value) return "Not set";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value?: string) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString();
}
