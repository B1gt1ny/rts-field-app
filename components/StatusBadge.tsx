import type { JobStatus, Priority } from "@/lib/types";

const statusStyles: Record<JobStatus, string> = {
  New: "job-status-new", Scheduled: "job-status-scheduled", "In Progress": "job-status-progress",
  "Waiting on Parts": "job-status-parts", "Needs Inspection": "job-status-inspection", Complete: "job-status-complete",
  Billed: "job-status-billed", Paid: "job-status-paid",
};
export function StatusBadge({ status }: { status: JobStatus }) { return <span className={`job-status inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${statusStyles[status]}`}>{status}</span>; }
export function PriorityBadge({ priority }: { priority: Priority }) { return <span className={`inline-flex items-center rounded-full bg-current/5 px-2 py-1 text-[11px] font-black uppercase tracking-wide ${priority === "Urgent" ? "text-red-600" : priority === "High" ? "text-orange-600" : "text-black/40"}`}>{priority}</span>; }
