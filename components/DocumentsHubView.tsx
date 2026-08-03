"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDownTrayIcon, ArrowUpTrayIcon, BanknotesIcon, CheckCircleIcon, ClipboardDocumentListIcon, DocumentTextIcon, ExclamationTriangleIcon, FolderOpenIcon, PrinterIcon, ReceiptPercentIcon } from "@heroicons/react/24/outline";
import { billingBlockers, isReadyForBilling, readinessScore } from "@/lib/job-readiness";
import { isReceiptBackupMissing } from "@/lib/receipt-backup";
import type { Job, ReceiptItem, WorkOrderFile } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

type DocumentFilter = "All" | "Missing paperwork" | "Missing receipt backup" | "Has files" | "Has receipts" | "Needs billing review" | "Ready to invoice";
type CabinetFilter = "All files" | "Work Orders" | "Paperwork" | "Signed Docs" | "Receipts" | "Other";

const filters: DocumentFilter[] = ["All", "Missing paperwork", "Missing receipt backup", "Has files", "Has receipts", "Needs billing review", "Ready to invoice"];
const cabinetFilters: CabinetFilter[] = ["All files", "Work Orders", "Paperwork", "Signed Docs", "Receipts", "Other"];

export function DocumentsHubView({ jobs }: { jobs: Job[] }) {
  const searchParams = useSearchParams();
  const initialFilter = parseDocumentFilter(searchParams.get("filter"));
  const [filter, setFilter] = useState<DocumentFilter>(initialFilter);
  const [cabinetFilter, setCabinetFilter] = useState<CabinetFilter>("All files");
  const rows = useMemo(() => [...jobs]
    .filter((job) => matchesFilter(job, filter) && matchesCabinetFilter(job, cabinetFilter))
    .sort((a, b) => documentScore(b) - documentScore(a) || readinessScore(a) - readinessScore(b) || (b.dueDate || "").localeCompare(a.dueDate || "")), [cabinetFilter, filter, jobs]);
  const fileCount = jobs.reduce((sum, job) => sum + (job.workOrderFiles?.length || 0), 0);
  const receiptCount = jobs.reduce((sum, job) => sum + (job.receipts?.length || 0), 0);
  const missingPaperwork = jobs.filter((job) => !hasPaperwork(job)).length;
  const missingReceiptBackup = jobs.filter((job) => isReceiptBackupMissing(job)).length;
  const needsBillingReview = jobs.filter((job) => isBillingCandidate(job) && !isReadyForBilling(job)).length;
  const readyToInvoice = jobs.filter((job) => isBillingCandidate(job) && isReadyForBilling(job)).length;
  const allDocuments = useMemo(() => buildRecentDocuments(jobs), [jobs]);
  const recentItems = useMemo(() => allDocuments.filter((item) => matchesRecentCategory(item, cabinetFilter)).slice(0, 8), [allDocuments, cabinetFilter]);
  const cabinetCounts = useMemo(() => countCabinetItems(allDocuments), [allDocuments]);

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><ClipboardDocumentListIcon className="size-7" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-lime">Paperwork and receipts</p>
          <h1 className="text-3xl font-black">Documents Hub</h1>
          <p className="mt-1 text-sm text-white/55">Find saved work orders, paperwork, receipt files, and jobs still missing office backup.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Saved files" value={fileCount} />
        <Metric label="Receipts" value={receiptCount} />
        <Metric label="Missing paperwork" value={missingPaperwork} />
        <Metric label="Missing receipt backup" value={missingReceiptBackup} />
        <Metric label="Billing review" value={needsBillingReview} />
        <Metric label="Ready invoice" value={readyToInvoice} />
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <ActionCard href="/import" title="Import work order" detail="Upload or paste paperwork and create/update a customer profile." icon={<ArrowUpTrayIcon />} primary />
      <ActionCard href="/jobs/new" title="Add job manually" detail="Create a job when there is no dealer/factory work order yet." icon={<ClipboardDocumentListIcon />} />
      <ActionCard href="/billing" title="Billing queue" detail="Review packets, receipts, closeout blockers, and invoice status." icon={<BanknotesIcon />} />
      <ActionCard href="/api/reports/export?type=document-manifest" title="Document manifest" detail="Download every saved file, receipt attachment, category, and job link as a CSV." icon={<ArrowDownTrayIcon />} />
    </section>

    <section className="card p-3">
      <div className="mb-3 flex items-center gap-2">
        <ExclamationTriangleIcon className="size-5 text-forest" />
        <div><h2 className="font-black">Document work queue</h2><p className="text-xs font-semibold text-black/45">Tap a filter, then open a customer to fix the paperwork, receipts, or packet.</p></div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((option) => <button key={option} type="button" onClick={() => setFilter(option)} className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-black ${filter === option ? "bg-forest text-white" : "bg-sand text-ink"}`}>{option}</button>)}
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {cabinetFilters.map((option) => <button key={option} type="button" onClick={() => setCabinetFilter(option)} className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-black ${cabinetFilter === option ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-black/10"}`}>{option}</button>)}
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-5">
      <CabinetMetric label="Work orders" value={cabinetCounts.workOrders} />
      <CabinetMetric label="Paperwork" value={cabinetCounts.paperwork} />
      <CabinetMetric label="Signed docs" value={cabinetCounts.signedDocs} />
      <CabinetMetric label="Receipt files" value={cabinetCounts.receipts} />
      <CabinetMetric label="Other" value={cabinetCounts.other} />
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-sand p-4">
        <div><h2 className="text-lg font-black">Job document status</h2><p className="text-sm font-semibold text-black/45">{rows.length} job{rows.length === 1 ? "" : "s"} in {filter.toLowerCase()} / {cabinetFilter.toLowerCase()} view.</p></div>
        <Link href="/import" className="text-sm font-black text-forest">Import work order</Link>
      </div>
      <div className="divide-y divide-black/5">
        {rows.map((job) => {
          const files = job.workOrderFiles || [];
          const receipts = job.receipts || [];
          const paperworkReady = hasPaperwork(job);
          const blockers = billingBlockers(job);
          const score = readinessScore(job);
          const categoryCounts = categorySummary(job);
          const receiptBackupMissing = isReceiptBackupMissing(job);
          return <div key={job.jobId} className="p-4 hover:bg-black/[.02]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.customerName}</p>
                <h3 className="mt-1 truncate text-lg font-black">{job.jobType || "Job"} · {job.city || "No city"}</h3>
                <p className="mt-1 text-sm font-semibold text-black/45">{job.source}{job.dealerName ? ` · ${job.dealerName}` : ""}{job.factoryWorkOrderNumber ? ` · ${job.factoryWorkOrderNumber}` : ""}</p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs font-black sm:grid-cols-5">
              <Pill icon={<DocumentTextIcon />} label={`${files.length} file${files.length === 1 ? "" : "s"}`} tone={files.length ? "bg-emerald-100 text-emerald-900" : "bg-black/5 text-black/45"} />
              <Pill icon={<ReceiptPercentIcon />} label={`${receipts.length} receipt${receipts.length === 1 ? "" : "s"}`} tone={receipts.length ? "bg-blue-100 text-blue-900" : "bg-black/5 text-black/45"} />
              <Pill icon={receiptBackupMissing ? <ExclamationTriangleIcon /> : <CheckCircleIcon />} label={receiptBackupMissing ? "Receipt backup missing" : "Receipt backup ok"} tone={receiptBackupMissing ? "bg-orange-100 text-orange-900" : "bg-emerald-100 text-emerald-900"} />
              <Pill label={paperworkReady ? "Paperwork ready" : "Needs paperwork"} tone={paperworkReady ? "bg-lime text-ink" : "bg-orange-100 text-orange-900"} />
              <Pill icon={blockers.length ? <ExclamationTriangleIcon /> : <CheckCircleIcon />} label={`${score}% ready`} tone={blockers.length ? "bg-orange-100 text-orange-900" : "bg-forest text-white"} />
              <Pill icon={<BanknotesIcon />} label={isBillingCandidate(job) ? isReadyForBilling(job) ? "Invoice ready" : "Review packet" : "Not billing yet"} tone={isBillingCandidate(job) ? isReadyForBilling(job) ? "bg-emerald-100 text-emerald-900" : "bg-orange-100 text-orange-900" : "bg-black/5 text-black/45"} />
            </div>
            {receiptBackupMissing && <p className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-900">Uploaded receipt backup is missing for entered dollars.</p>}
            {blockers.length > 0 && <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">Closeout blockers: {blockers.map((blocker) => blocker.label).join(", ")}</p>}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-xs font-black text-black/50">
              <span className="shrink-0 rounded-full bg-sand px-3 py-1">WO {categoryCounts.workOrders}</span>
              <span className="shrink-0 rounded-full bg-sand px-3 py-1">Paperwork {categoryCounts.paperwork}</span>
              <span className="shrink-0 rounded-full bg-sand px-3 py-1">Signed {categoryCounts.signedDocs}</span>
              <span className="shrink-0 rounded-full bg-sand px-3 py-1">Receipt files {categoryCounts.receipts}</span>
              <span className="shrink-0 rounded-full bg-sand px-3 py-1">Other {categoryCounts.other}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Link href={`/jobs/${job.jobId}#paperwork`} className="min-h-11 rounded-xl bg-forest px-3 py-2 text-center text-sm font-black text-white">Paperwork</Link>
              <Link href={`/jobs/${job.jobId}#receipts`} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm font-black text-ink">Receipts</Link>
              <Link href={`/jobs/${job.jobId}/packet`} className="min-h-11 rounded-xl bg-sand px-3 py-2 text-center text-sm font-black text-ink">Packet</Link>
              <Link href={`/jobs/${job.jobId}`} className="min-h-11 rounded-xl bg-ink px-3 py-2 text-center text-sm font-black text-white">Profile</Link>
            </div>
          </div>;
        })}
        {rows.length === 0 && <p className="p-8 text-center text-sm font-semibold text-black/35">No jobs match this filter.</p>}
      </div>
      </div>

      <aside className="space-y-5">
        <section className="card overflow-hidden">
          <div className="bg-sand p-4">
            <div className="flex items-start gap-2">
              <FolderOpenIcon className="mt-0.5 size-5 text-forest" />
              <div>
                <h2 className="font-black">Recent file cabinet</h2>
                <p className="text-xs font-semibold text-black/45">Latest uploaded paperwork and receipt files for the selected file type.</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-black/5">
            {recentItems.length ? recentItems.map((item) => <RecentDocumentItem key={item.id} item={item} />) : <p className="p-6 text-center text-sm font-semibold text-black/35">No uploaded files or receipt attachments yet.</p>}
          </div>
        </section>

        <section className="card p-4">
          <div className="mb-3 grid size-10 place-items-center rounded-xl bg-lime text-ink"><PrinterIcon className="size-5" /></div>
          <h2 className="font-black">Simple filing rule</h2>
          <p className="mt-1 text-sm font-semibold text-black/50">Every job should have a work order or paperwork file before dispatch, then receipts, sign-offs, after photos, and packet review before billing.</p>
        </section>
      </aside>
    </section>
  </div>;
}

function hasPaperwork(job: Job) {
  return Boolean(job.paperworkPickedUp || (job.workOrderFiles || []).length || (job.paperworkItems || []).some((item) => ["Collected", "Submitted", "Not needed"].includes(item.status)));
}

function documentScore(job: Job) {
  return (hasPaperwork(job) ? 0 : 100) + (isReceiptBackupMissing(job) ? 90 : 0) + (isBillingCandidate(job) && !isReadyForBilling(job) ? 75 : 0) + (job.receipts?.length || 0) + (job.workOrderFiles?.length || 0);
}

function isBillingCandidate(job: Job) {
  return ["Complete", "Billed", "Paid"].includes(job.status) || ["Ready", "Needs more info", "Draft", "Sent to Billing", "Sent", "On hold"].includes(job.invoiceStatus);
}

function matchesFilter(job: Job, filter: DocumentFilter) {
  if (filter === "Missing paperwork") return !hasPaperwork(job);
  if (filter === "Missing receipt backup") return isReceiptBackupMissing(job);
  if (filter === "Has files") return Boolean(job.workOrderFiles?.length);
  if (filter === "Has receipts") return Boolean(job.receipts?.length);
  if (filter === "Needs billing review") return isBillingCandidate(job) && !isReadyForBilling(job);
  if (filter === "Ready to invoice") return isBillingCandidate(job) && isReadyForBilling(job);
  return true;
}

function parseDocumentFilter(value: string | null): DocumentFilter {
  const normalized = value?.replaceAll("-", " ").toLowerCase();
  return filters.find((filter) => filter.toLowerCase() === normalized) || "All";
}

function matchesCabinetFilter(job: Job, filter: CabinetFilter) {
  if (filter === "All files") return true;
  return jobDocuments(job).some((item) => matchesRecentCategory(item, filter));
}

type RecentDocument = {
  id: string;
  job: Job;
  label: string;
  category: string;
  uploadedAt: string;
  href: string;
  amount?: string;
};

function buildRecentDocuments(jobs: Job[]): RecentDocument[] {
  const items: RecentDocument[] = [];
  for (const job of jobs) {
    for (const file of job.workOrderFiles || []) items.push(fileToRecent(job, file));
    for (const receipt of job.receipts || []) {
      if (receipt.file) items.push(receiptToRecent(job, receipt));
    }
  }
  return items.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

function jobDocuments(job: Job): RecentDocument[] {
  const items: RecentDocument[] = [];
  for (const file of job.workOrderFiles || []) items.push(fileToRecent(job, file));
  for (const receipt of job.receipts || []) {
    if (receipt.file) items.push(receiptToRecent(job, receipt));
  }
  return items;
}

function fileToRecent(job: Job, file: WorkOrderFile): RecentDocument {
  return {
    id: `${job.jobId}-file-${file.id}`,
    job,
    label: file.fileName,
    category: file.category || "File",
    uploadedAt: file.uploadedAt,
    href: file.storageUrl || file.dataUrl,
  };
}

function receiptToRecent(job: Job, receipt: ReceiptItem): RecentDocument {
  const file = receipt.file as WorkOrderFile;
  return {
    id: `${job.jobId}-receipt-${receipt.id}`,
    job,
    label: file.fileName || `${receipt.vendor} receipt`,
    category: `Receipt · ${receipt.vendor}`,
    uploadedAt: file.uploadedAt || receipt.date,
    href: file.storageUrl || file.dataUrl,
    amount: receipt.amount,
  };
}

function matchesRecentCategory(item: RecentDocument, filter: CabinetFilter) {
  if (filter === "All files") return true;
  if (filter === "Work Orders") return item.category === "Work Order";
  if (filter === "Paperwork") return item.category === "Paperwork";
  if (filter === "Signed Docs") return item.category === "Signed Document";
  if (filter === "Receipts") return item.category.startsWith("Receipt");
  return !["Work Order", "Paperwork", "Signed Document"].includes(item.category) && !item.category.startsWith("Receipt");
}

function countCabinetItems(items: RecentDocument[]) {
  return items.reduce((counts, item) => {
    if (item.category === "Work Order") counts.workOrders += 1;
    else if (item.category === "Paperwork") counts.paperwork += 1;
    else if (item.category === "Signed Document") counts.signedDocs += 1;
    else if (item.category.startsWith("Receipt")) counts.receipts += 1;
    else counts.other += 1;
    return counts;
  }, { workOrders: 0, paperwork: 0, signedDocs: 0, receipts: 0, other: 0 });
}

function categorySummary(job: Job) {
  return countCabinetItems(jobDocuments(job));
}

function ActionCard({ href, title, detail, icon, primary }: { href: string; title: string; detail: string; icon: React.ReactNode; primary?: boolean }) {
  return <Link href={href} className={`card block p-4 ${primary ? "bg-forest text-white" : ""}`}>
    <div className={`mb-3 grid size-10 place-items-center rounded-xl ${primary ? "bg-white/15 text-white" : "bg-lime text-ink"} [&>svg]:size-5`}>{icon}</div>
    <h2 className="font-black">{title}</h2>
    <p className={`mt-1 text-sm font-semibold ${primary ? "text-white/65" : "text-black/45"}`}>{detail}</p>
  </Link>;
}

function RecentDocumentItem({ item }: { item: RecentDocument }) {
  return <div className="p-4">
    <p className="text-xs font-black uppercase tracking-wide text-forest">{item.job.jobId} · {item.job.customerName}</p>
    <h3 className="mt-1 line-clamp-2 font-black">{item.label}</h3>
    <p className="mt-1 text-xs font-semibold text-black/45">{item.category}{item.amount ? ` · $${item.amount}` : ""} · {formatDate(item.uploadedAt)}</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <a href={item.href} target="_blank" className="min-h-10 rounded-xl bg-forest px-3 py-2 text-center text-xs font-black text-white">Open file</a>
      <Link href={`/jobs/${item.job.jobId}#paperwork`} className="min-h-10 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-xs font-black text-ink">Job files</Link>
    </div>
  </div>;
}

function formatDate(date: string) {
  if (!date) return "No date";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-white/55">{label}</p></div>;
}

function CabinetMetric({ label, value }: { label: string; value: number }) {
  return <div className="card p-4">
    <p className="text-2xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-black/45">{label}</p>
  </div>;
}

function Pill({ label, icon, tone }: { label: string; icon?: React.ReactNode; tone: string }) {
  return <span className={`inline-flex min-h-10 items-center justify-center gap-1 rounded-xl px-2 py-2 ${tone} [&>svg]:size-4`}>{icon}{label}</span>;
}
