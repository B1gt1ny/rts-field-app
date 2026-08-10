import type { Job, TimeEntry } from "./types";

export const closedJobStatuses = ["Complete", "Billed", "Paid"];

export type TodayFieldStatus = "Upcoming" | "Traveling" | "Arrived" | "Working" | "Finished" | "Ready for Review";

export function entriesForDate(job: Job, today: string) {
  return (job.timeEntries || []).filter((entry) => entry.createdAt?.slice(0, 10) === today);
}

export function isTodayJob(job: Job, today: string) {
  return job.dueDate === today || entriesForDate(job, today).length > 0 || hasTodayActivity(job, today);
}

export function todayFieldStatus(job: Job, employeeName: string, today: string): TodayFieldStatus {
  if (job.status === "Needs Inspection") return "Ready for Review";
  const entries = entriesForDate(job, today).filter((entry) => sameEmployee(entry.employeeName, employeeName));
  if (entries.some((entry) => entry.type === "Departed")) return "Finished";
  if (entries.some((entry) => entry.type === "Work started")) return "Working";
  if (entries.some((entry) => entry.type === "Arrived")) return "Arrived";
  if (entries.some(isTravelStarted)) return "Traveling";
  return closedJobStatuses.includes(job.status) ? "Finished" : "Upcoming";
}

export function isTravelStarted(entry: TimeEntry) {
  return entry.notes === "Started Travel";
}

export function sameEmployee(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function hasTodayActivity(job: Job, today: string) {
  return (job.activityLog || []).some((entry) => entry.createdAt?.slice(0, 10) === today);
}
