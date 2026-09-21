import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getBusinessSettings, saveBusinessSettings } from "@/lib/settings";
import type { BusinessSettings } from "@/lib/types";
import { createCalendarFeedToken } from "@/lib/integrations/ics-calendar";

export const dynamic = "force-dynamic";

function clientSettings(settings: BusinessSettings): Omit<BusinessSettings, "calendarFeedToken"> {
  const { calendarFeedToken: _calendarFeedToken, ...safeSettings } = settings;
  return safeSettings;
}

export async function GET(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager", "Employee"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const settings = await getBusinessSettings();
  if (access.role === "Admin" && !settings.calendarFeedToken) return NextResponse.json(await saveBusinessSettings({ ...settings, calendarFeedToken: createCalendarFeedToken() }));
  return NextResponse.json(access.role === "Admin" ? settings : clientSettings(settings));
}

export async function PUT(request: Request) {
  const access = await requireRole(request, ["Admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const input = await request.json() as Partial<BusinessSettings>;
  if (input.calendarFeedToken === "") input.calendarFeedToken = createCalendarFeedToken();
  return NextResponse.json(await saveBusinessSettings(input));
}
