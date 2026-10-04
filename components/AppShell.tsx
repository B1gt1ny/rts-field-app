"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BellAlertIcon, BriefcaseIcon, CalendarDaysIcon, ChartBarIcon, ChevronDownIcon, Cog6ToothIcon, HomeIcon, MoonIcon, SunIcon, UserCircleIcon, UsersIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { roleHomePath } from "@/lib/client-auth";
import { LogoutButton, RoleBadge, useAuthUser } from "./AuthGate";

const adminPrimaryNavigation = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/jobs", label: "Jobs", icon: BriefcaseIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarDaysIcon },
  { href: "/field", label: "Field", icon: UserCircleIcon },
];
const employeeNavigation = [
  { href: "/field", label: "My Work", icon: UserCircleIcon },
  { href: "/today-command", label: "Today", icon: BellAlertIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarDaysIcon },
  { href: "/account", label: "Account", icon: UserCircleIcon },
];
const adminMobileNavigation = [
  ...adminPrimaryNavigation,
  { href: "/settings", label: "More", icon: Cog6ToothIcon },
];
type NavigationSection = { label: string; icon: typeof HomeIcon; links: Array<[string, string, string?]>; aliases?: string[] };
const managerSections: NavigationSection[] = [
  { label: "Dashboard", icon: HomeIcon, links: [["/", "Overview"], ["/today-command", "Today"], ["/command", "Operations"]], aliases: ["/today"] },
  { label: "Jobs", icon: BriefcaseIcon, links: [["/jobs", "All jobs"], ["/jobs/new", "New job"], ["/import", "Import work order"], ["/completed", "Completed jobs"]], aliases: ["/factory", "/dealer", "/individual", "/waiting-on-parts"] },
  { label: "Office", icon: UsersIcon, links: [["/customers", "Customers", "People"], ["/employees", "Employees", "People"], ["/crew", "Crew assignments", "People"], ["/dispatch", "Dispatch", "Work coordination"], ["/ready-check", "Manager review", "Work coordination"], ["/communication", "Communication", "Work coordination"], ["/tasks", "Tasks", "Work coordination"], ["/reminders", "Reminders", "Work coordination"], ["/documents", "Documents", "Paperwork & billing"], ["/billing", "Billing", "Paperwork & billing"]] },
  { label: "Admin", icon: Cog6ToothIcon, links: [["/settings", "Settings"], ["/account", "My account"], ["/install", "Install help"]] },
];
const employeeMore = [["/customers", "Customers"], ["/waiting-on-parts", "Waiting on Parts"], ["/install", "Install on Phone"]];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthUser();
  const [online, setOnline] = useState(true);
  const [dark, setDark] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileDialog = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileMenuOpen || !mobileDialog.current) return;
    const dialog = mobileDialog.current;
    const trigger = menuTrigger.current;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary, [tabindex="0"]')).filter(element => {
      const collapsedGroup = element.closest("details:not([open])");
      return element.getClientRects().length > 0 && (!collapsedGroup || element === collapsedGroup.querySelector("summary"));
    });
    (focusable()[0] || dialog).focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenuOpen(false);
      } else if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); dialog.focus(); }
        else if (!dialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    }
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeAtDesktop = () => { if (desktop.matches) setMobileMenuOpen(false); };
    document.addEventListener("keydown", handleKey);
    desktop.addEventListener("change", closeAtDesktop);
    closeAtDesktop();
    return () => {
      document.removeEventListener("keydown", handleKey);
      desktop.removeEventListener("change", closeAtDesktop);
      if (trigger?.isConnected && trigger.getClientRects().length > 0) trigger.focus();
    };
  }, [mobileMenuOpen]);
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
  const homePath = roleHomePath(role);
  const visibleNavigation = isEmployee ? employeeNavigation : adminPrimaryNavigation;
  const visibleMobileNavigation = isEmployee ? employeeNavigation : adminMobileNavigation.map((item, index) => index === 0 && role === "Manager" ? { ...item, href: homePath, label: "Today", icon: BellAlertIcon } : item);
  const sections = managerSections.map((section, index) => index === 0 && role === "Manager" ? { ...section, label: "Today", icon: BellAlertIcon, links: [["/today-command", "Today"], ["/", "Business overview"], ["/command", "Operations"]] as NavigationSection["links"] } : section);
  const sectionActive = (section: NavigationSection) => [...section.links.map(([href]) => href), ...(section.aliases || [])].some(href => isActiveRoute(pathname, href));
  return <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
    <a href="#main-content" className="skip-link">Skip to page content</a>
    <aside className="app-sidebar sticky top-0 hidden h-screen overflow-y-auto border-r border-white/10 px-5 py-6 text-white lg:block">
      <Link href={homePath} className="mb-7 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-lime text-lg font-bold text-ink">RTS</span>
        <span><span className="block text-lg font-extrabold">RTS Land Solutions</span><span className="text-xs text-white/65">Field App</span></span>
      </Link>
      <nav aria-label="Main navigation" className="space-y-1">
        {isEmployee ? <>
          {visibleNavigation.map(({ href, label, icon: Icon }) => <NavLink key={href} href={href} active={isActiveRoute(pathname, href)}><Icon className="size-5" />{label}</NavLink>)}
          <p className="px-3 pb-1 pt-5 text-xs font-bold uppercase tracking-wider text-white/55">More</p>
          {employeeMore.map(([href, label]) => <NavLink key={href} href={href} active={pathname === href}>{label}</NavLink>)}
        </> : <>
          {sections.slice(0, 2).map(section => <NavigationGroup key={`${section.label}:${pathname}`} section={section} active={sectionActive(section)} pathname={pathname} />)}
          {adminPrimaryNavigation.slice(2).map(({ href, label, icon: Icon }) => <NavLink key={href} href={href} active={isActiveRoute(pathname, href)}><Icon className="size-5" />{label}</NavLink>)}
          <NavigationGroup key={`Office:${pathname}`} section={sections[2]} active={sectionActive(sections[2])} pathname={pathname} />
          <NavLink href="/reports" active={isActiveRoute(pathname, "/reports")}><ChartBarIcon className="size-5" />Reports</NavLink>
          <NavigationGroup key={`Admin:${pathname}`} section={sections[3]} active={sectionActive(sections[3])} pathname={pathname} />
        </>}
      </nav>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-content/[.06] bg-surface/90 px-4 backdrop-blur-md lg:px-8">
        <Link href={homePath} className="flex items-center gap-2 font-extrabold lg:hidden"><span className="grid size-9 place-items-center rounded-lg bg-ink text-xs text-lime">RTS</span>Field App</Link>
        <div className="hidden lg:block"><p className="text-sm font-semibold text-content/65">RTS Land Solutions</p><p className="font-extrabold">Field App</p></div>
        <div className="flex items-center gap-2"><button type="button" onClick={toggleTheme} aria-label={`Use ${dark ? "light" : "dark"} appearance`} aria-pressed={dark} title={`Use ${dark ? "light" : "dark"} appearance`} className="grid size-11 place-items-center rounded-xl border border-content/10 bg-surface text-content"><>{dark ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}</></button><span role="status" className={`hidden items-center rounded-full px-3 py-2 text-xs font-bold sm:inline-flex ${online ? "bg-forest text-white" : "bg-orange-100 text-orange-800"}`}>{online ? "Online" : "Offline"}</span><RoleBadge /><LogoutButton /></div>
      </header>
      <main id="main-content" className="mx-auto max-w-7xl px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-content/10 bg-surface/95 px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:hidden">
      {visibleMobileNavigation.slice(0, 4).map(({ href, label, icon: Icon }) => { const active = isActiveRoute(pathname, href); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold ${active ? "bg-forest/15 text-accent" : "text-content/65"}`}><Icon className="size-5" />{label}</Link>; })}
      <button ref={menuTrigger} type="button" onClick={() => setMobileMenuOpen(true)} aria-controls="app-pages-dialog" aria-label="Open all app pages" aria-expanded={mobileMenuOpen} className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold text-content/65"><Cog6ToothIcon className="size-5" />More</button>
    </nav>
    {mobileMenuOpen && <div ref={mobileDialog} id="app-pages-dialog" tabIndex={-1} className="fixed inset-0 z-50 bg-black/50 p-3 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="app-pages-title">
      <div className="ml-auto flex h-full w-full max-w-sm flex-col rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-content/10 p-4"><div><p className="eyebrow">RTS Field App</p><h2 id="app-pages-title" className="text-xl font-bold">All pages</h2></div><button type="button" onClick={() => setMobileMenuOpen(false)} className="grid size-11 place-items-center rounded-xl border border-content/10" aria-label="Close all pages"><XMarkIcon className="size-5" /></button></div>
        <nav aria-label="More navigation" className="grid gap-1 overflow-y-auto p-3">
          {isEmployee ? employeeMore.map(([href, label]) => <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} aria-current={pathname === href ? "page" : undefined} className="flex min-h-12 items-center rounded-xl px-4 text-sm font-bold hover:bg-sand">{label}</Link>) : <>
            {sections.slice(0, 3).map(section => <NavigationGroup key={`${section.label}:${pathname}`} section={{ ...section, links: section.links.filter(([href]) => href !== homePath && href !== "/jobs") }} active={sectionActive(section)} pathname={pathname} mobile onNavigate={() => setMobileMenuOpen(false)} />)}
            <Link href="/reports" onClick={() => setMobileMenuOpen(false)} aria-current={pathname === "/reports" ? "page" : undefined} className="flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-bold hover:bg-sand"><ChartBarIcon className="size-5" />Reports</Link>
            <NavigationGroup key={`Admin:${pathname}`} section={sections[3]} active={sectionActive(sections[3])} pathname={pathname} mobile onNavigate={() => setMobileMenuOpen(false)} />
          </>}
        </nav>
      </div>
    </div>}
  </div>;
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${active ? "bg-forest/25 text-white shadow-sm" : "text-white/65 hover:bg-white/5 hover:text-white"}`}>{children}</Link>;
}

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationGroup({ section, active, pathname, mobile = false, onNavigate }: { section: NavigationSection; active: boolean; pathname: string; mobile?: boolean; onNavigate?: () => void }) {
  const Icon = section.icon;
  return <details open={active} className="group/nav">
    <summary className={`flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden ${mobile ? "text-content hover:bg-sand" : active ? "bg-forest/25 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"}`}><Icon className="size-5" />{section.label}<ChevronDownIcon className="ml-auto size-4 transition group-open/nav:rotate-180" /></summary>
    <div className={`ml-5 space-y-1 border-l pl-2 ${mobile ? "border-content/10" : "border-white/10"}`}>
      {section.links.map(([href, label, group], index) => <div key={href}>
        {group && group !== section.links[index - 1]?.[2] && <p className={`px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide ${mobile ? "text-content/60" : "text-white/55"}`}>{group}</p>}
        {mobile ? <Link href={href} onClick={onNavigate} aria-current={isActiveRoute(pathname, href) && !(href === "/jobs" && pathname !== "/jobs") ? "page" : undefined} className={`flex min-h-12 items-center rounded-xl px-3 text-sm font-semibold ${pathname === href ? "bg-forest text-white" : "hover:bg-sand"}`}>{label}</Link> : <NavLink href={href} active={pathname === href}>{label}</NavLink>}
      </div>)}
    </div>
  </details>;
}
