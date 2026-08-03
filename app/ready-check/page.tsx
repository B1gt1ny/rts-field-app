import { ReadyCheckView } from "@/components/ReadyCheckView";
import { getJobs } from "@/lib/jobs";
import { requireServerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function ReadyCheckPage() {
  await requireServerRole(["Admin", "Manager"]);
  const jobs = await getJobs();
  return <ReadyCheckView jobs={jobs} />;
}
