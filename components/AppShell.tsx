"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpTrayIcon, BellAlertIcon, BriefcaseIcon, CalendarDaysIcon, ChatBubbleLeftRightIcon, Cog6ToothIcon, HomeIcon, PlusIcon, UserCircleIcon, UsersIcon } from "@heroicons/react/24/outline";
import { LogoutButton, RoleBadge, useAuthUser } from "./AuthGate";

const adminPrimaryNavigation = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/jobs", label: "Jobs", icon: BriefcaseIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarDaysIcon },
  { href: "/field", label: "Field", icon: UserCircleIcon },
];
const employeeNavigation = [
  { href: "/today-command", label: "Today", icon: BellAlertIcon },
  { href: "/field", label: "Field", icon: UserCircleIcon },
  { href: "/jobs", label: "Jobs", icon: BriefcaseIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarDaysIcon },
  { href: "/account", label: "Account", icon: UserCircleIcon },
];
const adminMobileNavigation = [
  ...adminPrimaryNavigation,
  { href: "/settings", label: "More", icon: Cog6ToothIcon },
];
const adminMore = [
  ["/today-command", "Today Command"], ["/today", "Today’s Jobs"], ["/ready-check", "Ready Check"], ["/customers", "Customers"], ["/install", "Install on Phone"], ["/factory", "Factory Jobs"], ["/dealer", "Dealer Jobs"], ["/individual", "Individual Jobs"], ["/crew", "Employee Assignments"], ["/waiting-on-parts", "Waiting on Parts"], ["/completed", "Completed Jobs"],
];
const employeeMore = [["/customers", "Customers"], ["/waiting-on-parts", "Waiting on Parts"], ["/install", "Install on Phone"]];
const admin = [["/command", "Command"], ["/employees", "Employees"], ["/dispatch", "Dispatch"], ["/documents", "Documents"], ["/communication", "Communication"], ["/reminders", "Reminders"], ["/tasks", "Tasks"], ["/billing", "Billing"], ["/reports", "Reports"], ["/settings", "Settings"], ["/account", "My Account"]];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthUser();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  if (pathname.startsWith("/login")) return <>{children}</>;
  const role = user?.role || "Employee";
  const isEmployee = role === "Employee";
  const visibleNavigation = isEmployee ? employeeNavigation : adminPrimaryNavigation;
  const visibleMobileNavigation = isEmployee ? employeeNavigation : adminMobileNavigation;
  const visibleMore = isEmployee ? employeeMore : adminMore;
  return <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
    <aside className="hidden border-r border-black/5 bg-ink px-5 py-6 text-white lg:block">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-lime text-lg font-black text-ink">CC</span>
        <span><span className="block text-lg font-extrabold">Company Command</span><span className="text-xs text-white/50">RTS Field App</span></span>
      </Link>
      <nav className="space-y-1">
        {visibleNavigation.map(({ href, label, icon: Icon }) => <NavLink key={href} href={href} active={isActiveRoute(pathname, href)}><Icon className="size-5" />{label}</NavLink>)}
      </nav>
      {visibleMore.length > 0 && <><p className="mb-2 mt-8 px-3 text-[11px] font-bold uppercase tracking-widest text-white/35">More</p>
      <nav className="space-y-1">{visibleMore.map(([href, label]) => <NavLink key={href} href={href} active={pathname === href}>{label}</NavLink>)}</nav></>}
      {!isEmployee && <><p className="mb-2 mt-8 px-3 text-[11px] font-bold uppercase tracking-widest text-white/35">Admin</p>
      <nav className="space-y-1">{admin.map(([href, label]) => <NavLink key={href} href={href} active={pathname === href}>{href === "/communication" ? <ChatBubbleLeftRightIcon className="size-5" /> : href === "/employees" ? <UsersIcon className="size-5" /> : <Cog6ToothIcon className="size-5" />}{label}</NavLink>)}</nav></>}
      {!isEmployee && <Link href="/jobs/new" className="mt-8 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime font-extrabold text-ink"><PlusIcon className="size-5" />New Job</Link>}
      {!isEmployee && <Link href="/import" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/10 font-extrabold text-white"><ArrowUpTrayIcon className="size-5" />Import Work Order</Link>}
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-black/5 bg-sand/90 px-4 backdrop-blur lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-extrabold lg:hidden"><span className="grid size-9 place-items-center rounded-lg bg-ink text-xs text-lime">CC</span>Command</Link>
        <div className="hidden lg:block"><p className="text-sm font-semibold text-black/45">RTS Field App</p><p className="font-extrabold">Company Command</p></div>
        <div className="flex gap-2"><span className={`hidden items-center rounded-full px-3 py-2 text-xs font-black sm:inline-flex ${online ? "bg-forest text-white" : "bg-orange-100 text-orange-800"}`}>{online ? "Online" : "Offline"}</span><RoleBadge /><LogoutButton /></div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-black/10 bg-white px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden">
      {visibleMobileNavigation.slice(0, 5).map(({ href, label, icon: Icon }) => { const active = isActiveRoute(pathname, href); return <Link key={href} href={href} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold ${active ? "bg-forest/10 text-forest" : "text-black/45"}`}><Icon className="size-5" />{label}</Link>; })}
    </nav>
  </div>;
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-white/12 text-lime" : "text-white/65 hover:bg-white/5 hover:text-white"}`}>{children}</Link>;
}

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
