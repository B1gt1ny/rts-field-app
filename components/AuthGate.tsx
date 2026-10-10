"use client";

import { useEffect, useMemo, useState } from "react";
import { createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRightOnRectangleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { roleHomePath, type AuthUser } from "@/lib/client-auth";

import { clearOwnerUploads, invalidateOwnerUploads } from "@/lib/client-uploads";
import { clearBrowserDrafts } from "@/lib/client-drafts";
import { isPublicInformationPath } from "@/lib/public-pages";

const publicPaths = ["/login"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const publicInformation = isPublicInformationPath(pathname);
  const authRequired = useMemo(() => !isPublicInformationPath(pathname) && !publicPaths.some((path) => pathname.startsWith(path)), [pathname]);

  useEffect(() => {
    if (publicInformation) { setLoading(false); return; }
    fetch("/api/auth/me", { credentials: "include" }).then(async (response) => {
      if (!response.ok) {
        setUser(null);
        if (authRequired) router.replace("/login");
        setLoading(false);
        return;
      }
      const data = await response.json();
      if (!data.user && authRequired) {
        setUser(null);
        router.replace("/login");
        return;
      }
      if (data.user) {
        if (window.localStorage.getItem(`rts-upload-cleanup:${data.user.id}`)) {
          setUser(null);
          try { await clearOwnerUploads(data.user.id); } catch { window.alert("Local photo cleanup is incomplete. Keep this device private and retry signing in."); setLoading(false); return; }
        }
        setUser(data.user);
        if (pathname === "/login") router.replace(roleHomePath(data.user.role));
      }
      setLoading(false);
    }).catch(() => {
      if (authRequired) router.replace("/login");
      setLoading(false);
    });
  }, [authRequired, pathname, publicInformation, router]);

  if (pathname === "/login" || publicInformation) return <>{children}</>;
  if (loading) return <div className="grid min-h-screen place-items-center bg-sand p-6"><div role="status" className="card flex items-center gap-3 p-5"><ShieldCheckIcon className="size-6 text-accent" /><p className="font-semibold text-content/75">Checking access…</p></div></div>;
  if (authRequired && !user) return null;

  return <AuthContext.Provider key={user?.id} value={user}>
    {children}
  </AuthContext.Provider>;
}

const AuthContext = createContext<AuthUser | null>(null);

export function useAuthUser() {
  return useContext(AuthContext);
}

export function LogoutButton() {
  const user = useAuthUser();
  async function logout() {
    try { if (user?.id) window.localStorage.setItem(`rts-upload-cleanup:${user.id}`, "pending"); } catch { /* Unavailable storage also blocks upload persistence; still terminate the server session. */ }
    const response = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    if (!response.ok) { if (user?.id) window.localStorage.removeItem(`rts-upload-cleanup:${user.id}`); return; }
    try { if (user?.id) invalidateOwnerUploads(user.id); } catch { /* Continue owner cleanup even when marker storage is unavailable. */ }
    try { clearBrowserDrafts(window.localStorage, window.sessionStorage); } catch { /* Browser storage may be unavailable. */ }
    if (user?.id) { try { await clearOwnerUploads(user.id); } catch { window.alert("Signed out, but local photo cleanup is incomplete. Keep this device private until cleanup succeeds."); } }
    window.location.replace("/login");
  }
  return <button type="button" onClick={logout} aria-label="Log out" title="Log out" className="btn-secondary !min-h-11 !px-3 !py-2"><ArrowRightOnRectangleIcon className="size-5" /><span className="hidden sm:inline">Logout</span></button>;
}

export function RoleBadge() {
  const user = useAuthUser();
  if (!user) return null;
  return <span className="hidden items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-xs font-bold text-accent sm:inline-flex"><ShieldCheckIcon className="size-4" />{user.role}</span>;
}
