import type { JobStatus, Priority } from "@/lib/types";

const statusStyles: Record<JobStatus, string> = {
  New: "bg-blue-50 text-blue-700", Scheduled: "bg-violet-50 text-violet-700", "In Progress": "bg-amber-50 text-amber-800",
  "Waiting on Parts": "bg-orange-50 text-orange-700", "Needs Inspection": "bg-cyan-50 text-cyan-700", Complete: "bg-emerald-50 text-emerald-700",
  Billed: "bg-slate-100 text-slate-700", Paid: "bg-forest text-white",
};
export function StatusBadge({ status }: { status: JobStatus }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ${statusStyles[status]}`}>{status}</span>; }
export function PriorityBadge({ priority }: { priority: Priority }) { return <span className={`text-xs font-extrabold ${priority === "Urgent" ? "text-red-600" : priority === "High" ? "text-orange-600" : "text-black/40"}`}>{priority}</span>; }
