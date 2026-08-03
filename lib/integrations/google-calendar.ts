import type { Job } from "@/lib/types";

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

export async function syncGoogleCalendarEvent(job: Job): Promise<Job> {
  // Calendar sync is always explicit. Imported, shared, and mock jobs remain off.
  if (!job.syncToCalendar) return job;
  const token = await accessToken();
  if (!token) throw new Error("Google Calendar is not connected. Add Google Calendar credentials in Vercel first.");
  if (!job.dueDate) throw new Error("Google Calendar sync needs a due date.");
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || "primary");
  const body = {
    summary: `${job.jobId} — ${job.customerName} — ${job.jobType}`,
    location: `${job.address}, ${job.city}, TX`,
    description: [`Status: ${job.status}`, `Employees: ${job.assignedCrew}`, `Priority: ${job.priority}`, "", job.scopeNotes].join("\n"),
    start: { date: job.dueDate },
    end: { date: new Date(new Date(`${job.dueDate}T12:00:00`).getTime() + 86400000).toISOString().slice(0, 10) },
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
  if (!response.ok) throw new Error(`Google Calendar sync failed (${response.status})`);
  const event = await response.json() as { id: string; htmlLink?: string };
  return { ...job, googleCalendarEventId: event.id, googleCalendarEventUrl: event.htmlLink };
}
