import { TasksView } from "@/components/TasksView";
import { getJobs } from "@/lib/jobs";
import { requireServerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  await requireServerRole(["Admin", "Manager"]);
  return <TasksView jobs={await getJobs()} />;
}
