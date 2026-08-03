"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowTopRightOnSquareIcon, BellAlertIcon, BuildingOffice2Icon, CalendarDaysIcon, CameraIcon, ChatBubbleLeftRightIcon, ClipboardDocumentIcon, Cog6ToothIcon, DevicePhoneMobileIcon, DocumentTextIcon, ReceiptPercentIcon, ShoppingBagIcon, SparklesIcon, TableCellsIcon } from "@heroicons/react/24/outline";
import { defaultFactoryCost, type BusinessSettings, type Employee, type FactoryCostTracker, type MerchRequest, type MerchRequestStatus } from "@/lib/types";
import { authFetch } from "@/lib/client-auth";
import type { UserRole } from "@/lib/auth";

type IntegrationStatus = Record<string, boolean>;
type PlatformStatus = {
  database?: boolean;
  auth?: boolean;
  storage?: boolean;
  storageBucket?: string;
  adminEmails?: boolean;
  managerEmails?: boolean;
};
type SetupStatus = {
  companyCamUserEmail?: boolean;
  googleCalendarId?: string;
  authSetupCode?: boolean;
};
type AccessUser = { id: string; email: string; role: UserRole; employeeId?: string; employeeName?: string; createdAt?: string; lastSignInAt?: string };

const defaultCompany: BusinessSettings = {
  businessId: "rts",
  appDisplayName: "Company Command",
  headerName: "Company Command — RTS",
  brandShortName: "CC",
  companyName: "RTS Field App",
  phone: "",
  email: "Texastrimout@gmail.com",
  address: "",
  city: "",
  defaultCalendar: "Google Calendar",
  defaultState: "TX",
  merchandiseLink: "",
  fieldSupportName: "Office",
  fieldSupportPhone: "",
  employeeHelpInstructions: "If something blocks the job, tap Need Help, add what is missing, then call or text the office before leaving.",
  employeeFieldNotice: "Open your assigned job, check the scope, take required photos, add notes, and tap Ready Review when field work is complete.",
  managerReviewInstructions: "Manager review checks after photos, completion notes, work completed, and open parts before billing.",
  customerTextTemplate: "RTS update for {customerName}: crew is on your job {jobId}.",
  factoryCostInstructions: "Factory jobs: enter miles, drive time, hotel, materials, and other receipt totals before sending the job for review.",
  factoryCostDefaults: defaultFactoryCost(),
  employeeCanRequestHelp: true,
  employeeCanStartJobs: true,
  employeeCanAddQuickNotes: true,
  employeeCanAddCompletionNotes: true,
  employeeCanUploadFiles: true,
  employeeCanRequestParts: true,
  employeeCanAddFactoryCosts: true,
  employeeCanSendReadyReview: true,
  employeeCanAddSignoffs: true,
  employeeCanViewPackets: true,
  showCompletedJobsInFieldApp: false,
  jobTypeOptions: ["Trim out", "Service", "Warranty", "Setup", "Skirting", "Repair"],
  statusOptions: ["New", "Scheduled", "In Progress", "Waiting on Parts", "Needs Inspection", "Complete", "Billed", "Paid"],
  priorityOptions: ["Low", "Normal", "High", "Urgent"],
  checklistOptions: [
    "Paperwork picked up", "Scope reviewed", "Materials checked", "Before photos taken",
    "Serial/VIN tag photo taken", "Work completed", "After photos taken",
    "Completion notes added", "Customer/source notified", "Invoice created",
  ],
  employeeFieldNoteTemplates: [
    "Arrived | Crew arrived on site. | Time",
    "Customer not home | Customer not home. Crew needs follow-up before returning. | Customer",
    "Parts missing | Parts missing or incorrect. Need manager review before work can continue. | Parts",
    "Blocked | Crew is blocked and needs manager direction before continuing. | Status",
    "Work complete | Field work complete. Ready for closeout review. | Status",
  ],
  requireAfterPhotosToComplete: true,
  requireBeforePhotosForReview: true,
  requireSerialTagPhotoForReview: true,
  requireDamagePhotosForReview: false,
  requireAfterPhotosForReview: true,
  requireCompletionNotesForReview: true,
  requireWorkCompleteForReview: true,
  requirePartsClosedForReview: true,
  requireFactoryCostsForReview: true,
  requireReceiptBackupForReview: true,
};

const integrationCards = [
  { key: "companyCam", name: "CompanyCam", stage: "Live connector", description: "Photo project creation/opening from each real job profile.", icon: CameraIcon, action: "Needs COMPANYCAM_ACCESS_TOKEN in Vercel; user email is recommended.", appPath: "/jobs", safety: "Job-by-job only. Does not create projects for mock/test jobs." },
  { key: "googleCalendar", name: "Google Calendar", stage: "Live connector", description: "Explicit job scheduling, Google event links, and monthly dashboard reference.", icon: CalendarDaysIcon, action: "Needs Google OAuth client ID, secret, refresh token, and calendar ID.", appPath: "/schedule", safety: "Job-by-job only. Mock jobs are not auto-added." },
  { key: "openAiExtraction", name: "AI work-order extraction", stage: "Key-ready", description: "Read work-order photos/PDFs and fill customer profiles.", icon: SparklesIcon, action: "Needs OPENAI_API_KEY, then extraction endpoint/UI can be turned on.", appPath: "/import", safety: "Current app stores the original file and parses pasted text." },
  { key: "invoiceSimple", name: "Invoice Simple", stage: "Manual workflow", description: "Invoice status, ready-to-bill handoff, invoice sent, on-hold, paid tracking.", icon: ReceiptPercentIcon, action: "Future API key/account decision. Manual copy summaries work now.", appPath: "/billing", safety: "No invoices or payments are created automatically." },
  { key: "zenzap", name: "ZenZap-style communication", stage: "Built-in workflow", description: "Job notes, activity feed, reminder dates, follow-ups, and employee communication.", icon: ChatBubbleLeftRightIcon, action: "Future API connection optional; internal communication tools work now.", appPath: "/communication", safety: "No external messages are sent automatically." },
  { key: "googleSheets", name: "Google Sheets", stage: "Export-ready", description: "CSV exports for command boards, jobs, billing, documents, and communication.", icon: TableCellsIcon, action: "Future spreadsheet ID can push exports directly.", appPath: "/reports", safety: "CSV downloads work without writing to Sheets." },
  { key: "appSheet", name: "AppSheet", stage: "Future bridge", description: "Optional compatibility for businesses already using AppSheet.", icon: DocumentTextIcon, action: "Future AppSheet app ID after business model is decided.", appPath: "/documents", safety: "No AppSheet sync runs yet." },
];

