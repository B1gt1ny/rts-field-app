import { DispatchHandoffView } from "@/components/DispatchHandoffView";
import { getEmployees } from "@/lib/employees";
import { getJobs } from "@/lib/jobs";
import { requireServerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function DispatchPage({ searchParams }: { searchParams: Promise<{ job?: string; from?: string }> }) {
  await requireServerRole(["Admin", "Manager"]);
  const [{ job, from }, jobs, employees] = await Promise.all([searchParams, getJobs(), getEmployees()]);
  return <DispatchHandoffView jobs={jobs} employees={employees} focusJobId={from === "calendar" ? job : undefined} />;
}
