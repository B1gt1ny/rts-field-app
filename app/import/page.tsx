import { WorkOrderImport } from "@/components/WorkOrderImport";
import { RoleGuard } from "@/components/RoleGuard";

export default function ImportPage() {
  return <RoleGuard allowed={["Admin", "Manager"]}><WorkOrderImport /></RoleGuard>;
}
