import type { Job, JobActivity } from "./types";
import { isReceiptBackupMissing } from "./receipt-backup";

export type ReadinessCheck = {
  label: string;
  ok: boolean;
  detail: string;
};

export type IntakeCompleteness = {
  complete: boolean;
  core: ReadinessCheck[];
  scheduling: ReadinessCheck[];
  optional: ReadinessCheck[];
};

export type CorrectionCategory = "Photos" | "Paperwork" | "Checklist" | "Notes";
export const billingBoardStates = ["Not Ready", "Ready to Invoice", "Invoiced", "Paid / Complete"] as const;
export type BillingBoardState = typeof billingBoardStates[number];

export const correctionCategories: CorrectionCategory[] = ["Photos", "Paperwork", "Checklist", "Notes"];
const correctionPrefix = "Manager correction requested:";

export function openParts(job: Job) {
  return (job.partsItems || []).filter((part) => ["Needed", "Ordered", "Picked up"].includes(part.status));
}

function readinessEvidence(job: Job) {
  const paperworkReady = Boolean(job.paperworkPickedUp || (job.workOrderFiles || []).length || (job.paperworkItems || []).some((item) => ["Collected", "Submitted", "Not needed"].includes(item.status)));
  const completionSignoff = (job.signoffs || []).some((signoff) => signoff.accepted && ["Completion Sign-off", "Customer Approval"].includes(signoff.type));
  const sourceNotified = (job.activityLog || []).some((entry) => ["Customer", "Source"].includes(entry.type) || /notified|called|text|voicemail|contacted/i.test(entry.message));
  const invoiceReady = ["Ready", "Draft", "Sent to Billing", "Sent", "Paid"].includes(job.invoiceStatus);
  const invoiceCreated = ["Draft", "Sent to Billing", "Sent", "Paid"].includes(job.invoiceStatus);
  const jobComplete = ["Complete", "Billed", "Paid"].includes(job.status);
  const fieldWorkComplete = ["Needs Inspection", "Complete", "Billed", "Paid"].includes(job.status);
  const completionNotes = Boolean(job.completionNotes?.trim());
  const afterPhotoCount = (job.afterPhotos || []).length;
  const serialPhotoCount = (job.serialTagPhotos || []).length;
  const beforePhotosTaken = (job.beforePhotos || []).length > 0;
  const parts = openParts(job);
  return {
    closeout: [
      { label: "Job complete", ok: jobComplete, detail: job.status },
      { label: "Completion notes", ok: completionNotes, detail: completionNotes ? "Added" : "Missing" },
      { label: "After photos", ok: afterPhotoCount > 0, detail: `${afterPhotoCount} uploaded` },
      { label: "Serial/VIN photo", ok: serialPhotoCount > 0, detail: `${serialPhotoCount} uploaded` },
      { label: "Paperwork", ok: paperworkReady, detail: paperworkReady ? "Collected or attached" : "Missing" },
      { label: "Completion sign-off", ok: completionSignoff, detail: completionSignoff ? "Signed" : "Missing" },
      { label: "Open parts", ok: parts.length === 0, detail: parts.length ? `${parts.length} still open` : "None open" },
      { label: "Customer/source notified", ok: sourceNotified, detail: sourceNotified ? "Logged" : "Not logged" },
      { label: "Invoice status", ok: invoiceReady, detail: job.invoiceStatus || "Not started" },
    ],
    checklist: {
      "Paperwork picked up": paperworkReady,
      "Before photos taken": beforePhotosTaken,
      "Serial/VIN tag photo taken": serialPhotoCount > 0,
      "Work completed": fieldWorkComplete,
      "After photos taken": afterPhotoCount > 0,
      "Completion notes added": completionNotes,
      "Customer/source notified": sourceNotified,
      "Invoice created": invoiceCreated,
    } as Record<string, boolean>,
  };
}

export function closeoutChecks(job: Job): ReadinessCheck[] {
  return readinessEvidence(job).closeout;
}

export function readinessScore(job: Job) {
  const checks = closeoutChecks(job);
  const ready = checks.filter((check) => check.ok).length;
  return Math.round((ready / checks.length) * 100);
}

export function checklistProgress(job: Job) {
  const { checklist } = readinessEvidence(job);
  const items = (job.checklist || []).map((item) => ({
    ...item,
    complete: item.complete || checklist[item.label] || false,
  }));
  const complete = items.filter((item) => item.complete).length;
  return { items, complete, total: items.length, remaining: items.length - complete, percent: items.length ? Math.round((complete / items.length) * 100) : 0 };
}

function activeCorrectionRequest(job: Job) {
  return (job.activityLog || []).find((entry) => entry.type === "Status" && !entry.resolvedAt && entry.message.startsWith(correctionPrefix));
}

