import type { Job } from "./types";

const statusColors: Record<Job["status"], string> = {
  New: "#2563eb", Scheduled: "#7c3aed", "In Progress": "#0f766e", "Waiting on Parts": "#b45309",
  "Needs Inspection": "#0891b2", Complete: "#15803d", Billed: "#475569", Paid: "#65a30d",
};

export function calendarJobStyle(job: Job) {
  const color = statusColors[job.status];
  return job.schedulePlan === "Tentative"
    ? { backgroundColor: color, backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.32) 0 4px, transparent 4px 8px)" }
    : { backgroundColor: color };
}
