import type { Job, TimeEntry } from "./types";

export const closedJobStatuses = ["Complete", "Billed", "Paid"];

export function isUnassigned(job: Job) {
  return !job.fullCrew && !job.assignedEmployeeIds?.length && (!job.assignedCrew || job.assignedCrew === "Unassigned");
}

export type RecordedFieldSession = {
  start: TimeEntry;
  end: TimeEntry;
  minutes: number;
  employeeName?: string;
};

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

export function recordedWorkSessions(entries: TimeEntry[]) {
  return recordedSessions(entries, (entry) => entry.type === "Work started", (entry) => entry.type === "Departed");
}

export function recordedTravelSessions(entries: TimeEntry[]) {
  return recordedSessions(entries, isTravelStarted, (entry) => entry.type === "Arrived");
}

export function sameEmployee(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function recordedSessions(entries: TimeEntry[], isStart: (entry: TimeEntry) => boolean, isEnd: (entry: TimeEntry) => boolean): RecordedFieldSession[] {
  const sessions: RecordedFieldSession[] = [];
  let start: TimeEntry | undefined;
  for (const entry of [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (isStart(entry)) start = entry;
    if (isEnd(entry) && start) {
      const startAt = Date.parse(start.createdAt);
      const endAt = Date.parse(entry.createdAt);
      if (Number.isFinite(startAt) && Number.isFinite(endAt) && endAt >= startAt) {
        const startEmployee = start.employeeName?.trim();
        const endEmployee = entry.employeeName?.trim();
        sessions.push({ start, end: entry, minutes: Math.round((endAt - startAt) / 60_000), employeeName: startEmployee && endEmployee && sameEmployee(startEmployee, endEmployee) ? startEmployee : undefined });
      }
      start = undefined;
    }
  }
  return sessions;
}

function hasTodayActivity(job: Job, today: string) {
  return (job.activityLog || []).some((entry) => entry.createdAt?.slice(0, 10) === today);
}
