import { CommandCenterView } from "@/components/CommandCenterView";
import { getJobs } from "@/lib/jobs";
import { requireServerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function CommandPage() {
  await requireServerRole(["Admin", "Manager"]);
  return <CommandCenterView jobs={await getJobs()} />;
}
