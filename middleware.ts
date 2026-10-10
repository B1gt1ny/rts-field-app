import { NextRequest, NextResponse } from "next/server";
import { authClient, hasTrustedAccess } from "./lib/auth";

const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };

// Renew before both server components and route handlers read the cookie. Their
// existing getUser/role/assignment checks remain the authorization boundary.
export async function middleware(request: NextRequest) {
  if (request.headers.has("authorization") || ["/api/auth/login", "/api/auth/logout"].includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const access = request.cookies.get("cc-access-token")?.value;
  const refresh = request.cookies.get("cc-refresh-token")?.value;
  if (!refresh) return NextResponse.next();
  const db = authClient();
  if (!db) return NextResponse.next();

  if (access) {
    const { error } = await db.auth.getUser(access);
    if (!error) return NextResponse.next(); // Including inactive users: downstream denies them.
    // An outage must not consume a refresh token or remove an existing session.
    if (error.status !== 401 && error.status !== 403 && !(error.status === 400 && error.code === "bad_jwt")) return NextResponse.next();
  }

  const { data, error } = await db.auth.refreshSession({ refresh_token: refresh });
  if (error || !data.session || !hasTrustedAccess(data.user)) {
    // Fail closed without destroying cookies on a network/provider outage.
    if (error && (!error.status || error.status >= 500 || error.status === 429)) return NextResponse.next();
    request.cookies.delete("cc-access-token");
    request.cookies.delete("cc-refresh-token");
    const response = NextResponse.next({ request: { headers: request.headers } });
    response.cookies.set("cc-access-token", "", { ...cookieOptions, maxAge: 0 });
    response.cookies.set("cc-refresh-token", "", { ...cookieOptions, maxAge: 0 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  request.cookies.set("cc-access-token", data.session.access_token);
  request.cookies.set("cc-refresh-token", data.session.refresh_token);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set("cc-access-token", data.session.access_token, { ...cookieOptions, maxAge: data.session.expires_in || 60 * 60 });
  response.cookies.set("cc-refresh-token", data.session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
  // Avoid caching a response that rotates an individual session.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)"],
};
