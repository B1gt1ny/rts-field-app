import crypto from "crypto";
import type { Job } from "@/lib/types";

const businessTimeZone = "America/Chicago";

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function foldLine(value: string) {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += 70) chunks.push(`${index ? " " : ""}${value.slice(index, index + 70)}`);
  return chunks.join("\r\n");
}

function dateOnlyEnd(date: string) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10).replace(/-/g, "");
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function eventForJob(job: Job) {
  if (!job.dueDate || !job.jobId) return null;
  const description = [
    `Customer: ${job.customerName}`,
    job.manufacturer && `Dealer/Factory: ${job.manufacturer}`,
    `RTS Job #: ${job.jobId}`,
    job.assignedCrew && `Crew: ${job.assignedCrew}`,
    job.scopeNotes && `Scope: ${job.scopeNotes}`,
    job.phone && `Phone: ${job.phone}`,
  ].filter(Boolean).join("\n");
  return [
    "BEGIN:VEVENT",
    `UID:job-${escapeText(job.jobId)}@rts-field-app`,
    `DTSTAMP:${timestamp()}`,
    job.scheduledTime ? `DTSTART;TZID=${businessTimeZone}:${job.dueDate.replace(/-/g, "")}T${job.scheduledTime.replace(":", "")}00` : `DTSTART;VALUE=DATE:${job.dueDate.replace(/-/g, "")}`,
    !job.scheduledTime && `DTEND;VALUE=DATE:${dateOnlyEnd(job.dueDate)}`,
    `SUMMARY:${escapeText([job.customerName, job.jobType].filter(Boolean).join(" — ") || job.jobId)}`,
    description && `DESCRIPTION:${escapeText(description)}`,
    [job.address, job.city].filter(Boolean).join(", ") && `LOCATION:${escapeText([job.address, job.city].filter(Boolean).join(", "))}`,
    `STATUS:${job.schedulePlan === "Tentative" ? "TENTATIVE" : "CONFIRMED"}`,
    "END:VEVENT",
  ].filter(Boolean).join("\r\n");
}

export function createCalendarFeed(jobs: Job[]) {
  const eventLines = jobs.map(eventForJob).filter(Boolean).flatMap((event) => (event as string).split("\r\n"));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RTS Field App//Schedule//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-TIMEZONE:${businessTimeZone}`, ...eventLines, "END:VCALENDAR", ""].map(foldLine).join("\r\n");
}

export function createCalendarFeedToken() {
  return crypto.randomBytes(32).toString("base64url");
}
