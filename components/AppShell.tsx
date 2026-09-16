"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpTrayIcon, BellAlertIcon, BriefcaseIcon, CalendarDaysIcon, ChatBubbleLeftRightIcon, Cog6ToothIcon, HomeIcon, MoonIcon, PlusIcon, SunIcon, UserCircleIcon, UsersIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { LogoutButton, RoleBadge, useAuthUser } from "./AuthGate";

const adminPrimaryNavigation = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/jobs", label: "Jobs", icon: BriefcaseIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarDaysIcon },
  { href: "/field", label: "Field", icon: UserCircleIcon },
];
const employeeNavigation = [
  { href: "/today-command", label: "Today", icon: BellAlertIcon },
  { href: "/field", label: "My Work", icon: UserCircleIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarDaysIcon },
  { href: "/account", label: "Account", icon: UserCircleIcon },
];
const adminMobileNavigation = [
  ...adminPrimaryNavigation,
  { href: "/settings", label: "More", icon: Cog6ToothIcon },
];
const adminMore = [
  ["/command", "Operations"], ["/today", "Today"], ["/today-command", "Today Command"], ["/ready-check", "Ready Check"], ["/customers", "Customers"], ["/install", "Install on Phone"], ["/factory", "Factory Jobs"], ["/dealer", "Dealer Jobs"], ["/individual", "Individual Jobs"], ["/crew", "Employee Assignments"], ["/waiting-on-parts", "Waiting on Parts"], ["/completed", "Completed Jobs"],
];
const employeeMore = [["/customers", "Customers"], ["/waiting-on-parts", "Waiting on Parts"], ["/install", "Install on Phone"]];
const admin = [["/employees", "Employees"], ["/dispatch", "Dispatch"], ["/documents", "Documents"], ["/communication", "Communication"], ["/reminders", "Reminders"], ["/tasks", "Tasks"], ["/billing", "Billing"], ["/reports", "Reports"], ["/settings", "Settings"], ["/account", "My Account"]];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthUser();
  const [online, setOnline] = useState(true);
  const [dark, setDark] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  useEffect(() => {
    const saved = window.localStorage.getItem("rts-theme");
    const useDark = saved !== "light";
    setDark(useDark);
    document.documentElement.classList.toggle("dark", useDark);
  }, []);
  function toggleTheme() {
    setDark((current) => {
      const next = !current;
      window.localStorage.setItem("rts-theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }
  if (pathname.startsWith("/login")) return <>{children}</>;
  const role = user?.role || "Employee";
  const isEmployee = role === "Employee";
  const visibleNavigation = isEmployee ? employeeNavigation : adminPrimaryNavigation;
  const visibleMobileNavigation = isEmployee ? employeeNavigation : adminMobileNavigation;
  const visibleMore = isEmployee ? employeeMore : adminMore;
  const mobileMoreLinks = isEmployee ? [...employeeMore] : [...adminMore, ...admin];
  return <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
    <a href="#main-content" className="skip-link">Skip to page content</a>
    <aside className="hidden border-r border-white/5 bg-ink px-5 py-6 text-white lg:block">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-lime text-lg font-black text-ink">RTS</span>
        <span><span className="block text-lg font-extrabold">RTS Land Solutions</span><span className="text-xs text-white/50">Field App</span></span>
      </Link>
      <nav className="space-y-1">
        {visibleNavigation.map(({ href, label, icon: Icon }) => <NavLink key={href} href={href} active={isActiveRoute(pathname, href)}><Icon className="size-5" />{label}</NavLink>)}
      </nav>
      {visibleMore.length > 0 && <><p className="mb-2 mt-8 px-3 text-[11px] font-bold uppercase tracking-widest text-white/35">More</p>
      <nav className="space-y-1">{visibleMore.map(([href, label]) => <NavLink key={href} href={href} active={pathname === href}>{label}</NavLink>)}</nav></>}
      {!isEmployee && <><p className="mb-2 mt-8 px-3 text-[11px] font-bold uppercase tracking-widest text-white/35">Admin</p>
      <nav className="space-y-1">{admin.map(([href, label]) => <NavLink key={href} href={href} active={pathname === href}>{href === "/communication" ? <ChatBubbleLeftRightIcon className="size-5" /> : href === "/employees" ? <UsersIcon className="size-5" /> : <Cog6ToothIcon className="size-5" />}{label}</NavLink>)}</nav></>}
      {!isEmployee && <Link href="/jobs/new" className="mt-8 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime font-extrabold text-ink shadow-lg shadow-lime/10 transition hover:-translate-y-px"><PlusIcon className="size-5" />New Job</Link>}
      {!isEmployee && <Link href="/import" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 font-extrabold text-white transition hover:bg-white/15"><ArrowUpTrayIcon className="size-5" />Import Work Order</Link>}
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-black/[.06] bg-sand/85 px-4 backdrop-blur-md lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-extrabold lg:hidden"><span className="grid size-9 place-items-center rounded-lg bg-ink text-xs text-lime">RTS</span>Field App</Link>
        <div className="hidden lg:block"><p className="text-sm font-semibold text-black/45">RTS Land Solutions</p><p className="font-extrabold">Field App</p></div>
        <div className="flex items-center gap-2"><button type="button" onClick={toggleTheme} aria-label={`Use ${dark ? "light" : "dark"} appearance`} aria-pressed={dark} title={`Use ${dark ? "light" : "dark"} appearance`} className="grid size-11 place-items-center rounded-xl border border-black/10 bg-white text-ink"><>{dark ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}</></button><span role="status" className={`hidden items-center rounded-full px-3 py-2 text-xs font-black sm:inline-flex ${online ? "bg-forest text-white" : "bg-orange-100 text-orange-800"}`}>{online ? "Online" : "Offline"}</span><RoleBadge /><LogoutButton /></div>
      </header>
      <main id="main-content" className="mx-auto max-w-7xl px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-black/10 bg-white/95 px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:hidden">
      {visibleMobileNavigation.slice(0, 4).map(({ href, label, icon: Icon }) => { const active = isActiveRoute(pathname, href); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold ${active ? "bg-forest/10 text-forest" : "text-black/45"}`}><Icon className="size-5" />{label}</Link>; })}
      <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open all app pages" aria-expanded={mobileMenuOpen} className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold text-black/45"><Cog6ToothIcon className="size-5" />More</button>
    </nav>
    {mobileMenuOpen && <div className="fixed inset-0 z-50 bg-black/50 p-3 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="app-pages-title">
      <div className="ml-auto flex h-full w-full max-w-sm flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/10 p-4"><div><p className="eyebrow">RTS Field App</p><h2 id="app-pages-title" className="text-xl font-black">All pages</h2></div><button type="button" onClick={() => setMobileMenuOpen(false)} className="grid size-11 place-items-center rounded-xl border border-black/10" aria-label="Close all pages"><XMarkIcon className="size-5" /></button></div>
        <nav className="grid gap-1 overflow-y-auto p-3">{mobileMoreLinks.map(([href, label]) => <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} aria-current={pathname === href ? "page" : undefined} className={`flex min-h-12 items-center rounded-xl px-4 text-sm font-bold ${pathname === href ? "bg-forest text-white" : "hover:bg-sand"}`}>{label}</Link>)}</nav>
      </div>
    </div>}
  </div>;
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${active ? "bg-white/12 text-lime shadow-sm" : "text-white/65 hover:bg-white/5 hover:text-white"}`}>{children}</Link>;
}

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
