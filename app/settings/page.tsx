import { SettingsPanel } from "@/components/SettingsPanel";
import { RoleGuard } from "@/components/RoleGuard";

export default function SettingsPage() {
  return <RoleGuard allowed={["Admin"]}><SettingsPanel /></RoleGuard>;
}
