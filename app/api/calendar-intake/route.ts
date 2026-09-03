import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getJobs } from "@/lib/jobs";
import { jobTypeOptions } from "@/lib/types";
import { isGoogleCalendarConfigured, listGoogleCalendarEvents } from "@/lib/integrations/google-calendar";
import { calendarEventProposal, calendarProposalMissing, matchCalendarEvent } from "@/lib/calendar-intake";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!isGoogleCalendarConfigured()) return NextResponse.json({ configured: false, items: [] });

  try {
    const [events, jobs] = await Promise.all([listGoogleCalendarEvents(30), getJobs()]);
    const items = events.map((event) => {
      const proposal = calendarEventProposal(event, [...jobTypeOptions]);
      return { ...event, matchedJobId: matchCalendarEvent(event, jobs), proposal, missing: calendarProposalMissing(proposal) };
    });
    return NextResponse.json({ configured: true, items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Calendar intake could not be loaded." }, { status: 502 });
  }
}
