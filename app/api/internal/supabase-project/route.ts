import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) return new Response(null, { status: 503 });
  try {
    const url = new URL(value);
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
    if (!match || url.protocol !== "https:") return new Response(null, { status: 503 });
    return new NextResponse(match[1], { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 503 });
  }
}