const adminShortcuts = [
  { href: "/employees", title: "Employees", description: "Add employees and keep selectable crews flexible.", icon: BuildingOffice2Icon },
  { href: "/dispatch", title: "Dispatch", description: "See work that is ready to hand off.", icon: BellAlertIcon },
  { href: "/ready-check", title: "Ready check", description: "Check paperwork, materials, photos, and notes.", icon: DocumentTextIcon },
  { href: "/schedule", title: "Schedule", description: "Place jobs on the calendar and review the month.", icon: CalendarDaysIcon },
  { href: "/documents", title: "Paperwork", description: "Work orders, receipts, photos, and printable files.", icon: TableCellsIcon },
  { href: "/communication", title: "Communication", description: "Job updates, notifications, and follow-ups.", icon: ChatBubbleLeftRightIcon },
  { href: "/billing", title: "Billing", description: "Invoices, ready-to-bill jobs, and payment status.", icon: ReceiptPercentIcon },
  { href: "/install", title: "Install app", description: "Phone install steps for iPhone and Android.", icon: ArrowTopRightOnSquareIcon },
];

export function SettingsPanel() {
  const [integrations, setIntegrations] = useState<IntegrationStatus>({});
  const [platform, setPlatform] = useState<PlatformStatus>({});
  const [setupStatus, setSetupStatus] = useState<SetupStatus>({});
  const [company, setCompany] = useState<BusinessSettings>(defaultCompany);
  const [requests, setRequests] = useState<MerchRequest[]>([]);
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cleanup, setCleanup] = useState<{ testJobs: { jobId: string; customerName: string }[]; smokeTestFiles: string[] } | null>(null);
  const [cleanupConfirm, setCleanupConfirm] = useState("");
  const [saved, setSaved] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/status").then((response) => response.json()).then((data) => {
      setIntegrations(data.integrations || {});
      setPlatform(data.platform || {});
      setSetupStatus(data.setup || {});
    }).catch(() => {
      setIntegrations({});
      setPlatform({});
      setSetupStatus({});
    });
    Promise.all([
      fetch("/api/settings").then((response) => response.json()),
      fetch("/api/merch-requests").then((response) => response.json()),
      fetch("/api/employees").then((response) => response.json()).catch(() => []),
    ]).then(([settings, merchRequests, employeeData]) => {
      setCompany({ ...defaultCompany, ...settings });
      setRequests(Array.isArray(merchRequests) ? merchRequests : []);
      setEmployees(Array.isArray(employeeData) ? employeeData.filter((employee: Employee) => employee.active) : []);
    }).catch(() => setSaved("Admin settings could not load from the server.")).finally(() => setLoading(false));
    authFetch("/api/admin/users").then((response) => response.ok ? response.json() : []).then((data) => setUsers(Array.isArray(data) ? data : [])).catch(() => setUsers([]));
  }, []);

  const merchSummary = useMemo(() => requests.slice(0, 5), [requests]);
  const connectedCount = useMemo(() => integrationCards.filter((card) => integrations[card.key]).length, [integrations]);
  const setupChecklist = useMemo(() => [
    { title: "Company name", done: Boolean(company.companyName?.trim()) },
    { title: "Company phone", done: Boolean(company.phone?.trim()) },
    { title: "Company email", done: Boolean(company.email?.trim()) },
    { title: "Employees added", done: employees.length > 0 },
    { title: "Admin users created", done: users.length > 0 },
    { title: "Calendar connection", done: Boolean(integrations.googleCalendar) },
    { title: "CompanyCam connection", done: Boolean(integrations.companyCam) },
    { title: "AI extraction key", done: Boolean(integrations.openAiExtraction) },
    { title: "Merch shop link", done: Boolean(company.merchandiseLink?.trim()) },
  ], [company.companyName, company.email, company.merchandiseLink, company.phone, employees.length, integrations.companyCam, integrations.googleCalendar, integrations.openAiExtraction, users.length]);
  const setupComplete = setupChecklist.filter((item) => item.done).length;
  const setupPercent = Math.round((setupComplete / setupChecklist.length) * 100);
  const platformChecklist = useMemo(() => [
    { title: "Supabase database", done: Boolean(platform.database), detail: platform.database ? "Cloud job data is configured." : "Needs Supabase URL and service role key." },
    { title: "Login/auth", done: Boolean(platform.auth), detail: platform.auth ? "Supabase Auth env vars are configured." : "Needs Supabase anon + service role setup." },
    { title: "File cabinet", done: Boolean(platform.storage), detail: platform.storage ? `Storage bucket: ${platform.storageBucket || "job-files"}` : "Falls back to job record data URLs until storage is configured." },
    { title: "Admin emails", done: Boolean(platform.adminEmails), detail: platform.adminEmails ? "Admin email allow-list present." : "Set ADMIN_EMAILS in Vercel." },
    { title: "Manager emails", done: Boolean(platform.managerEmails), detail: platform.managerEmails ? "Manager email allow-list present." : "Set MANAGER_EMAILS in Vercel." },
  ], [platform.adminEmails, platform.auth, platform.database, platform.managerEmails, platform.storage, platform.storageBucket]);
  const platformComplete = platformChecklist.filter((item) => item.done).length;
  const integrationNextSteps = useMemo(() => buildIntegrationNextSteps(integrations, setupStatus), [integrations, setupStatus]);
  const employeeUsers = users.filter((user) => user.role === "Employee");
  const linkedEmployeeUsers = employeeUsers.filter((user) => Boolean(user.employeeId));
  const rolloutChecklist = [
    { title: "Employees added", done: employees.length > 0, detail: `${employees.length} active employee${employees.length === 1 ? "" : "s"}` },
    { title: "Employee logins created", done: employeeUsers.length > 0, detail: `${employeeUsers.length} employee login${employeeUsers.length === 1 ? "" : "s"}` },
    { title: "Logins linked to employee names", done: employeeUsers.length > 0 && linkedEmployeeUsers.length === employeeUsers.length, detail: `${linkedEmployeeUsers.length}/${employeeUsers.length || 0} linked` },
    { title: "Field permissions reviewed", done: true, detail: "Admin controls are saved below." },
    { title: "Install instructions ready", done: true, detail: "Crew invite can be copied from this page." },
  ];
  const rolloutComplete = rolloutChecklist.filter((item) => item.done).length;

  async function previewCleanup() {
    setSaved("Checking for obvious test records…");
    const response = await authFetch("/api/admin/cleanup");
    const result = await response.json();
    if (!response.ok) {
      setSaved(result.error || "Cleanup preview could not load.");
      return;
    }
    setCleanup(result);
    setSaved("Cleanup preview loaded. Nothing was deleted.");
  }

  async function runCleanup() {
    setSaved("Deleting only obvious test records…");
    const response = await authFetch("/api/admin/cleanup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: cleanupConfirm }) });
    const result = await response.json();
    if (!response.ok) {
      setSaved(result.error || "Cleanup could not run.");
      return;
    }
    setCleanupConfirm("");
    setCleanup(null);
    setSaved(`Cleanup complete: ${result.deletedJobs || 0} test jobs and ${result.deletedFiles || 0} smoke-test files removed.`);
  }

  async function saveCompany(event: React.FormEvent) {
    event.preventDefault();
    setSaved("Saving company settings…");
    const response = await authFetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(company) });
    if (!response.ok) {
      setSaved("Company settings could not be saved. The Supabase settings table may need to be added.");
      return;
    }
    setCompany({ ...defaultCompany, ...(await response.json()) });
    setSaved("Company settings saved for the admin app.");
  }

  async function submitMerch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const request: Partial<MerchRequest> = {
      businessId: company.businessId,
      item: String(form.get("item") || "Shirt"),
      size: String(form.get("size") || ""),
      color: String(form.get("color") || ""),
      quantity: String(form.get("quantity") || "1"),
      requestedBy: String(form.get("requestedBy") || ""),
      notes: String(form.get("notes") || ""),
    };
    setSaved("Saving merchandise request…");
    const response = await authFetch("/api/merch-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
    if (!response.ok) {
      setSaved("Merchandise request could not be saved. The Supabase merch table may need to be added.");
      return;
    }
    setRequests([await response.json(), ...requests].slice(0, 50));
    setSaved("Merchandise request saved for the admin app.");
    event.currentTarget.reset();
  }

  async function updateRequestStatus(id: string, status: MerchRequestStatus) {
    const response = await authFetch(`/api/merch-requests/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) {
      setSaved("Merchandise status could not be updated.");
      return;
    }
    const updated = await response.json() as MerchRequest;
    setRequests((old) => old.map((request) => request.id === id ? updated : request));
    setSaved("Merchandise request updated.");
  }

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaved("Creating user access…");
    const employeeId = String(form.get("employeeId") || "");
    const linkedEmployee = employees.find((employee) => employee.id === employeeId);
    const response = await authFetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
        role: String(form.get("role") || "Employee"),
        employeeId,
        employeeName: linkedEmployee?.name || "",
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setSaved(result.error || "User access could not be created.");
      return;
    }
    setUsers((old) => [result, ...old]);
    setSaved("User access created.");
    event.currentTarget.reset();
  }

  async function updateUserAccess(userId: string, changes: Partial<Pick<AccessUser, "role" | "employeeId">>) {
    const current = users.find((user) => user.id === userId);
    if (!current) return;
    const employeeId = changes.employeeId ?? current.employeeId ?? "";
    const linkedEmployee = employees.find((employee) => employee.id === employeeId);
    const role = changes.role ?? current.role;
    setSaved("Updating user access…");
    const response = await authFetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role, employeeId, employeeName: linkedEmployee?.name || "" }),
    });
    const result = await response.json();
    if (!response.ok) {
      setSaved(result.error || "User access could not be updated.");
      return;
    }
    setUsers((old) => old.map((user) => user.id === userId ? { ...user, role, employeeId, employeeName: linkedEmployee?.name || "" } : user));
    setSaved("User access updated.");
  }

  function set<K extends keyof BusinessSettings>(key: K, value: BusinessSettings[K]) {
    setCompany((old) => ({ ...old, [key]: value }));
  }

  function setFactoryCostDefault(key: keyof FactoryCostTracker, value: string) {
    setCompany((old) => ({ ...old, factoryCostDefaults: { ...(old.factoryCostDefaults || defaultFactoryCost()), [key]: value } }));
  }

  async function copyCrewInvite() {
    const text = buildCrewInvite(company);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInvite(true);
      setSaved("Crew invite copied.");
      window.setTimeout(() => setCopiedInvite(false), 2200);
    } catch {
      setSaved("Copy did not work. Open Install App and share the link manually.");
    }
  }

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime text-ink"><Cog6ToothIcon className="size-6" /></span>
      <div>
        <p className="text-sm font-extrabold uppercase tracking-widest text-forest">Admin Settings</p>
        <h1 className="text-3xl font-black">Admin console & connected apps</h1>
        <p className="mt-1 text-sm text-black/50">Admin-only area for company details, app connections, normal preferences, and crew merchandise requests.</p>
      </div>
    </div>

    {saved && <p className="rounded-xl border border-forest/20 bg-forest/5 p-3 text-sm font-bold text-forest">{saved}</p>}
    {loading && <p className="rounded-xl border border-black/10 bg-white p-3 text-sm font-bold text-black/45">Loading admin settings…</p>}

    <section className="card overflow-hidden">
      <div className="grid lg:grid-cols-[.9fr_1.1fr]">
        <div className="bg-ink p-5 text-white sm:p-6">
          <p className="text-xs font-black uppercase tracking-widest text-lime">Company Command setup</p>
          <h2 className="mt-2 text-2xl font-black">{setupPercent}% ready</h2>
          <p className="mt-2 text-sm text-white/60">{setupComplete} of {setupChecklist.length} admin setup items are complete. This is the quick admin checklist for daily field use.</p>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${setupPercent}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Stat label="Employees" value={String(employees.length)} />
            <Stat label="Users" value={String(users.length)} />
            <Stat label="Apps" value={`${connectedCount}/${integrationCards.length}`} />
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">
          {setupChecklist.map((item) => <div key={item.title} className={`rounded-2xl border p-3 ${item.done ? "border-forest/20 bg-forest/5" : "border-orange-200 bg-orange-50"}`}>
            <p className={`text-[11px] font-black uppercase tracking-wide ${item.done ? "text-forest" : "text-orange-800"}`}>{item.done ? "Done" : "Needs setup"}</p>
            <p className="mt-1 font-extrabold">{item.title}</p>
          </div>)}
        </div>
      </div>
    </section>

    <section className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <div className="card overflow-hidden">
        <div className="bg-sand p-4">
          <h2 className="text-lg font-black">Platform readiness</h2>
          <p className="mt-1 text-sm font-semibold text-black/45">The boring-but-important setup pieces that make the app independent from the Mac.</p>
        </div>
        <div className="divide-y divide-black/5">
          {platformChecklist.map((item) => <ReadinessRow key={item.title} title={item.title} detail={item.detail} done={item.done} />)}
        </div>
        <div className="p-4">
          <div className="h-3 overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${Math.round((platformComplete / platformChecklist.length) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs font-black uppercase tracking-wide text-black/40">{platformComplete} of {platformChecklist.length} platform items ready</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-ink p-4 text-white">
          <h2 className="text-lg font-black">Next integration moves</h2>
          <p className="mt-1 text-sm font-semibold text-white/55">Safe setup checklist. These are staging steps; they do not create calendar events, projects, invoices, or messages.</p>
        </div>
        <div className="divide-y divide-black/5">
          {integrationNextSteps.map((step) => <div key={step.title} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black">{step.title}</p>
                <p className="mt-1 text-sm font-semibold text-black/50">{step.detail}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${step.done ? "bg-forest text-white" : "bg-orange-100 text-orange-800"}`}>{step.done ? "Ready" : "Needed"}</span>
            </div>
            <Link href={step.href} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-sand px-3 py-2 text-xs font-black text-forest">Open related app area</Link>
          </div>)}
        </div>
      </div>
    </section>

    <section className="card p-4 sm:p-6">
      <h2 className="text-lg font-black">Admin shortcuts</h2>
      <p className="mt-1 text-sm text-black/45">Fast buttons for the parts of the app an owner or manager touches most.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {adminShortcuts.map(({ href, title, description, icon: Icon }) => <Link key={href} href={href} className="group rounded-2xl border border-black/10 bg-sand p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
          <span className="grid size-11 place-items-center rounded-xl bg-white text-forest group-hover:bg-forest group-hover:text-white"><Icon className="size-5" /></span>
          <p className="mt-3 font-black">{title}</p>
          <p className="mt-1 text-sm text-black/50">{description}</p>
        </Link>)}
      </div>
    </section>

    <AdminControlMap employees={employees.length} users={users.length} />

    <section className="card overflow-hidden">
      <div className="grid lg:grid-cols-[.85fr_1.15fr]">
        <div className="bg-forest p-5 text-white sm:p-6">
          <p className="text-xs font-black uppercase tracking-widest text-lime">Employee rollout</p>
          <h2 className="mt-1 text-2xl font-black">{rolloutComplete}/{rolloutChecklist.length} ready</h2>
          <p className="mt-2 text-sm text-white/65">Use this when you are getting crew members onto the phone app and making sure their login only shows assigned field work.</p>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${Math.round((rolloutComplete / rolloutChecklist.length) * 100)}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Stat label="Employee logins" value={String(employeeUsers.length)} />
            <Stat label="Linked logins" value={`${linkedEmployeeUsers.length}/${employeeUsers.length || 0}`} />
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {rolloutChecklist.map((item) => <div key={item.title} className={`rounded-2xl border p-3 ${item.done ? "border-forest/20 bg-forest/5" : "border-orange-200 bg-orange-50"}`}>
              <p className={`text-[11px] font-black uppercase tracking-wide ${item.done ? "text-forest" : "text-orange-800"}`}>{item.done ? "Ready" : "Needs work"}</p>
              <p className="mt-1 font-extrabold">{item.title}</p>
              <p className="mt-1 text-xs font-semibold text-black/45">{item.detail}</p>
            </div>)}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={copyCrewInvite} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-black text-white"><ClipboardDocumentIcon className="size-5" />{copiedInvite ? "Copied" : "Copy Invite"}</button>
            <Link href="/install" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-black text-ink"><DevicePhoneMobileIcon className="size-5" />Install Help</Link>
            <Link href="/field" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-black text-white"><ArrowTopRightOnSquareIcon className="size-5" />Preview Field</Link>
          </div>
          <p className="mt-3 rounded-xl bg-sand p-3 text-xs font-semibold text-black/45">Invite text does not include passwords. Give each employee their temporary password separately or have them change it after first login.</p>
        </div>
      </div>
    </section>

    <section className="card p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-black">Connected apps</h2>
          <p className="mt-1 text-sm text-black/45">These are the services this field app is being built to replace or connect with.</p>
        </div>
        <span className="rounded-full bg-forest/10 px-3 py-2 text-xs font-black uppercase tracking-wide text-forest">{connectedCount} connected</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {integrationCards.map(({ key, name, stage, description, icon: Icon, action, appPath, safety }) => {
          const connected = Boolean(integrations[key]);
          return <div key={key} className="rounded-2xl border border-black/10 bg-sand p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${connected ? "bg-forest text-white" : "bg-white text-forest"}`}><Icon className="size-5" /></span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${connected ? "bg-forest text-white" : "bg-orange-100 text-orange-800"}`}>{connected ? "Connected" : "Setup needed"}</span>
            </div>
            <h3 className="font-black">{name}</h3>
            <p className="mt-1 text-xs font-black uppercase tracking-wide text-forest">{stage}</p>
            <p className="mt-1 text-sm text-black/55">{description}</p>
            <p className="mt-3 rounded-xl bg-white p-3 text-xs font-bold text-black/45">{action}</p>
            <p className="mt-2 rounded-xl bg-white/70 p-3 text-xs font-semibold text-black/45">{safety}</p>
            <Link href={appPath} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-ink px-3 py-2 text-xs font-black text-white">Open workflow</Link>
          </div>;
        })}
      </div>
    </section>

    <section className="card p-4 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest text-white"><Cog6ToothIcon className="size-5" /></span>
        <div><h2 className="text-lg font-black">User access & roles</h2><p className="text-sm text-black/45">Admin creates app logins and assigns Admin, Manager, or Employee access.</p></div>
      </div>
      <form onSubmit={createUser} className="grid gap-3 lg:grid-cols-[1fr_1fr_.7fr_.9fr_auto]">
        <Input label="Email" name="email" placeholder="employee@email.com" />
        <Input label="Temp password" name="password" placeholder="At least 8 characters" />
        <Select label="Role" name="role" options={["Employee", "Manager", "Admin"]} />
        <Select label="Linked employee" name="employeeId" options={["", ...employees.map((employee) => employee.id)]} optionLabels={Object.fromEntries([["", "Not linked"], ...employees.map((employee) => [employee.id, employee.name])])} />
        <button className="btn-primary self-end">Create Login</button>
      </form>
      <div className="mt-5 space-y-2">
        {users.length ? users.map((user) => <div key={user.id} className="flex flex-col gap-3 rounded-xl bg-sand p-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-black">{user.email}</p><p className="text-xs font-semibold text-black/45">{user.employeeName ? `Linked to ${user.employeeName}` : "No employee linked"} · {user.lastSignInAt ? `Last sign in: ${new Date(user.lastSignInAt).toLocaleDateString()}` : "No sign-in yet"}</p></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="field !min-h-10 !w-auto !py-2 text-sm font-bold" value={user.role} onChange={(event) => updateUserAccess(user.id, { role: event.target.value as UserRole })}>
              {(["Employee", "Manager", "Admin"] as UserRole[]).map((role) => <option key={role}>{role}</option>)}
            </select>
            <select className="field !min-h-10 !w-auto !py-2 text-sm font-bold" value={user.employeeId || ""} onChange={(event) => updateUserAccess(user.id, { employeeId: event.target.value })}>
              <option value="">Not linked</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </div>
        </div>) : <p className="rounded-xl bg-sand p-3 text-sm font-semibold text-black/45">No users loaded yet. If this stays empty, confirm Supabase Auth env vars are set.</p>}
      </div>
    </section>

    <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <section className="card p-4 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800"><BuildingOffice2Icon className="size-5" /></span>
          <div><h2 className="text-lg font-black">Company details</h2><p className="text-sm text-black/45">Used for profiles, printouts, invoices, and future multi-business setup.</p></div>
        </div>
        <form onSubmit={saveCompany} className="grid gap-4 sm:grid-cols-2">
          <Input label="App display name" value={company.appDisplayName} onChange={(value) => set("appDisplayName", value)} />
          <Input label="Home/header name" value={company.headerName} onChange={(value) => set("headerName", value)} />
          <Input label="Short badge text" value={company.brandShortName} onChange={(value) => set("brandShortName", value)} />
          <Input label="Company name" value={company.companyName} onChange={(value) => set("companyName", value)} />
          <Input label="Company phone" value={company.phone} onChange={(value) => set("phone", value)} />
          <Input label="Company email" value={company.email} onChange={(value) => set("email", value)} />
          <Input label="Default state" value={company.defaultState} onChange={(value) => set("defaultState", value)} />
          <Input label="Street address" value={company.address} onChange={(value) => set("address", value)} wide />
          <Input label="City" value={company.city} onChange={(value) => set("city", value)} />
          <Input label="Merchandise shop link" value={company.merchandiseLink} onChange={(value) => set("merchandiseLink", value)} placeholder="https://..." />
          <Input label="Field support name" value={company.fieldSupportName} onChange={(value) => set("fieldSupportName", value)} placeholder="Office / Ronnie / Manager" />
          <Input label="Field support phone" value={company.fieldSupportPhone} onChange={(value) => set("fieldSupportPhone", value)} placeholder="Phone crews should call for help" />
          <Textarea label="Field help instructions" value={company.employeeHelpInstructions} onChange={(value) => set("employeeHelpInstructions", value)} placeholder="Tell employees what to do when blocked or needing help" />
          <Textarea label="Employee field notice" value={company.employeeFieldNotice} onChange={(value) => set("employeeFieldNotice", value)} placeholder="Short instructions employees see on /field" />
          <Textarea label="Manager review instructions" value={company.managerReviewInstructions} onChange={(value) => set("managerReviewInstructions", value)} placeholder="Explain what must be ready before manager review" />
          <button className="btn-primary sm:col-span-2">Save Company Details</button>
        </form>
      </section>

      <section className="card p-4 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-800"><BellAlertIcon className="size-5" /></span>
          <div><h2 className="text-lg font-black">General app options</h2><p className="text-sm text-black/45">Normal settings most field apps need.</p></div>
        </div>
        <div className="space-y-3">
          <Toggle title="Large field buttons" description="Keep mobile buttons easy to hit with gloves or one hand." defaultChecked />
          <Toggle title="Confirm destructive actions" description="Require confirmation before deleting jobs or employee data." defaultChecked />
          <Toggle title="Show completed jobs on dashboard" description="Useful for managers; crews may prefer active work only." />
          <Toggle title="Future notifications" description="Placeholder for assignment, schedule, and parts alerts." />
        </div>
      </section>
    </div>

    <section className="card p-4 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink"><DocumentTextIcon className="size-5" /></span>
        <div><h2 className="text-lg font-black">Field app option editors</h2><p className="text-sm text-black/45">Admin-controlled lists for job forms, priorities, statuses, and completion checklists.</p></div>
      </div>
      <form onSubmit={saveCompany} className="grid gap-4 lg:grid-cols-2">
        <ListEditor label="Job types" values={company.jobTypeOptions} onChange={(values) => set("jobTypeOptions", values)} placeholder="Trim out, Service, Warranty..." />
        <ListEditor label="Statuses" values={company.statusOptions} onChange={(values) => set("statusOptions", values)} placeholder="New, Scheduled, In Progress..." />
        <ListEditor label="Priorities" values={company.priorityOptions} onChange={(values) => set("priorityOptions", values)} placeholder="Low, Normal, High, Urgent" />
        <ListEditor label="Default checklist" values={company.checklistOptions} onChange={(values) => set("checklistOptions", values)} placeholder="One checklist item per line" />
        <ListEditor label="Employee quick note buttons" values={company.employeeFieldNoteTemplates} onChange={(values) => set("employeeFieldNoteTemplates", values)} placeholder="Arrived | Crew arrived on site. | Time" />
        <Textarea label="Customer text template" value={company.customerTextTemplate} onChange={(value) => set("customerTextTemplate", value)} placeholder="Example: RTS update for {customerName}: crew is on your job {jobId}." />
        <p className="rounded-xl bg-sand p-3 text-xs font-semibold text-black/45 lg:col-span-2">Available placeholders: {"{customerName}"}, {"{jobId}"}, {"{jobType}"}, and {"{dueDate}"}. This controls the Text button employees see in the field app.</p>
        <p className="rounded-xl bg-sand p-3 text-xs font-semibold text-black/45 lg:col-span-2">Quick note format: Button label | message saved to job | type. Good types: Note, Status, Customer, Parts, Time.</p>
        <Textarea label="Factory cost instructions" value={company.factoryCostInstructions} onChange={(value) => set("factoryCostInstructions", value)} placeholder="Tell employees what to enter on factory cost cards" />
        <div className="rounded-2xl border border-black/10 bg-white p-4 lg:col-span-2">
          <h3 className="font-black">Factory cost defaults</h3>
          <p className="mt-1 text-sm font-semibold text-black/45">Pre-fill common rates on factory job cost trackers. Jobs with saved numbers keep their own totals.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Mileage rate" value={company.factoryCostDefaults?.mileageRate || ""} onChange={(value) => setFactoryCostDefault("mileageRate", value)} placeholder="0.67" />
            <Input label="Hourly rate" value={company.factoryCostDefaults?.hourlyRate || ""} onChange={(value) => setFactoryCostDefault("hourlyRate", value)} placeholder="0" />
            <Input label="Helper rate" value={company.factoryCostDefaults?.helperRate || ""} onChange={(value) => setFactoryCostDefault("helperRate", value)} placeholder="0" />
            <Input label="Per diem rate" value={company.factoryCostDefaults?.perDiemRate || ""} onChange={(value) => setFactoryCostDefault("perDiemRate", value)} placeholder="0" />
          </div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-4 lg:col-span-2">
          <h3 className="font-black">Employee field permissions</h3>
          <p className="mt-1 text-sm font-semibold text-black/45">Saved admin controls for what crew members can do from the phone field app.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PermissionToggle title="Need Help" description="Show employee buttons to log a manager follow-up and call field support." checked={company.employeeCanRequestHelp} onChange={(value) => set("employeeCanRequestHelp", value)} />
            <PermissionToggle title="Start jobs" description="Allow employees to move assigned jobs into In Progress and create a time entry." checked={company.employeeCanStartJobs} onChange={(value) => set("employeeCanStartJobs", value)} />
            <PermissionToggle title="Quick notes" description="Allow Arrived, Blocked, Parts missing, and typed field notes." checked={company.employeeCanAddQuickNotes} onChange={(value) => set("employeeCanAddQuickNotes", value)} />
            <PermissionToggle title="Completion notes" description="Show the inline completion-notes box on employee job cards." checked={company.employeeCanAddCompletionNotes} onChange={(value) => set("employeeCanAddCompletionNotes", value)} />
            <PermissionToggle title="Photos and files" description="Show employee shortcuts for job photos and uploaded paperwork/files." checked={company.employeeCanUploadFiles} onChange={(value) => set("employeeCanUploadFiles", value)} />
            <PermissionToggle title="Parts requests" description="Show employee shortcut for parts needed and parts updates." checked={company.employeeCanRequestParts} onChange={(value) => set("employeeCanRequestParts", value)} />
            <PermissionToggle title="Factory costs" description="Allow employees to enter miles, drive time, hotel, material, and receipt totals on factory jobs." checked={company.employeeCanAddFactoryCosts} onChange={(value) => set("employeeCanAddFactoryCosts", value)} />
            <PermissionToggle title="Ready Review" description="Allow employees to send completed field work to manager inspection." checked={company.employeeCanSendReadyReview} onChange={(value) => set("employeeCanSendReadyReview", value)} />
            <PermissionToggle title="Customer sign-offs" description="Show employee shortcut for customer/dealer/factory signatures." checked={company.employeeCanAddSignoffs} onChange={(value) => set("employeeCanAddSignoffs", value)} />
            <PermissionToggle title="Closeout packets" description="Allow employees to open printable job packets from the phone." checked={company.employeeCanViewPackets} onChange={(value) => set("employeeCanViewPackets", value)} />
            <PermissionToggle title="Completed jobs" description="Show completed, billed, and paid jobs in the employee field app list." checked={company.showCompletedJobsInFieldApp} onChange={(value) => set("showCompletedJobsInFieldApp", value)} />
          </div>
        </div>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 lg:col-span-2">
          <input type="checkbox" checked={company.requireAfterPhotosToComplete} onChange={(event) => set("requireAfterPhotosToComplete", event.target.checked)} className="size-5 accent-forest" />
          <span><span className="block font-black">Require after photos before completing jobs</span><span className="block text-xs font-semibold text-black/45">This controls the manager completion workflow.</span></span>
        </label>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 lg:col-span-2">
          <input type="checkbox" checked={company.requireBeforePhotosForReview} onChange={(event) => set("requireBeforePhotosForReview", event.target.checked)} className="size-5 accent-forest" />
          <span><span className="block font-black">Require before photos before Ready Review</span><span className="block text-xs font-semibold text-black/45">Employees must add before photos before sending field work to manager review.</span></span>
        </label>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 lg:col-span-2">
          <input type="checkbox" checked={company.requireSerialTagPhotoForReview} onChange={(event) => set("requireSerialTagPhotoForReview", event.target.checked)} className="size-5 accent-forest" />
          <span><span className="block font-black">Require serial/VIN photo before Ready Review</span><span className="block text-xs font-semibold text-black/45">Employees must add serial/VIN tag proof before manager review.</span></span>
        </label>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 lg:col-span-2">
          <input type="checkbox" checked={company.requireDamagePhotosForReview} onChange={(event) => set("requireDamagePhotosForReview", event.target.checked)} className="size-5 accent-forest" />
          <span><span className="block font-black">Require damage photos before Ready Review</span><span className="block text-xs font-semibold text-black/45">Turn this on for businesses that need damage proof on every reviewed job.</span></span>
        </label>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 lg:col-span-2">
          <input type="checkbox" checked={company.requireAfterPhotosForReview} onChange={(event) => set("requireAfterPhotosForReview", event.target.checked)} className="size-5 accent-forest" />
          <span><span className="block font-black">Require after photos before Ready Review</span><span className="block text-xs font-semibold text-black/45">Employees must add after photos before sending field work to manager review.</span></span>
        </label>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 lg:col-span-2">
          <input type="checkbox" checked={company.requireCompletionNotesForReview} onChange={(event) => set("requireCompletionNotesForReview", event.target.checked)} className="size-5 accent-forest" />
          <span><span className="block font-black">Require completion notes before Ready Review</span><span className="block text-xs font-semibold text-black/45">Employees must add notes explaining what was finished before manager review.</span></span>
        </label>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 lg:col-span-2">
          <input type="checkbox" checked={company.requireWorkCompleteForReview} onChange={(event) => set("requireWorkCompleteForReview", event.target.checked)} className="size-5 accent-forest" />
          <span><span className="block font-black">Require work completed before Ready Review</span><span className="block text-xs font-semibold text-black/45">Employees must mark Work completed or move the job to a completion status before manager review.</span></span>
        </label>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 lg:col-span-2">
          <input type="checkbox" checked={company.requirePartsClosedForReview} onChange={(event) => set("requirePartsClosedForReview", event.target.checked)} className="size-5 accent-forest" />
          <span><span className="block font-black">Require parts closed before Ready Review</span><span className="block text-xs font-semibold text-black/45">Employees must clear open needed/ordered/picked-up parts before manager review.</span></span>
        </label>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 lg:col-span-2">
          <input type="checkbox" checked={company.requireFactoryCostsForReview} onChange={(event) => set("requireFactoryCostsForReview", event.target.checked)} className="size-5 accent-forest" />
          <span><span className="block font-black">Require factory costs before Ready Review</span><span className="block text-xs font-semibold text-black/45">Factory jobs must have cost entries before employees can send them to manager review.</span></span>
        </label>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 lg:col-span-2">
          <input type="checkbox" checked={company.requireReceiptBackupForReview} onChange={(event) => set("requireReceiptBackupForReview", event.target.checked)} className="size-5 accent-forest" />
          <span><span className="block font-black">Require receipt backup before Ready Review</span><span className="block text-xs font-semibold text-black/45">If a job has receipt or factory receipt dollars, employees must add receipt backup before Ready Review.</span></span>
        </label>
        <button className="btn-primary lg:col-span-2">Save Field App Options</button>
      </form>
    </section>

    <section className="card p-4 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-800"><BellAlertIcon className="size-5" /></span>
        <div><h2 className="text-lg font-black">Cleanup tools</h2><p className="text-sm text-black/45">Admin-only helper for removing obvious smoke/test/sample/demo records after verification.</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
        <button type="button" onClick={previewCleanup} className="btn-secondary">Preview Test Data</button>
        <p className="text-sm font-semibold text-black/45">Preview first. Delete requires typing an exact confirmation phrase.</p>
      </div>
      {cleanup && <div className="mt-4 rounded-2xl bg-sand p-4">
        <p className="font-black">{cleanup.testJobs.length} test jobs · {cleanup.smokeTestFiles.length} smoke-test files found</p>
        <div className="mt-2 max-h-32 overflow-auto text-sm text-black/55">
          {cleanup.testJobs.map((job) => <p key={job.jobId}>{job.jobId} — {job.customerName}</p>)}
          {cleanup.smokeTestFiles.map((file) => <p key={file}>{file}</p>)}
          {!cleanup.testJobs.length && !cleanup.smokeTestFiles.length && <p>No obvious test records found.</p>}
        </div>
        {(cleanup.testJobs.length > 0 || cleanup.smokeTestFiles.length > 0) && <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input className="field" value={cleanupConfirm} onChange={(event) => setCleanupConfirm(event.target.value)} placeholder="Type DELETE TEST DATA" />
          <button type="button" onClick={runCleanup} className="min-h-12 rounded-xl bg-red-600 px-4 py-3 font-black text-white">Delete Test Data</button>
        </div>}
      </div>}
    </section>

    <section className="card overflow-hidden">
      <div className="bg-ink p-5 text-white sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime text-ink"><ShoppingBagIcon className="size-6" /></span>
          <div>
            <h2 className="text-2xl font-black">Crew merchandise</h2>
            <p className="mt-1 text-sm text-white/60">Crew members can request shirts, hats, cups, hoodies, or safety gear.</p>
          </div>
        </div>
        {company.merchandiseLink && <a href={company.merchandiseLink} target="_blank" className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime px-4 py-3 font-black text-ink sm:w-auto">Open company shop <ArrowTopRightOnSquareIcon className="size-5" /></a>}
      </div>
      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[.9fr_1fr]">
        <form onSubmit={submitMerch} className="grid gap-3">
          <Select label="Item" name="item" options={["Shirt", "Hat", "Cup", "Hoodie", "Jacket", "Safety vest", "Other"]} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Size" name="size" placeholder="L / XL / 2XL" />
            <Input label="Color" name="color" placeholder="Black / Gray" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantity" name="quantity" placeholder="1" />
            <Input label="Requested by" name="requestedBy" placeholder="Employee name" />
          </div>
          <label><span className="label">Notes</span><textarea name="notes" className="field min-h-24 resize-y" placeholder="Example: long sleeve, logo on back, needs by Friday" /></label>
          <button className="btn-primary">Submit Merch Request</button>
        </form>
        <div>
          <h3 className="mb-3 font-black">Recent requests</h3>
          <div className="space-y-2">
            {merchSummary.length ? merchSummary.map((request) => <div key={request.id} className="rounded-xl bg-sand p-3">
              <div className="flex justify-between gap-3"><p className="font-extrabold">{request.quantity}× {request.item}</p><p className="text-xs font-bold text-black/40">{new Date(request.createdAt).toLocaleDateString()}</p></div>
              <p className="text-sm font-semibold text-black/55">{[request.size, request.color, request.requestedBy].filter(Boolean).join(" · ") || "No details"}</p>
              {request.notes && <p className="mt-1 text-xs text-black/50">{request.notes}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(["Requested", "Approved", "Ordered", "Received"] as MerchRequestStatus[]).map((status) => <button key={status} type="button" onClick={() => updateRequestStatus(request.id, status)} className={`rounded-full px-3 py-1 text-[11px] font-black ${request.status === status ? "bg-forest text-white" : "bg-white text-black/45"}`}>{status}</button>)}
              </div>
            </div>) : <p className="rounded-xl bg-sand p-3 text-sm font-semibold text-black/45">No merchandise requests yet.</p>}
          </div>
        </div>
      </div>
    </section>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/10 p-3">
    <p className="text-2xl font-black text-lime">{value}</p>
    <p className="text-[11px] font-black uppercase tracking-wide text-white/45">{label}</p>
  </div>;
}

