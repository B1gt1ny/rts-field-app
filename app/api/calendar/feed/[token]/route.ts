import crypto from "crypto";
import { NextResponse } from "next/server";
import { getJobs } from "@/lib/jobs";
import { getBusinessSettings, saveBusinessSettings } from "@/lib/settings";
import { createCalendarFeed, createCalendarFeedToken } from "@/lib/integrations/ics-calendar";

export const dynamic = "force-dynamic";

function matchesToken(actual: string | undefined, supplied: string) {
  if (!actual || actual.length !== supplied.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(supplied));
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: filename } = await params;
  const token = filename.replace(/\.ics$/, "");
  const settings = await getBusinessSettings();
  let feedToken = settings.calendarFeedToken;
  if (!feedToken) {
    feedToken = createCalendarFeedToken();
    await saveBusinessSettings({ ...settings, calendarFeedToken: feedToken });
  }
  if (!matchesToken(feedToken, token)) return new NextResponse("Not found", { status: 404 });
  const jobs = (await getJobs()).filter((job) => Boolean(job.dueDate)).map((job) => ({
    ...job,
    phone: "",
    factoryWorkOrderNumber: "",
    serialUnitNumber: "",
  }));
  return new NextResponse(createCalendarFeed(jobs), { status: 200, headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
}
