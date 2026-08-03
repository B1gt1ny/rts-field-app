import { CustomersView } from "@/components/CustomersView";
import { getJobs } from "@/lib/jobs";
import { filterServerJobsForUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  return <CustomersView jobs={await filterServerJobsForUser(await getJobs())} />;
}