function ReadinessRow({ title, detail, done }: { title: string; detail: string; done: boolean }) {
  return <div className="flex items-start justify-between gap-3 p-4">
    <div>
      <p className="font-black">{title}</p>
      <p className="mt-1 text-sm font-semibold text-black/50">{detail}</p>
    </div>
    <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${done ? "bg-forest text-white" : "bg-orange-100 text-orange-800"}`}>{done ? "Ready" : "Needed"}</span>
  </div>;
}

function AdminControlMap({ employees, users }: { employees: number; users: number }) {
  const roleCards = [
    { title: "Admin", detail: "Company settings, users, employees, integrations, cleanup, billing, and full job control.", tone: "bg-ink text-white" },
    { title: "Manager", detail: "Jobs, scheduling, dispatch, employees, communication, documents, inspection, and billing queues.", tone: "bg-forest text-white" },
    { title: "Employee", detail: "Assigned field jobs, checklist, photos/files, notes, time log, sign-off, and Ready Review.", tone: "bg-sand text-ink" },
  ];
  const adminRules = [
    { title: "Real jobs only for external apps", detail: "CompanyCam and Google Calendar stay job-by-job. Do not sync sample/mock jobs.", href: "/schedule" },
    { title: "Employees see assigned work", detail: "Assign one employee, multiple employees, or Full Crew from the job edit screen.", href: "/employees" },
    { title: "Closeout goes to manager", detail: "Crew taps Ready Review; manager approves or sends back before billing.", href: "/ready-check" },
    { title: "Communication is logged first", detail: "The app prepares texts/messages and records notices; automatic sending is a future decision.", href: "/communication" },
  ];
  return <section className="card overflow-hidden">
    <div className="bg-ink p-5 text-white sm:p-6">
      <p className="text-xs font-black uppercase tracking-widest text-lime">Admin control map</p>
      <h2 className="mt-1 text-2xl font-black">Employee-friendly app, admin-controlled setup</h2>
      <p className="mt-1 text-sm text-white/60">Use this as the plain-English owner screen for deciding who can do what and what still needs setup.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Active employees" value={String(employees)} />
        <Stat label="App users" value={String(users)} />
        <Stat label="Employee home" value="/field" />
        <Stat label="Admin home" value="/settings" />
      </div>
    </div>
    <div className="grid gap-4 p-4 lg:grid-cols-[.85fr_1.15fr] sm:p-6">
      <div>
        <h3 className="mb-3 font-black">Role split</h3>
        <div className="grid gap-3">
          {roleCards.map((card) => <div key={card.title} className={`rounded-2xl p-4 ${card.tone}`}>
            <p className="text-lg font-black">{card.title}</p>
            <p className={`mt-1 text-sm font-semibold ${card.title === "Employee" ? "text-black/55" : "text-white/65"}`}>{card.detail}</p>
          </div>)}
        </div>
      </div>
      <div>
        <h3 className="mb-3 font-black">Operating rules</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {adminRules.map((rule) => <Link key={rule.title} href={rule.href} className="rounded-2xl border border-black/10 bg-sand p-4 active:scale-[.99]">
            <p className="font-black">{rule.title}</p>
            <p className="mt-1 text-sm font-semibold text-black/50">{rule.detail}</p>
            <span className="mt-3 inline-flex min-h-9 items-center rounded-xl bg-white px-3 py-2 text-xs font-black text-forest">Open setup area</span>
          </Link>)}
        </div>
      </div>
    </div>
  </section>;
}

function buildCrewInvite(company: BusinessSettings) {
  return [
    `Company Command field app`,
    "",
    `Open: https://rts-field-app.vercel.app`,
    "",
    `Use your assigned login. After you log in, go to My Jobs / Field App.`,
    "",
    `Install on iPhone: open the link in Safari, tap Share, then Add to Home Screen.`,
    `Install on Android: open the link in Chrome, tap the menu, then Install app or Add to Home screen.`,
    "",
    company.employeeFieldNotice || "Open your assigned job, check the scope, take required photos, add notes, and tap Ready Review when field work is complete.",
    "",
    `If you cannot see your jobs, ask admin to link your login to your employee name.`,
  ].join("\n");
}

