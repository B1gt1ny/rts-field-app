import { ReportsView } from "@/components/ReportsView";
import { getJobs } from "@/lib/jobs";
import { requireServerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireServerRole(["Admin", "Manager"]);
  return <ReportsView jobs={await getJobs()} />;
}
