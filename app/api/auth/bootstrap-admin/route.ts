import { NextResponse } from "next/server";
import { authClient, splitEmails } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const db = authClient();
  if (!db) return NextResponse.json({ error: "Supabase server auth is not configured." }, { status: 503 });
  if (!process.env.AUTH_SETUP_CODE) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { email, password, setupCode } = await request.json() as { email?: string; password?: string; setupCode?: string };
  const allowedAdmins = [...new Set(splitEmails(process.env.ADMIN_EMAILS || "b1g_t1ny@yahoo.com"))];
  // Supabase's unique-email constraint serializes creation for this one identity.
  // An allow-list with multiple identities cannot safely claim first ownership.
  if (allowedAdmins.length !== 1) return NextResponse.json({ error: "Initial setup requires exactly one approved admin identity." }, { status: 409 });
  const normalizedEmail = email?.trim().toLowerCase() || "";
  if (!allowedAdmins.includes(normalizedEmail)) return NextResponse.json({ error: "Email is not listed as an admin." }, { status: 403 });
  if (setupCode !== process.env.AUTH_SETUP_CODE) return NextResponse.json({ error: "Valid setup code is required." }, { status: 403 });
  if (!password || password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  // Bootstrap is only for an unclaimed installation, never account recovery.
  for (let page = 1; ; page += 1) {
    const existing = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (existing.error) return NextResponse.json({ error: "Unable to verify initial setup." }, { status: 503 });
    if (existing.data.users.some((user) => user.app_metadata?.rtsRole === "Admin" || user.email?.toLowerCase() === normalizedEmail)) {
      return NextResponse.json({ error: "Initial admin setup is closed. Use the existing account recovery process." }, { status: 409 });
    }
    if (existing.data.users.length < 1000) break;
  }

  const created = await db.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    app_metadata: { rtsRole: "Admin", rtsAccessActive: true },
  });
  if (created.error || !created.data.user) return NextResponse.json({ error: created.error?.message || "Admin user could not be created." }, { status: 500 });
  return NextResponse.json({ id: created.data.user.id, email: created.data.user.email, role: "Admin", created: true }, { status: 201 });
}
