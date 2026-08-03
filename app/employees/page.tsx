import { EmployeesManager } from "@/components/EmployeesManager";
import { RoleGuard } from "@/components/RoleGuard";

export default function EmployeesPage() {
  return <RoleGuard allowed={["Admin", "Manager"]}><EmployeesManager /></RoleGuard>;
}
