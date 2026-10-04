import type { Job } from "./types";

const statusColors: Record<Job["status"], string> = {
  New: "#2563eb", Scheduled: "#7c3aed", "In Progress": "#0f766e", "Waiting on Parts": "#b45309",
  "Needs Inspection": "#0e7490", Complete: "#15803d", Billed: "#475569", Paid: "#4d7c0f",
};

export function calendarJobStyle(job: Job) {
  const color = statusColors[job.status];
  return job.schedulePlan === "Tentative"
    ? { backgroundColor: color, backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.16) 0 4px, transparent 4px 8px)" }
    : { backgroundColor: color };
}
