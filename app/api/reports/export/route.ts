import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { factoryCostGrandTotal } from "@/lib/factory-costs";
import { getJobs } from "@/lib/jobs";
import { isReceiptBackupMissing } from "@/lib/receipt-backup";
import { billingBlockers, openParts, readinessScore } from "@/lib/job-readiness";
import type { Job } from "@/lib/types";

export const dynamic = "force-dynamic";

type ReportType = "all-jobs" | "daily-dispatch" | "parts-run" | "billing-review" | "customer-summary" | "time-log" | "signoffs" | "communications" | "document-manifest";

export async function GET(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const url = new URL(request.url);
  const type = normalizeReportType(url.searchParams.get("type"));
  const jobs = await getJobs();
  const rows = reportRows(type, jobs);
  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="company-command-${type}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function normalizeReportType(value: string | null): ReportType {
  if (value === "daily-dispatch" || value === "parts-run" || value === "billing-review" || value === "customer-summary" || value === "time-log" || value === "signoffs" || value === "communications" || value === "document-manifest" || value === "all-jobs") return value;
  return "all-jobs";
}

function reportRows(type: ReportType, jobs: Job[]) {
  if (type === "daily-dispatch") return dailyDispatchRows(jobs);
  if (type === "parts-run") return partsRunRows(jobs);
  if (type === "billing-review") return billingReviewRows(jobs);
  if (type === "customer-summary") return customerSummaryRows(jobs);
  if (type === "time-log") return timeLogRows(jobs);
  if (type === "signoffs") return signoffRows(jobs);
  if (type === "communications") return communicationRows(jobs);
  if (type === "document-manifest") return documentManifestRows(jobs);
  return allJobRows(jobs);
}

function customerSummaryRows(jobs: Job[]) {
  const customers = new Map<string, Job[]>();
  for (const job of jobs) {
    const key = normalizeCustomerKey(job);
    customers.set(key, [...(customers.get(key) || []), job]);
  }
  return Array.from(customers.values()).map((customerJobs) => {
    const sorted = [...customerJobs].sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || ""));
    const latest = sorted[0];
    const activeJobs = sorted.filter((job) => !["Complete", "Billed", "Paid"].includes(job.status));
    const openPartsJobs = sorted.filter((job) => openParts(job).length || job.status === "Waiting on Parts" || job.partsNeeded.trim());
    const followUps = sorted.reduce((total, job) => total + (job.activityLog || []).filter((entry) => entry.notify && !entry.resolvedAt).length, 0);
    const billingAttention = sorted.filter((job) => ["Complete", "Billed"].includes(job.status) && !["Paid", "Sent", "Sent to Billing"].includes(job.invoiceStatus || ""));
    return {
      customerName: latest.customerName,
      phone: latest.phone,
      address: latest.address,
      city: latest.city,
      totalJobs: sorted.length,
      activeJobs: activeJobs.length,
      latestJobId: latest.jobId,
      latestStatus: latest.status,
      latestDueDate: latest.dueDate,
      openPartsJobs: openPartsJobs.length,
      openFollowUps: followUps,
      billingAttention: billingAttention.length,
      repeatCustomer: sorted.length > 1 ? "Yes" : "No",
    };
  }).sort((a, b) => String(a.customerName).localeCompare(String(b.customerName)));
}

function allJobRows(jobs: Job[]) {
  return jobs.map((job) => ({
    jobId: job.jobId,
    customerName: job.customerName,
    phone: job.phone,
    source: job.source,
    dealerName: job.dealerName,
    factoryWorkOrderNumber: job.factoryWorkOrderNumber,
    address: job.address,
    city: job.city,
    dueDate: job.dueDate,
    status: job.status,
    priority: job.priority,
    assignedCrew: job.assignedCrew,
    jobType: job.jobType,
    invoiceStatus: job.invoiceStatus,
    readinessScore: readinessScore(job),
    signoffs: job.signoffs?.length || 0,
  }));
}

function dailyDispatchRows(jobs: Job[]) {
  const today = new Date().toLocaleDateString("en-CA");
  return jobs.filter((job) => job.dueDate === today && !["Complete", "Billed", "Paid"].includes(job.status)).map((job) => ({
    dueDate: job.dueDate,
    assignedCrew: job.assignedCrew,
    jobId: job.jobId,
    customerName: job.customerName,
    phone: job.phone,
    address: `${job.address}, ${job.city}`,
    status: job.status,
    priority: job.priority,
    jobType: job.jobType,
    partsNeeded: job.partsNeeded,
    scopeNotes: job.scopeNotes,
  }));
}

