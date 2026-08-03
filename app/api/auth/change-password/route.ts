import { NextResponse } from "next/server";
import { authClient, getRequestUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const db = authClient();
  if (!db) return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const input = await request.json() as { password?: string };
  const password = input.password || "";
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const { error } = await db.auth.admin.updateUserById(user.id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: true });
}
