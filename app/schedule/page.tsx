import { ScheduleBoard } from "@/components/ScheduleBoard";
import { getJobs } from "@/lib/jobs";
import { filterServerJobsForUser, requireServerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const access = await requireServerRole(["Admin", "Manager", "Employee"]);
  return <ScheduleBoard jobs={await filterServerJobsForUser(await getJobs())} canEditSchedule={access.role !== "Employee"} />;
}
