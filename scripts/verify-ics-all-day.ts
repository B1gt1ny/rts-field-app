import { createCalendarFeed } from "../lib/integrations/ics-calendar";
import { emptyJob } from "../lib/types";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function eventFor(feed: string, jobId: string) {
  return feed.split("BEGIN:VEVENT\r\n").find((event) => event.includes(`UID:job-${jobId}@rts-field-app`));
}

function uidCount(feed: string) {
  return [...feed.matchAll(/^UID:/gm)].length;
}

const morning = { ...emptyJob, jobId: "AM-1", customerName: "Morning", dueDate: "2026-09-22", scheduledTime: "08:00" };
const afternoon = { ...emptyJob, jobId: "PM-1", customerName: "Afternoon", dueDate: "2026-09-22", scheduledTime: "15:30" };
const morningEvent = eventFor(createCalendarFeed([morning]), morning.jobId);
const afternoonEvent = eventFor(createCalendarFeed([afternoon]), afternoon.jobId);

assert(morningEvent?.includes("DTSTART;VALUE=DATE:20260922\r\nDTEND;VALUE=DATE:20260923"), "8:00 AM job should render as an all-day event on its scheduled date");
assert(afternoonEvent?.includes("DTSTART;VALUE=DATE:20260922\r\nDTEND;VALUE=DATE:20260923"), "3:30 PM job should render as an all-day event on its scheduled date");
assert(!morningEvent?.includes("DTSTART;TZID="), "Scheduled time must not produce a timed DTSTART");

const changedDate = { ...morning, dueDate: "2026-09-24" };
const changedTime = { ...morning, scheduledTime: "17:45" };
const movedEvent = eventFor(createCalendarFeed([changedDate]), morning.jobId);
const timeEditedEvent = eventFor(createCalendarFeed([changedTime]), morning.jobId);
assert(movedEvent?.includes("UID:job-AM-1@rts-field-app") && movedEvent.includes("DTSTART;VALUE=DATE:20260924"), "Changing the RTS date should move the existing job UID");
assert(timeEditedEvent?.includes("UID:job-AM-1@rts-field-app") && timeEditedEvent.includes("DTSTART;VALUE=DATE:20260922"), "Changing only RTS time should preserve the date and job UID");

const sameDayFeed = createCalendarFeed([morning, afternoon]);
assert(uidCount(sameDayFeed) === 2, "Two jobs on one date should remain two events");
assert(new Set([...sameDayFeed.matchAll(/^UID:(.+)$/gm)].map((match) => match[1])).size === 2, "Each job should have a distinct UID");
assert(uidCount(createCalendarFeed([morning])) === 1, "Refreshing one job should not generate duplicate event UIDs");
assert(uidCount(createCalendarFeed([])) === 0, "Deleted or unscheduled jobs should be omitted from the next feed");
assert(uidCount(createCalendarFeed([{ ...morning, dueDate: "" }])) === 0, "Jobs without a scheduled date should be omitted");

console.log("All-day ICS behavior fixtures passed.");