function buildIntegrationNextSteps(integrations: IntegrationStatus, setupStatus: SetupStatus) {
  return [
    {
      title: "CompanyCam photo projects",
      done: Boolean(integrations.companyCam),
      detail: integrations.companyCam
        ? `CompanyCam token is present${setupStatus.companyCamUserEmail ? " and user email is set" : "; add COMPANYCAM_USER_EMAIL if CompanyCam requires user context"}.`
        : "Add the CompanyCam access token in Vercel, then create/open projects from real job profiles only.",
      href: "/settings",
    },
    {
      title: "Google Calendar scheduling",
      done: Boolean(integrations.googleCalendar),
      detail: integrations.googleCalendar
        ? `Google Calendar credentials are present. Target calendar: ${setupStatus.googleCalendarId || "primary"}.`
        : "Add Google OAuth credentials in Vercel. Until then, use the safe Google quick-add buttons on real jobs.",
      href: "/schedule",
    },
    {
      title: "AI work-order extraction",
      done: Boolean(integrations.openAiExtraction),
      detail: integrations.openAiExtraction
        ? "OpenAI key is present. Next sprint can wire true photo/PDF extraction behind the Import screen."
        : "Add OPENAI_API_KEY when ready. Current import still stores files and parses pasted work-order text.",
      href: "/import",
    },
    {
      title: "Invoice/payment handoff",
      done: Boolean(integrations.invoiceSimple),
      detail: integrations.invoiceSimple
        ? "Invoice Simple key is present, but automated invoice creation should still wait for account/workflow confirmation."
        : "Manual billing queue, copy summaries, invoice sent, on-hold, and paid tracking are working now.",
      href: "/billing",
    },
    {
      title: "Communication hub",
      done: Boolean(integrations.zenzap),
      detail: integrations.zenzap
        ? "ZenZap API key is present. External message sync still needs a workflow decision before sending anything."
        : "Built-in job notes, reminders, and follow-up tracking work now; no outside messages send automatically.",
      href: "/communication",
    },
  ];
}

