import { CommunicationCenterView } from "@/components/CommunicationCenterView";
import { getJobs } from "@/lib/jobs";
import { requireServerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function CommunicationPage() {
  await requireServerRole(["Admin", "Manager"]);
  return <CommunicationCenterView jobs={await getJobs()} />;
}