export function activeCorrectionCategories(job: Job): CorrectionCategory[] {
  const request = activeCorrectionRequest(job);
  if (!request) return [];
  return correctionCategories.filter((category) => request.message.includes(category));
}

export function hasActiveCorrections(job: Job) {
  return activeCorrectionCategories(job).length > 0;
}

export function correctionCategoryComplete(job: Job, category: CorrectionCategory) {
  const request = activeCorrectionRequest(job);
  const requestedAt = request ? Date.parse(request.createdAt) : Number.NaN;
  if (!Number.isFinite(requestedAt)) return false;
  const uploadedAfterRequest = (file: { uploadedAt: string }) => {
    const uploadedAt = Date.parse(file.uploadedAt);
    return Number.isFinite(uploadedAt) && uploadedAt > requestedAt;
  };
  if (category === "Photos") return (job.workOrderFiles || []).some((file) => file.category === "After" && uploadedAfterRequest(file));
  if (category === "Paperwork") return (job.workOrderFiles || []).some((file) => ["Work Order", "Paperwork", "Signed Document"].includes(file.category || "") && uploadedAfterRequest(file));
  if (category === "Checklist") return (job.checklist || []).filter((item) => !/invoice created/i.test(item.label)).every((item) => item.complete);
  if (category === "Notes") return Boolean(job.completionNotes?.trim());
  return false;
}

export function correctionSectionsComplete(job: Job) {
  const categories = activeCorrectionCategories(job);
  return categories.length > 0 && categories.every((category) => correctionCategoryComplete(job, category));
}

export function buildCorrectionActivity(categories: CorrectionCategory[], createdBy = "Manager"): JobActivity {
  return {
    id: `activity-${Date.now()}`,
    type: "Status",
    message: `${correctionPrefix} ${categories.join(", ")}`,
    createdAt: new Date().toISOString(),
    createdBy,
    audience: "All",
  };
}

export function correctionResolutionPatch(current: Job, next: Job): Partial<Job> {
  if (!hasActiveCorrections(current) || !correctionSectionsComplete(next)) return {};
  const now = new Date().toISOString();
  const resolvedActivity: JobActivity = {
    id: `activity-${Date.now()}-corrections-complete`,
    type: "Status",
    message: "Manager corrections completed. Ready for review.",
    createdAt: now,
    createdBy: "System",
    audience: "All",
  };
  return {
    status: "Needs Inspection",
    activityLog: [
      resolvedActivity,
      ...(next.activityLog || []).map((entry) => entry.type === "Status" && !entry.resolvedAt && entry.message.startsWith(correctionPrefix)
        ? { ...entry, resolvedAt: now, resolvedBy: "System" }
        : entry),
    ].slice(0, 50),
  };
}

export function billingBlockers(job: Job) {
  const closeoutBlockers = closeoutChecks(job).filter((check) => !check.ok && ["Job complete", "Completion notes", "After photos", "Paperwork", "Completion sign-off", "Open parts"].includes(check.label));
  return [...closeoutBlockers, ...billingEvidenceChecks(job).filter((check) => !check.ok)];
}

export function isReadyForBilling(job: Job) {
  return billingBlockers(job).length === 0;
}

export function billingBoardState(job: Job): BillingBoardState {
  if (job.status === "Paid" || job.invoiceStatus === "Paid") return "Paid / Complete";
  if (job.status === "Billed" || ["Sent to Billing", "Sent"].includes(job.invoiceStatus)) return "Invoiced";
  if (isReadyForBilling(job)) return "Ready to Invoice";
  return "Not Ready";
}

export type PaymentFollowUp = {
  label: string;
  pastDue: boolean;
  invoiceTimestamp: number;
};

export function paymentFollowUpFor(job: Job, today = startOfToday()): PaymentFollowUp | null {
  const invoiceTimestamp = dateTimestamp(job.invoiceDate);
  if (job.paymentDueDate) {
    const dueTimestamp = dateTimestamp(job.paymentDueDate);
    return {
      label: dueTimestamp !== undefined && dueTimestamp < today ? "Past Due" : "Due Soon",
      pastDue: dueTimestamp !== undefined && dueTimestamp < today,
      invoiceTimestamp: invoiceTimestamp ?? Number.MAX_SAFE_INTEGER,
    };
  }
  if (invoiceTimestamp === undefined) return { label: "Invoice date not recorded", pastDue: false, invoiceTimestamp: Number.MAX_SAFE_INTEGER };
  const ageDays = Math.max(0, Math.floor((today - invoiceTimestamp) / 86_400_000));
  const label = ageDays <= 7 ? "Invoice Age 0–7 days" : ageDays <= 14 ? "Invoice Age 8–14 days" : ageDays <= 30 ? "Invoice Age 15–30 days" : "Invoice Age 30+ days";
  return { label, pastDue: false, invoiceTimestamp };
}

