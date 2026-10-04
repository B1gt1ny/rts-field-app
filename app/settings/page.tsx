import { SettingsPanel } from "@/components/SettingsPanel";
import { RoleGuard } from "@/components/RoleGuard";
import { requireServerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireServerRole(["Admin"]);
  return <RoleGuard allowed={["Admin"]}><SettingsPanel /></RoleGuard>;
}