function Input({ label, value, onChange, name, placeholder, wide }: { label: string; value?: string; onChange?: (value: string) => void; name?: string; placeholder?: string; wide?: boolean }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="label">{label}</span><input className="field" name={name} value={value} placeholder={placeholder} onChange={onChange ? (event) => onChange(event.target.value) : undefined} /></label>;
}

function Textarea({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="sm:col-span-2"><span className="label">{label}</span><textarea className="field min-h-28 resize-y" value={value || ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, name, options, optionLabels = {} }: { label: string; name: string; options: string[]; optionLabels?: Record<string, string> }) {
  return <label><span className="label">{label}</span><select className="field" name={name}>{options.map((option) => <option key={option || "blank"} value={option}>{optionLabels[option] || option}</option>)}</select></label>;
}

function ListEditor({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string }) {
  return <label>
    <span className="label">{label}</span>
    <textarea className="field min-h-36 resize-y" value={(values || []).join("\n")} placeholder={placeholder} onChange={(event) => onChange(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} />
    <span className="mt-1 block text-xs font-semibold text-black/40">One option per line.</span>
  </label>;
}

function Toggle({ title, description, defaultChecked }: { title: string; description: string; defaultChecked?: boolean }) {
  return <label className="flex min-h-14 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3">
    <input type="checkbox" defaultChecked={defaultChecked} className="size-5 accent-forest" />
    <span><span className="block font-black">{title}</span><span className="block text-xs font-semibold text-black/45">{description}</span></span>
  </label>;
}

function PermissionToggle({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 ${checked ? "border-forest/20 bg-forest/5" : "border-orange-200 bg-orange-50"}`}>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-5 accent-forest" />
    <span><span className="block font-black">{title}</span><span className="block text-xs font-semibold text-black/45">{description}</span></span>
  </label>;
}