export function paymentFollowUpForBilling(job: Job, today = startOfToday()): PaymentFollowUp | null {
  if (billingBoardState(job) !== "Invoiced" || job.status === "Paid" || job.invoiceStatus === "Paid" || job.paidDate) return null;
  return paymentFollowUpFor(job, today);
}

function dateTimestamp(value?: string) {
  if (!value) return undefined;
  const timestamp = new Date(`${value.slice(0, 10)}T00:00:00`).getTime();
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function startOfToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
}

function billingEvidenceChecks(job: Job): ReadinessCheck[] {
  const entries = job.timeEntries || [];
  const travelStarted = entries.some((entry) => entry.notes === "Started Travel");
  const arrived = entries.some((entry) => entry.type === "Arrived");
  const workStarted = entries.some((entry) => entry.type === "Work started");
  const departed = entries.some((entry) => entry.type === "Departed");
  const mileageRecorded = entries.some((entry) => entry.type === "Mileage" && entry.mileage !== undefined && entry.mileage !== "");
  const helperHours = job.factoryCost?.helperHours?.trim() || "";
  const helperRate = job.factoryCost?.helperRate?.trim() || "";
  const workHours = job.factoryCost?.workHours?.trim() || "";
  const workRate = job.factoryCost?.workRate?.trim() || "";
  const correctionsOpen = hasActiveCorrections(job);

  return [
    {
      label: "Travel arrival",
      ok: !travelStarted || arrived,
      detail: !travelStarted ? "No travel logged" : arrived ? "Arrival logged" : "Travel started without arrival",
    },
    {
      label: "Mileage log",
      ok: !travelStarted || mileageRecorded,
      detail: !travelStarted ? "No travel logged" : mileageRecorded ? "Mileage logged" : "Travel logged without mileage",
    },
    {
      label: "Work session",
      ok: !workStarted || departed,
      detail: !workStarted ? "No work session logged" : departed ? "Work departure logged" : "Work started without departure",
    },
    {
      label: "Work cost details",
      ok: job.source !== "Factory" || Boolean(workHours) === Boolean(workRate),
      detail: job.source !== "Factory" ? "Not a factory job" : !workHours && !workRate ? "No work cost recorded" : workHours && workRate ? "Hours and rate recorded" : workHours ? "Work rate missing" : "Work hours missing",
    },
    {
      label: "Helper cost details",
      ok: job.source !== "Factory" || Boolean(helperHours) === Boolean(helperRate),
      detail: job.source !== "Factory" ? "Not a factory job" : !helperHours && !helperRate ? "No helper cost recorded" : helperHours && helperRate ? "Hours and rate recorded" : helperHours ? "Helper rate missing" : "Helper hours missing",
    },
    {
      label: "Receipt backup",
      ok: !isReceiptBackupMissing(job),
      detail: isReceiptBackupMissing(job) ? "Receipt dollars need uploaded backup" : "No missing receipt backup",
    },
    {
      label: "Manager corrections",
      ok: !correctionsOpen,
      detail: correctionsOpen ? `Open: ${activeCorrectionCategories(job).join(", ")}` : "No active corrections",
    },
  ];
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

export function intakeCompleteness(job: Job): IntakeCompleteness {
  const assigned = Boolean(job.fullCrew || job.assignedEmployeeIds?.length || (job.assignedCrew && job.assignedCrew !== "Unassigned"));
  const core = [
    { label: "Customer", ok: Boolean(job.customerName?.trim()), detail: job.customerName?.trim() ? "Recorded" : "Missing" },
    { label: "Customer phone", ok: Boolean(job.phone?.trim()), detail: job.phone?.trim() ? "Recorded" : "Missing" },
    { label: "Service address", ok: Boolean(job.address?.trim() && job.city?.trim()), detail: job.address?.trim() && job.city?.trim() ? "Recorded" : "Missing" },
    { label: "Work type", ok: Boolean(job.jobType?.trim()), detail: job.jobType?.trim() ? "Recorded" : "Missing" },
    { label: "Work description", ok: Boolean(job.scopeNotes?.trim()), detail: job.scopeNotes?.trim() ? "Recorded" : "Missing" },
  ];
  const scheduling = [
    { label: "Scheduled date", ok: Boolean(job.dueDate), detail: job.dueDate || "Not assigned" },
    { label: "Employee assignment", ok: assigned, detail: assigned ? "Assigned" : "Not assigned" },
  ];
  const optional = [
    { label: "Work order / reference", ok: Boolean(job.factoryWorkOrderNumber?.trim()), detail: job.factoryWorkOrderNumber?.trim() ? "Recorded" : "Not recorded" },
    { label: "Serial / unit number", ok: Boolean(job.serialUnitNumber?.trim()), detail: job.serialUnitNumber?.trim() ? "Recorded" : "Not recorded" },
  ];
  return { complete: core.every((check) => check.ok), core, scheduling, optional };
}
