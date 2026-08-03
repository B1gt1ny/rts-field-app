import { BillingView } from "@/components/BillingView";
import { RoleGuard } from "@/components/RoleGuard";

export default function BillingPage() {
  return <RoleGuard allowed={["Admin", "Manager"]}><BillingView /></RoleGuard>;
}
