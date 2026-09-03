import type { AIWorkOrderImport, Job } from "@/lib/types";

export type CalendarIntakeEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  startTime: string;
  htmlLink?: string;
  rtsJobId?: string;
};

export type CalendarIntakeItem = CalendarIntakeEvent & {
  matchedJobId?: string;
  proposal: AIWorkOrderImport;
  missing: string[];
};

function clean(value?: string | null) {
  return (value || "").trim();
}

function cityFromLocation(location: string) {
  const parts = clean(location).split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return "";
  return parts[parts.length - 2] || "";
}

function likelyJobType(title: string, jobTypes: string[]) {
  const normalized = title.toLowerCase();
  return jobTypes.find((type) => normalized.includes(type.toLowerCase())) || "";
}

export function calendarEventProposal(event: CalendarIntakeEvent, jobTypes: string[]): AIWorkOrderImport {
  const location = clean(event.location);
  return {
    customerName: clean(event.title),
    phone: "",
    address: location,
    city: cityFromLocation(location),
    jobType: likelyJobType(event.title, jobTypes),
    scopeNotes: clean(event.description),
    factoryWorkOrderNumber: "",
    serialUnitNumber: "",
    dueDate: clean(event.startDate),
    scheduledTime: clean(event.startTime),
    returnVisitRequired: false,
    partsNeeded: "",
    homeSize: "",
  };
}

export function calendarProposalMissing(proposal: AIWorkOrderImport) {
  const checks: Array<[string, string | undefined]> = [
    ["Job type", proposal.jobType],
    ["Customer / job name", proposal.customerName],
    ["Address", proposal.address],
    ["City", proposal.city],
    ["Work description", proposal.scopeNotes],
  ];
  return checks.filter(([, value]) => !clean(value)).map(([label]) => label);
}

export function matchCalendarEvent(event: CalendarIntakeEvent, jobs: Job[]) {
  if (event.rtsJobId) {
    const exact = jobs.find((job) => job.jobId === event.rtsJobId);
    if (exact) return exact.jobId;
  }
  const byEventId = jobs.find((job) => job.googleCalendarEventId === event.id);
  if (byEventId) return byEventId.jobId;
  return undefined;
}
