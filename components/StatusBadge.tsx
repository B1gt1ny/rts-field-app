import type { JobStatus, Priority } from "@/lib/types";

const statusStyles: Record<JobStatus, string> = {
  New: "bg-blue-50 text-blue-700", Scheduled: "bg-violet-50 text-violet-700", "In Progress": "bg-yellow-300 text-black",
  "Waiting on Parts": "bg-orange-50 text-orange-700", "Needs Inspection": "bg-cyan-50 text-cyan-700", Complete: "bg-emerald-50 text-emerald-700",
  Billed: "bg-slate-100 text-slate-700", Paid: "bg-forest text-white",
};
export function StatusBadge({ status }: { status: JobStatus }) { return <span className={`inline-flex rounded-full border border-current/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${statusStyles[status]}`}>{status}</span>; }
export function PriorityBadge({ priority }: { priority: Priority }) { return <span className={`inline-flex items-center rounded-full bg-current/5 px-2 py-1 text-[11px] font-black uppercase tracking-wide ${priority === "Urgent" ? "text-red-600" : priority === "High" ? "text-orange-600" : "text-black/40"}`}>{priority}</span>; }
