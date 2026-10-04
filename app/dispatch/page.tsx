import { DispatchHandoffView } from "@/components/DispatchHandoffView";
import { getEmployees } from "@/lib/employees";
import { getJobs } from "@/lib/jobs";
import { requireServerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  await requireServerRole(["Admin", "Manager"]);
  const [jobs, employees] = await Promise.all([getJobs(), getEmployees()]);
  return <DispatchHandoffView jobs={jobs} employees={employees} />;
}
