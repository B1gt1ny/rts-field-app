import { NextResponse } from "next/server";
import { authClient, splitEmails } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const db = authClient();
  if (!db) return NextResponse.json({ error: "Supabase server auth is not configured." }, { status: 503 });
  const { email, password, setupCode } = await request.json() as { email?: string; password?: string; setupCode?: string };
  const allowedAdmins = splitEmails(process.env.ADMIN_EMAILS || "b1g_t1ny@yahoo.com");
  const normalizedEmail = email?.trim().toLowerCase() || "";
  if (!allowedAdmins.includes(normalizedEmail)) return NextResponse.json({ error: "Email is not listed as an admin." }, { status: 403 });
  if (process.env.AUTH_SETUP_CODE && setupCode !== process.env.AUTH_SETUP_CODE) return NextResponse.json({ error: "Valid setup code is required." }, { status: 403 });
  if (!password || password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const existing = await db.auth.admin.listUsers();
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
  const current = existing.data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
  const setupCodeRequired = Boolean(process.env.AUTH_SETUP_CODE);
  if (current && !setupCodeRequired) {
    return NextResponse.json({ error: "Admin bootstrap is already complete. Set AUTH_SETUP_CODE to enable deliberate password resets." }, { status: 409 });
  }
  if (current) {
    const updated = await db.auth.admin.updateUserById(current.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(current.user_metadata || {}), role: "Admin" },
    });
    if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 });
    return NextResponse.json({ id: current.id, email: current.email, role: "Admin", updated: true });
  }

  const created = await db.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { role: "Admin" },
  });
  if (created.error || !created.data.user) return NextResponse.json({ error: created.error?.message || "Admin user could not be created." }, { status: 500 });
  return NextResponse.json({ id: created.data.user.id, email: created.data.user.email, role: "Admin", created: true }, { status: 201 });
}
