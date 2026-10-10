import { NextResponse } from "next/server";
import { requireRole, sanitizeEmployeeFactoryCost } from "@/lib/auth";
import { getBusinessSettings, saveBusinessSettings, SettingsValidationError, validateSettingsPatch } from "@/lib/settings";
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
  const safeSettings = access.role === "Admin" ? settings : clientSettings(settings);
  return NextResponse.json(access.role === "Employee" ? { ...safeSettings, factoryCostDefaults: sanitizeEmployeeFactoryCost(settings.factoryCostDefaults) } : safeSettings);
}

export async function PUT(request: Request) {
  const access = await requireRole(request, ["Admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  let input: Partial<BusinessSettings>;
  try { input = validateSettingsPatch(await request.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof SettingsValidationError ? error.message : "Settings must contain valid JSON." }, { status: 400 }); }
  if (input.calendarFeedToken === "") input.calendarFeedToken = createCalendarFeedToken();
  try { return NextResponse.json(await saveBusinessSettings(input)); }
  catch { return NextResponse.json({ error: "Settings could not be saved. Try again later." }, { status: 503 }); }
}
