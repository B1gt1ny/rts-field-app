import type { Job, TimeEntry, TravelLeg } from "./types";

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

export function getWorkSession(job: Job) {
  const session = currentFieldSession(job.timeEntries || [], (entry) => entry.type === "Work started", (entry) => entry.type === "Departed");
  return { started: session.started, finished: session.end, active: session.active };
}

export function getTravelState(job: Job) {
  const session = currentFieldSession(job.timeEntries || [], isTravelStarted, (entry) => entry.type === "Arrived");
  return { started: session.started, arrived: session.end, active: session.active };
}

export function recordedWorkSessions(entries: TimeEntry[]) {
  return recordedSessions(entries, (entry) => entry.type === "Work started", (entry) => entry.type === "Departed");
}

export function recordedTravelSessions(entries: TimeEntry[]) {
  return recordedSessions(entries, isTravelStarted, (entry) => entry.type === "Arrived");
}

export function structuredTravelTotals(job: Job) {
  const legs = structuredTravelLegs(job);
  if (!legs.length) return undefined;
  let miles = 0;
  let driveMinutes = 0;
  let driveTimeRecorded = false;
  for (const leg of legs) {
    const legMiles = Number(leg.miles);
    if (Number.isFinite(legMiles) && legMiles >= 0) miles += legMiles;
    if (leg.departureAt && leg.arrivalAt) {
      const duration = Date.parse(leg.arrivalAt) - Date.parse(leg.departureAt);
      if (Number.isFinite(duration) && duration >= 0) {
        driveMinutes += Math.round(duration / 60000);
        driveTimeRecorded = true;
      }
    }
  }
  return { miles, driveMinutes, driveTimeRecorded };
}

export function structuredTravelLegs(job: Job) {
  return (job.travelLegs || []).filter(isUsableStructuredTravelLeg);
}

export function isUsableStructuredTravelLeg(leg: TravelLeg) {
  return Boolean(leg.id?.trim() && isValidTravelDate(leg.date) && leg.from?.trim() && leg.to?.trim() && leg.employeeName?.trim() && Number.isFinite(Number(leg.miles)) && Number(leg.miles) >= 0 && hasValidOptionalTimestamp(leg.departureAt) && hasValidOptionalTimestamp(leg.arrivalAt));
}

export function hasStructuredTravelArrival(job: Job) {
  return structuredTravelLegs(job).some((leg) => {
    const arrival = Date.parse(leg.arrivalAt || "");
    const departure = leg.departureAt ? Date.parse(leg.departureAt) : undefined;
    return Number.isFinite(arrival) && (departure === undefined || (Number.isFinite(departure) && arrival >= departure));
  });
}

function isValidTravelDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function hasValidOptionalTimestamp(value?: string) {
  return !value || Number.isFinite(Date.parse(value));
}

export function sameEmployee(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function currentFieldSession(entries: TimeEntry[], isStart: (entry: TimeEntry) => boolean, isEnd: (entry: TimeEntry) => boolean) {
  const ordered = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const started = ordered.find(isStart);
  const end = ordered.find(isEnd);
  return {
    started,
    end,
    active: Boolean(started && (!end || started.createdAt > end.createdAt)),
  };
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
