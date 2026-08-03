import { DocumentsHubView } from "@/components/DocumentsHubView";
import { getJobs } from "@/lib/jobs";
import { filterServerJobsForUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  return <DocumentsHubView jobs={await filterServerJobsForUser(await getJobs())} />;
}
