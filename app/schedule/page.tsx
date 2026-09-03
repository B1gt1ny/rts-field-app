import { CalendarIntake } from "@/components/CalendarIntake";
import { ScheduleBoard } from "@/components/ScheduleBoard";
import { getJobs } from "@/lib/jobs";
import { filterServerJobsForUser, requireServerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const access = await requireServerRole(["Admin", "Manager", "Employee"]);
  const canEditSchedule = access.role !== "Employee";
  return <div className="space-y-5">
    {canEditSchedule && <CalendarIntake />}
    <ScheduleBoard jobs={await filterServerJobsForUser(await getJobs())} canEditSchedule={canEditSchedule} />
  </div>;
}
