import { ScheduleBoard } from "@/components/ScheduleBoard";
import { getJobs } from "@/lib/jobs";
import { filterServerJobsForUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  return <ScheduleBoard jobs={await filterServerJobsForUser(await getJobs())} />;
}
