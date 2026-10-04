import { EmployeesManager } from "@/components/EmployeesManager";
import { RoleGuard } from "@/components/RoleGuard";
import { requireServerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  await requireServerRole(["Admin", "Manager"]);
  return <RoleGuard allowed={["Admin", "Manager"]}><EmployeesManager /></RoleGuard>;
}
