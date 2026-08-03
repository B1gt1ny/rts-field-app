import { billingBlockers, isReadyForBilling, openParts, readinessScore } from "./job-readiness";
import { isReceiptBackupMissing } from "./receipt-backup";
import type { Job } from "./types";

export type JobTask = {
  id: string;
  title: string;
  detail: string;
  category: "Follow-up" | "Urgent" | "Parts" | "Paperwork" | "Photos" | "Billing" | "Schedule";
  priority: "High" | "Normal" | "Low";
  href: string;
  job: Job;
};

export function buildJobTasks(jobs: Job[]) {
  const active = jobs.filter((job) => !["Complete", "Billed", "Paid"].includes(job.status));
  const tasks: JobTask[] = [];
  const today = new Date().toLocaleDateString("en-CA");
  for (const job of active) {
    for (const entry of (job.activityLog || []).filter((activity) => activity.notify && !activity.resolvedAt).slice(0, 3)) {
      const dueLabel = entry.followUpDueDate ? entry.followUpDueDate < today ? "Overdue" : entry.followUpDueDate === today ? "Due today" : `Due ${entry.followUpDueDate}` : "No reminder date";
      tasks.push({
        id: `${job.jobId}-followup-${entry.id}`,
        title: entry.followUpDueDate && entry.followUpDueDate < today ? "Follow-up overdue" : entry.followUpDueDate === today ? "Follow-up due today" : "Follow-up flagged",
        detail: `${dueLabel}: ${entry.message}`,
        category: "Follow-up",
        priority: !entry.followUpDueDate || entry.followUpDueDate <= today ? "High" : "Normal",
        href: `/communication`,
        job,
      });
    }
    if (job.priority === "Urgent") tasks.push({
      id: `${job.jobId}-urgent`,
      title: "Urgent job active",
      detail: `${job.customerName} is marked urgent and still ${job.status.toLowerCase()}.`,
      category: "Urgent",
      priority: "High",
      href: `/jobs/${job.jobId}`,
      job,
    });
    if (!job.dueDate) tasks.push({
      id: `${job.jobId}-schedule`,
      title: "Job needs scheduled",
      detail: "Active job has no due date.",
      category: "Schedule",
      priority: "Normal",
      href: `/jobs/${job.jobId}#scheduling`,
      job,
    });
    if (job.status === "Waiting on Parts" && !openParts(job).length) tasks.push({
      id: `${job.jobId}-parts-note`,
      title: "Waiting on parts",
      detail: job.partsNeeded || "Parts are needed, but no structured part is listed yet.",
      category: "Parts",
      priority: "High",
      href: `/jobs/${job.jobId}#parts-needed`,
      job,
    });
    for (const part of openParts(job).slice(0, 5)) {
      tasks.push({
        id: `${job.jobId}-part-${part.id}`,
        title: `Part ${part.status.toLowerCase()}`,
        detail: `${part.quantity} × ${part.name}${part.notes ? ` — ${part.notes}` : ""}`,
        category: "Parts",
        priority: part.status === "Picked up" ? "Normal" : "High",
        href: `/jobs/${job.jobId}#parts-needed`,
        job,
      });
    }
    if (!job.paperworkPickedUp && !(job.workOrderFiles || []).length) tasks.push({
      id: `${job.jobId}-paperwork`,
      title: "Paperwork missing",
      detail: "No picked-up paperwork or saved work-order file is attached.",
      category: "Paperwork",
      priority: "Normal",
      href: `/jobs/${job.jobId}#operations`,
      job,
    });
  }
  for (const job of jobs.filter((item) => item.status === "Complete" && !(item.afterPhotos || []).length)) {
    tasks.push({
      id: `${job.jobId}-after-photos`,
      title: "Complete without after photos",
      detail: "Add after photos before billing if possible.",
      category: "Photos",
      priority: "Normal",
      href: `/jobs/${job.jobId}#photos`,
      job,
    });
  }
  for (const job of jobs.filter((item) => item.invoiceStatus === "Ready")) {
    tasks.push({
      id: `${job.jobId}-billing`,
      title: "Ready to invoice",
      detail: "Completion is ready for billing review.",
      category: "Billing",
      priority: "Normal",
      href: `/billing`,
      job,
    });
  }
  for (const job of jobs.filter((item) => item.invoiceStatus === "Needs more info")) {
    tasks.push({
      id: `${job.jobId}-billing-info`,
      title: "Billing needs more info",
      detail: "Office marked this job as needing more paperwork, notes, receipt detail, or closeout backup.",
      category: "Billing",
      priority: "High",
      href: `/jobs/${job.jobId}#billing-handoff`,
      job,
    });
  }
  for (const job of jobs.filter((item) => isReceiptBackupMissing(item))) {
    tasks.push({
      id: `${job.jobId}-receipt-backup`,
      title: "Receipt backup missing",
      detail: "Receipt or factory receipt dollars are entered, but no uploaded receipt file is attached.",
      category: "Billing",
      priority: "High",
      href: `/jobs/${job.jobId}#receipts`,
      job,
    });
  }
  for (const job of jobs.filter((item) => item.invoiceStatus === "Sent to Billing")) {
    tasks.push({
      id: `${job.jobId}-billing-sent`,
      title: "Sent to billing",
      detail: "Closeout packet is in the billing queue and ready for invoice creation.",
      category: "Billing",
      priority: "Low",
      href: `/billing`,
      job,
    });
  }
  for (const job of jobs.filter((item) => ["Complete", "Billed"].includes(item.status) && !isReadyForBilling(item))) {
    const blockers = billingBlockers(job);
    tasks.push({
      id: `${job.jobId}-billing-review`,
      title: `Billing review: ${readinessScore(job)}% ready`,
      detail: blockers.length ? blockers.map((blocker) => blocker.label).join(", ") : "Review job closeout before billing.",
      category: "Billing",
      priority: "High",
      href: `/jobs/${job.jobId}`,
      job,
    });
  }
  return tasks.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.category.localeCompare(b.category));
}

function priorityRank(priority: JobTask["priority"]) {
  return priority === "High" ? 0 : priority === "Normal" ? 1 : 2;
}