function partsRunRows(jobs: Job[]) {
  return jobs.flatMap((job) => {
    const structured = openParts(job).map((part) => ({
      jobId: job.jobId,
      customerName: job.customerName,
      city: job.city,
      part: part.name,
      quantity: part.quantity,
      status: part.status,
      notes: part.notes || "",
      requestedAt: part.requestedAt,
      assignedCrew: job.assignedCrew,
    }));
    if (structured.length) return structured;
    if (job.status === "Waiting on Parts" || job.partsNeeded.trim()) {
      return [{
        jobId: job.jobId,
        customerName: job.customerName,
        city: job.city,
        part: job.partsNeeded || "Parts needed",
        quantity: "",
        status: job.status === "Waiting on Parts" ? "Needed" : "",
        notes: job.partsNeeded,
        requestedAt: "",
        assignedCrew: job.assignedCrew,
      }];
    }
    return [];
  });
}

function billingReviewRows(jobs: Job[]) {
  return jobs.filter((job) => ["Complete", "Billed", "Paid"].includes(job.status) || ["Ready", "Needs more info", "Draft", "Sent to Billing", "Sent", "On hold"].includes(job.invoiceStatus)).map((job) => ({
    jobId: job.jobId,
    customerName: job.customerName,
    source: job.source,
    status: job.status,
    invoiceStatus: job.invoiceStatus,
    readinessScore: readinessScore(job),
    blockers: billingBlockers(job).map((blocker) => blocker.label).join("; "),
    receipts: job.receipts?.length || 0,
    factoryCostTotal: factoryCostGrandTotal(job).toFixed(2),
    receiptBackupMissing: isReceiptBackupMissing(job) ? "Yes" : "No",
    files: job.workOrderFiles?.length || 0,
    signoffs: job.signoffs?.length || 0,
    completionNotes: job.completionNotes ? "Added" : "Missing",
  }));
}

function documentManifestRows(jobs: Job[]) {
  return jobs.flatMap((job) => {
    const paperworkFiles = (job.workOrderFiles || []).map((file) => ({
      jobId: job.jobId,
      customerName: job.customerName,
      source: job.source,
      dealerName: job.dealerName,
      factoryWorkOrderNumber: job.factoryWorkOrderNumber,
      dueDate: job.dueDate,
      status: job.status,
      fileCategory: file.category || "File",
      fileName: file.fileName,
      fileType: file.fileType,
      fileSizeKb: (file.fileSize / 1024).toFixed(1),
      uploadedAt: file.uploadedAt,
      receiptVendor: "",
      receiptAmount: "",
      fileLink: file.storageUrl || file.dataUrl,
    }));
    const receiptFiles = (job.receipts || []).filter((receipt) => receipt.file).map((receipt) => {
      const file = receipt.file!;
      return {
        jobId: job.jobId,
        customerName: job.customerName,
        source: job.source,
        dealerName: job.dealerName,
        factoryWorkOrderNumber: job.factoryWorkOrderNumber,
        dueDate: job.dueDate,
        status: job.status,
        fileCategory: file.category || "Receipt",
        fileName: file.fileName,
        fileType: file.fileType,
        fileSizeKb: (file.fileSize / 1024).toFixed(1),
        uploadedAt: file.uploadedAt,
        receiptVendor: receipt.vendor,
        receiptAmount: receipt.amount,
        fileLink: file.storageUrl || file.dataUrl,
      };
    });
    return [...paperworkFiles, ...receiptFiles];
  });
}

function timeLogRows(jobs: Job[]) {
  return jobs.flatMap((job) => (job.timeEntries || []).map((entry) => ({
    jobId: job.jobId,
    customerName: job.customerName,
    city: job.city,
    employeeName: entry.employeeName,
    type: entry.type,
    createdAt: entry.createdAt,
    mileage: entry.mileage || "",
    notes: entry.notes || "",
    status: job.status,
    assignedCrew: job.assignedCrew,
  })));
}

function signoffRows(jobs: Job[]) {
  return jobs.flatMap((job) => (job.signoffs || []).map((signoff) => ({
    jobId: job.jobId,
    customerName: job.customerName,
    city: job.city,
    type: signoff.type,
    signerName: signoff.signerName,
    signerRole: signoff.signerRole,
    signedAt: signoff.signedAt,
    accepted: signoff.accepted ? "Yes" : "No",
    typedSignature: signoff.typedSignature,
    notes: signoff.notes || "",
    status: job.status,
    invoiceStatus: job.invoiceStatus,
  })));
}

function communicationRows(jobs: Job[]) {
  return jobs.flatMap((job) => (job.activityLog || []).map((entry) => ({
    jobId: job.jobId,
    customerName: job.customerName,
    city: job.city,
    source: job.source,
    type: entry.type,
    message: entry.message,
    createdAt: entry.createdAt,
    createdBy: entry.createdBy,
    audience: entry.audience || "All",
    followUp: entry.notify ? "Yes" : "No",
    followUpDueDate: entry.followUpDueDate || "",
    resolvedAt: entry.resolvedAt || "",
    resolvedBy: entry.resolvedBy || "",
    status: job.status,
    priority: job.priority,
    invoiceStatus: job.invoiceStatus,
  })));
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function normalizeCustomerKey(job: Job) {
  const phone = (job.phone || "").replace(/\D/g, "");
  if (phone) return phone;
  return [job.customerName, job.address, job.city].join("|").toLowerCase().replace(/\s+/g, " ").trim();
}
