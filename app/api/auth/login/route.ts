import { NextResponse } from "next/server";
import { authClient, getUserRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const db = authClient();
  if (!db) return NextResponse.json({ error: "Supabase server auth is not configured." }, { status: 503 });
  const { email, password } = await request.json() as { email?: string; password?: string };
  if (!email?.trim() || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

  const { data, error } = await db.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.session?.access_token || !data.user) {
    return NextResponse.json({ error: error?.message || "Login failed." }, { status: 401 });
  }

  const response = NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      role: getUserRole(data.user),
    },
  });
  response.cookies.set("cc-access-token", data.session.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: data.session.expires_in || 60 * 60,
  });
  response.cookies.set("cc-refresh-token", data.session.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
