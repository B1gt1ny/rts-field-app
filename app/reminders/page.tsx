import { RemindersView } from "@/components/RemindersView";
import { getJobs } from "@/lib/jobs";
import { requireServerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  await requireServerRole(["Admin", "Manager"]);
  return <RemindersView jobs={await getJobs()} />;
}
