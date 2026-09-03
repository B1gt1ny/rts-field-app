import type { Job } from "@/lib/types";
import type { CalendarIntakeEvent } from "@/lib/calendar-intake";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

async function accessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!response.ok) throw new Error("Unable to authorize Google Calendar");
  return ((await response.json()) as { access_token: string }).access_token;
}

export function isGoogleCalendarConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

export async function listGoogleCalendarEvents(days = 30): Promise<CalendarIntakeEvent[]> {
  const token = await accessToken();
  if (!token) throw new Error("Google Calendar is not connected.");
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || "primary");
  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(timeMin.getTime() + days * 86400000);
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const response = await fetch(`${CALENDAR_API}/calendars/${calendarId}/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google Calendar intake failed.");
  const data = await response.json() as { items?: Array<{
    id?: string;
    summary?: string;
    description?: string;
    location?: string;
    htmlLink?: string;
    status?: string;
    start?: { date?: string; dateTime?: string };
    extendedProperties?: { private?: { rtsJobId?: string } };
  }> };
  return (data.items || []).filter((event) => event.id && event.status !== "cancelled").map((event) => {
    const dateTime = event.start?.dateTime || "";
    return {
      id: event.id || "",
      title: event.summary || "Untitled calendar event",
      description: event.description || "",
      location: event.location || "",
      startDate: event.start?.date || dateTime.slice(0, 10),
      startTime: event.start?.date ? "" : dateTime.slice(11, 16),
      htmlLink: event.htmlLink,
      rtsJobId: event.extendedProperties?.private?.rtsJobId,
    };
  });
}

function calendarTiming(job: Job) {
  if (!job.scheduledTime) {
    return {
      start: { date: job.dueDate },
      end: { date: new Date(new Date(`${job.dueDate}T12:00:00`).getTime() + 86400000).toISOString().slice(0, 10) },
    };
  }

  const [year, month, day] = job.dueDate.split("-").map(Number);
  const [hour, minute] = job.scheduledTime.split(":").map(Number);
  const end = new Date(Date.UTC(year, month - 1, day, hour + 1, minute));
  // No business timezone is configured yet, so use a deterministic UTC default.
  return {
    start: { dateTime: `${job.dueDate}T${job.scheduledTime}:00`, timeZone: "UTC" },
    end: { dateTime: `${end.toISOString().slice(0, 10)}T${end.toISOString().slice(11, 19)}`, timeZone: "UTC" },
  };
}

export async function syncGoogleCalendarEvent(job: Job): Promise<Job> {
  // Calendar sync is always explicit. Imported, shared, and mock jobs remain off.
  if (!job.syncToCalendar) return job;
  const token = await accessToken();
  if (!token) throw new Error("Google Calendar is not connected.");
  if (!job.dueDate) throw new Error("Google Calendar sync needs a due date.");
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || "primary");
  const location = [job.address, job.city].filter(Boolean).join(", ");
  const body = {
    summary: `${job.jobId} — ${job.customerName} — ${job.jobType}`,
    location,
    description: [`Status: ${job.status}`, `Employees: ${job.assignedCrew}`, `Priority: ${job.priority}`, "", job.scopeNotes].join("\n"),
    ...calendarTiming(job),
    extendedProperties: { private: { rtsJobId: job.jobId } },
  };
  const eventUrl = job.googleCalendarEventId
    ? `${CALENDAR_API}/calendars/${calendarId}/events/${job.googleCalendarEventId}`
    : `${CALENDAR_API}/calendars/${calendarId}/events`;
  const response = await fetch(eventUrl, {
    method: job.googleCalendarEventId ? "PUT" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Google Calendar sync failed.");
  const event = await response.json() as { id: string; htmlLink?: string };
  return { ...job, googleCalendarEventId: event.id, googleCalendarEventUrl: event.htmlLink };
}
