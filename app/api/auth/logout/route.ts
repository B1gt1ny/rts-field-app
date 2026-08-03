import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("cc-access-token", "", { path: "/", maxAge: 0 });
  response.cookies.set("cc-refresh-token", "", { path: "/", maxAge: 0 });
  return response;
}
