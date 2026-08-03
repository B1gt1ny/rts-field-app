"use client";

import { useEffect, useMemo, useState } from "react";
import { createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRightOnRectangleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import type { AuthUser } from "@/lib/client-auth";

const publicPaths = ["/login"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const authRequired = useMemo(() => !publicPaths.some((path) => pathname.startsWith(path)), [pathname]);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" }).then(async (response) => {
      if (!response.ok) {
        if (authRequired) router.replace("/login");
        setLoading(false);
        return;
      }
      const data = await response.json();
      if (!data.user && authRequired) {
        router.replace("/login");
        return;
      }
      if (data.user) {
        setUser(data.user);
        if (pathname === "/login") router.replace(data.user.role === "Employee" ? "/field" : "/");
      }
      setLoading(false);
    }).catch(() => {
      if (authRequired) router.replace("/login");
      setLoading(false);
    });
  }, [authRequired, pathname, router]);

  if (pathname === "/login") return <>{children}</>;
  if (loading) return <div className="grid min-h-screen place-items-center bg-sand p-6"><p className="font-black text-black/45">Checking access…</p></div>;
  if (authRequired && !user) return null;

  return <AuthContext.Provider value={user}>
    {children}
  </AuthContext.Provider>;
}

const AuthContext = createContext<AuthUser | null>(null);

export function useAuthUser() {
  return useContext(AuthContext);
}

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/login");
  }
  return <button type="button" onClick={logout} className="btn-secondary !min-h-10 !px-3 !py-2"><ArrowRightOnRectangleIcon className="size-5" /><span className="hidden sm:inline">Logout</span></button>;
}

export function RoleBadge() {
  const user = useAuthUser();
  if (!user) return null;
  return <span className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-black text-forest sm:inline-flex"><ShieldCheckIcon className="size-4" />{user.role}</span>;
}
