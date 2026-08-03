import { NextResponse } from "next/server";
import { getRequestUser, getUserEmployee, getUserRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: getUserRole(user),
      ...getUserEmployee(user),
    },
  });
}
