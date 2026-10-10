import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getBusinessSettings, saveBusinessSettings } from "@/lib/settings";
import { validateDropdownOption } from "@/lib/dropdown-options";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const settings = await getBusinessSettings("rts", true);
    return NextResponse.json(settings.dropdownOptions || {});
  } catch { return NextResponse.json({ error: "Dropdown choices could not be loaded." }, { status: 503 }); }
}

export async function POST(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  let addition: ReturnType<typeof validateDropdownOption>;
  try {
    const input = await request.json();
    addition = validateDropdownOption(input?.key, input?.option);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid dropdown choice." }, { status: 400 }); }
  try {
    // An append-only patch cannot change company settings or access permissions.
    const settings = await saveBusinessSettings({ dropdownOptions: { [addition.key]: [addition.option] } });
    return NextResponse.json(settings.dropdownOptions || {});
  } catch { return NextResponse.json({ error: "The choice could not be saved. Please retry." }, { status: 503 }); }
}
