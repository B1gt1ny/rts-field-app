import type { Job } from "./types";

export type ReadinessCheck = {
  label: string;
  ok: boolean;
  detail: string;
};

export function openParts(job: Job) {
  return (job.partsItems || []).filter((part) => ["Needed", "Ordered", "Picked up"].includes(part.status));
}

export function closeoutChecks(job: Job): ReadinessCheck[] {
  const paperworkReady = Boolean(job.paperworkPickedUp || (job.workOrderFiles || []).length || (job.paperworkItems || []).some((item) => ["Collected", "Submitted", "Not needed"].includes(item.status)));
  const completionSignoff = (job.signoffs || []).some((signoff) => signoff.accepted && ["Completion Sign-off", "Customer Approval"].includes(signoff.type));
  const sourceNotified = (job.activityLog || []).some((entry) => ["Customer", "Source"].includes(entry.type) || /notified|called|text|voicemail|contacted/i.test(entry.message));
  const invoiceReady = ["Ready", "Draft", "Sent to Billing", "Sent", "Paid"].includes(job.invoiceStatus);
  const parts = openParts(job);
  return [
    { label: "Job complete", ok: ["Complete", "Billed", "Paid"].includes(job.status), detail: job.status },
    { label: "Completion notes", ok: Boolean(job.completionNotes?.trim()), detail: job.completionNotes?.trim() ? "Added" : "Missing" },
    { label: "After photos", ok: (job.afterPhotos || []).length > 0, detail: `${(job.afterPhotos || []).length} uploaded` },
    { label: "Serial/VIN photo", ok: (job.serialTagPhotos || []).length > 0, detail: `${(job.serialTagPhotos || []).length} uploaded` },
    { label: "Paperwork", ok: paperworkReady, detail: paperworkReady ? "Collected or attached" : "Missing" },
    { label: "Completion sign-off", ok: completionSignoff, detail: completionSignoff ? "Signed" : "Missing" },
    { label: "Open parts", ok: parts.length === 0, detail: parts.length ? `${parts.length} still open` : "None open" },
    { label: "Customer/source notified", ok: sourceNotified, detail: sourceNotified ? "Logged" : "Not logged" },
    { label: "Invoice status", ok: invoiceReady, detail: job.invoiceStatus || "Not started" },
  ];
}

export function readinessScore(job: Job) {
  const checks = closeoutChecks(job);
  const ready = checks.filter((check) => check.ok).length;
  return Math.round((ready / checks.length) * 100);
}

export function billingBlockers(job: Job) {
  return closeoutChecks(job).filter((check) => !check.ok && ["Job complete", "Completion notes", "After photos", "Paperwork", "Completion sign-off", "Open parts"].includes(check.label));
}

export function isReadyForBilling(job: Job) {
  return billingBlockers(job).length === 0;
}

export function dispatchChecks(job: Job): ReadinessCheck[] {
  const assigned = Boolean(job.fullCrew || job.assignedEmployeeIds?.length || (job.assignedCrew && job.assignedCrew !== "Unassigned"));
  const paperworkReady = Boolean(job.paperworkPickedUp || (job.workOrderFiles || []).length || (job.paperworkItems || []).some((item) => ["Collected", "Submitted", "Not needed"].includes(item.status)));
  const partsOpen = openParts(job);
  const materialsBlocked = job.status === "Waiting on Parts" || partsOpen.some((part) => ["Needed", "Ordered"].includes(part.status));
  return [
    { label: "Scheduled", ok: Boolean(job.dueDate), detail: job.dueDate || "Missing date" },
    { label: "Employee assigned", ok: assigned, detail: job.fullCrew ? "Full crew" : job.assignedCrew || "Unassigned" },
    { label: "Scope notes", ok: Boolean(job.scopeNotes?.trim()), detail: job.scopeNotes?.trim() ? "Added" : "Missing" },
    { label: "Paperwork/work order", ok: paperworkReady, detail: paperworkReady ? "Collected or attached" : "Missing" },
    { label: "Materials/parts", ok: !materialsBlocked, detail: materialsBlocked ? `${partsOpen.length || 1} open part issue` : "No open blocker" },
    { label: "Customer info", ok: Boolean(job.customerName?.trim() && job.phone?.trim() && job.address?.trim() && job.city?.trim()), detail: job.phone && job.address ? "Contact and address added" : "Missing contact or address" },
  ];
}

export function dispatchReadinessScore(job: Job) {
  const checks = dispatchChecks(job);
  const ready = checks.filter((check) => check.ok).length;
  return Math.round((ready / checks.length) * 100);
}

export function dispatchBlockers(job: Job) {
  return dispatchChecks(job).filter((check) => !check.ok);
}

export function isReadyForDispatch(job: Job) {
  return dispatchBlockers(job).length === 0;
}
