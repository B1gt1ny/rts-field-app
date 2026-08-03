import { TodayCommandView } from "@/components/TodayCommandView";
import { getJobs } from "@/lib/jobs";
import { filterServerJobsForUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function TodayCommandPage() {
  return <TodayCommandView jobs={await filterServerJobsForUser(await getJobs())} />;
}
