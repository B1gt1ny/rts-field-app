"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowPathIcon, ArrowTopRightOnSquareIcon, BanknotesIcon, CalendarDaysIcon, CameraIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, CheckIcon, ClipboardDocumentListIcon, ClockIcon, MapPinIcon, PencilSquareIcon, PhoneIcon, PrinterIcon, ReceiptPercentIcon, ShareIcon, UserGroupIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { defaultFactoryCost, makeChecklist, type BusinessSettings, type CustomerSurvey, type FactoryCostTracker, type FileCategory, type Job, type JobActivity, type PaperworkItem, type PartItem, type ReceiptItem, type SignoffItem, type TimeEntry, type WorkOrderFile } from "@/lib/types";
import { PriorityBadge, StatusBadge } from "./StatusBadge";
import { authFetch } from "@/lib/client-auth";
import { getFactoryCostTotals, hasFactoryCostWork } from "@/lib/factory-costs";
import { isReceiptBackupMissing } from "@/lib/receipt-backup";
import { activeCorrectionCategories, billingBlockers, buildCorrectionActivity, checklistProgress, closeoutChecks, correctionCategories, correctionCategoryComplete, correctionResolutionPatch, dispatchBlockers, dispatchReadinessScore, hasActiveCorrections, intakeCompleteness, readinessScore, type CorrectionCategory } from "@/lib/job-readiness";
import { useAuthUser } from "./AuthGate";

type CompanyCamState = {
  configured: boolean;
  connected: boolean;
  photoCount: number | null;
  projectId?: string;
  projectUrl?: string | null;
  photos?: { id: string; thumbnailUrl?: string; createdAt?: string }[];
  photoError?: string;
  error?: string;
};

type WorkspaceSectionId = "overview" | "checklist" | "photos" | "parts" | "documents" | "notes" | "time" | "closeout" | "history";

export function JobDetail({ initialJob }: { initialJob: Job }) {
  const user = useAuthUser();
  const [job, setJob] = useState<Job>({
    ...initialJob,
    checklist: initialJob.checklist?.length ? initialJob.checklist : makeChecklist(),
    activityLog: initialJob.activityLog || [],
    paperworkItems: initialJob.paperworkItems || defaultPaperwork(initialJob),
    receipts: initialJob.receipts || [],
    partsItems: initialJob.partsItems || [],
    timeEntries: initialJob.timeEntries || [],
    signoffs: initialJob.signoffs || [],
    factoryCost: initialJob.factoryCost || defaultFactoryCost(),
    workOrderFiles: initialJob.workOrderFiles || [],
  });
  const [saving, setSaving] = useState(false);
  const [detailMessage, setDetailMessage] = useState("");
  const [openSection, setOpenSection] = useState<WorkspaceSectionId>("overview");
  const [companyCam, setCompanyCam] = useState<CompanyCamState>({
    configured: false,
    connected: Boolean(initialJob.companyCamProjectId),
    photoCount: null,
    projectId: initialJob.companyCamProjectId,
    projectUrl: initialJob.companyCamProjectUrl,
  });
  const checklist = checklistProgress(job);
  const complete = checklist.complete;
  const checklistPercent = checklist.percent;
  const isEmployee = user?.role === "Employee";
  const canManageJob = !isEmployee;
  async function saveJobPatch(patch: Partial<Job>) {
    setSaving(true);
    setDetailMessage("");
    const next = { ...job, ...patch };
    const correctionPatch = correctionResolutionPatch(job, next);
    const finalNext = { ...next, ...correctionPatch };
    const patchToSave = { ...patch, ...correctionPatch };
    setJob(finalNext);
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patchToSave) });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || "The job update could not be saved.");
      setJob((old) => ({ ...old, ...saved, checklist: saved.checklist?.length ? saved.checklist : old.checklist }));
      return saved as Job;
    } catch (caught) {
      setDetailMessage(caught instanceof Error ? caught.message : "The job update could not be saved.");
      setJob(job);
      return undefined;
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    let active = true;
    authFetch(`/api/jobs/${job.jobId}/companycam`)
      .then(async (response) => {
        if (!response.ok) throw new Error("CompanyCam status could not be loaded.");
        return response.json();
      })
      .then((status) => { if (active) setCompanyCam((old) => ({ ...old, ...status })); })
      .catch(() => { if (active) setCompanyCam((old) => ({ ...old, error: "CompanyCam status could not be loaded." })); });
    return () => { active = false; };
  }, [job.jobId]);
  useEffect(() => {
    const openFromHash = () => {
      const hash = window.location.hash.replace("#", "");
      const section = sectionForAnchor(hash);
      if (section) {
        setOpenSection(section);
        window.setTimeout(() => {
          (document.getElementById(hash) || document.getElementById(`${section}-workspace`))?.scrollIntoView({ block: "start" });
        }, 0);
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);
  async function toggle(id: string) {
    const checklist = job.checklist.map((item) => item.id === id ? { ...item, complete: !item.complete } : item);
    await saveJobPatch({ checklist });
  }
  async function startWorkSession() {
    const session = getWorkSession(job);
    if (session.active) return;
    const employeeName = user?.employeeName || user?.email || "Field";
    const now = new Date().toISOString();
    const entry: TimeEntry = {
      id: `time-${Date.now()}`,
      type: "Work started",
      employeeName,
      createdAt: now,
      notes: "Started from Job Detail.",
    };
    const activity: JobActivity = {
      id: `activity-${Date.now()}`,
      type: "Time",
      message: "Started Job",
      createdAt: now,
      createdBy: employeeName,
      audience: "All",
    };
    await saveJobPatch({
      status: ["New", "Scheduled"].includes(job.status) ? "In Progress" : job.status,
      timeEntries: [entry, ...(job.timeEntries || [])].slice(0, 100),
      activityLog: [activity, ...(job.activityLog || [])].slice(0, 50),
    });
  }
  async function finishWorkSession() {
    const session = getWorkSession(job);
    if (!session.active) return;
    const employeeName = user?.employeeName || user?.email || "Field";
    const now = new Date().toISOString();
    const entry: TimeEntry = {
      id: `time-${Date.now()}`,
      type: "Departed",
      employeeName,
      createdAt: now,
      notes: "Finished work session from Job Detail.",
    };
    const activity: JobActivity = {
      id: `activity-${Date.now()}`,
      type: "Time",
      message: "Finished Work",
      createdAt: now,
      createdBy: employeeName,
      audience: "All",
    };
    await saveJobPatch({
      timeEntries: [entry, ...(job.timeEntries || [])].slice(0, 100),
      activityLog: [activity, ...(job.activityLog || [])].slice(0, 50),
    });
  }
  return <>
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <p className="mb-1 text-sm font-extrabold uppercase tracking-widest text-forest">{job.jobId} · {job.source}</p>
        <h1 className="text-3xl font-black tracking-tight">{job.customerName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge status={job.status} />{hasActiveCorrections(job) && <NeedsCorrectionBadge />}<PriorityBadge priority={job.priority} /></div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-black/45">
          <span className="rounded-full bg-sand px-3 py-1">{formatJobDate(job.dueDate)}</span>
          <span className="rounded-full bg-sand px-3 py-1">{job.assignedCrew || "Unassigned"}</span>
        </div>
      </div>
      {canManageJob && <div className="flex gap-2 print:hidden">
        <Link href={`/jobs/${job.jobId}/packet`} className="btn-secondary !px-3 sm:!px-4"><ClipboardDocumentListIcon className="size-5" /><span className="hidden sm:inline">Packet</span></Link>
        <button type="button" onClick={() => window.print()} className="btn-secondary !px-3 sm:!px-4"><PrinterIcon className="size-5" /><span className="hidden sm:inline">Print</span></button>
        <Link href={`/jobs/${job.jobId}/edit`} className="btn-secondary !px-3 sm:!px-4"><PencilSquareIcon className="size-5" /><span className="hidden sm:inline">Edit</span></Link>
      </div>}
    </div>
    <JobWorkflowGuide job={job} canManageJob={canManageJob} />
    <WorkSessionPanel job={job} saving={saving} canStart={!canManageJob} onStart={startWorkSession} />
    {canManageJob && <ManagerOperationalSummary job={job} />}
    <CorrectionSummary job={job} />
    {detailMessage && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{detailMessage}</p>}
    <div className="space-y-3">
      <WorkspaceSection id="overview" title="Overview" summary={`${job.jobId} · ${job.status} · ${job.assignedCrew || "Unassigned"}`} openSection={openSection} setOpenSection={setOpenSection}>
        <OverviewPanel job={job} companyCam={companyCam} />
        {canManageJob && <IntakeCompletenessPanel job={job} />}
        <CalendarPanel job={job} setJob={setJob} />
        <ProfileSheetPanel job={job} />
        <ScopePanel job={job} />
      </WorkspaceSection>
      <WorkspaceSection id="checklist" title="Checklist" summary={`${complete} of ${checklist.total} complete`} openSection={openSection} setOpenSection={setOpenSection}>
        <ChecklistPanel job={job} saving={saving} complete={complete} percent={checklistPercent} onToggle={toggle} />
      </WorkspaceSection>
      <WorkspaceSection id="photos" title="Photos" summary={`${photoTotal(job)} saved`} openSection={openSection} setOpenSection={setOpenSection}>
        <PhotoUploadPanel job={job} saving={saving} onSave={saveJobPatch} />
        {canManageJob && <details id="companycam" className="scroll-mt-24">
          <summary className="cursor-pointer rounded-xl border border-black/10 bg-white px-4 py-3 text-lg font-black">More actions / CompanyCam fallback</summary>
          <div className="mt-4">
            <CompanyCamPanel job={job} status={companyCam} setStatus={setCompanyCam} onJobSynced={setJob} />
          </div>
        </details>}
      </WorkspaceSection>
      <WorkspaceSection id="parts" title="Parts" summary={`${job.partsItems?.length || 0} tracked`} openSection={openSection} setOpenSection={setOpenSection}>
        <PartsPanel job={job} saving={saving} onSave={saveJobPatch} />
      </WorkspaceSection>
      <WorkspaceSection id="documents" title="Documents" summary={`${(job.workOrderFiles || []).length} files · ${(job.receipts || []).length} receipts`} openSection={openSection} setOpenSection={setOpenSection}>
        <OperationsPanel job={job} setJob={setJob} mode="documents" />
      </WorkspaceSection>
      <WorkspaceSection id="notes" title="Notes" summary={`${job.activityLog?.length || 0} activity notes`} openSection={openSection} setOpenSection={setOpenSection}>
        <AdditionalIssuePanel job={job} saving={saving} onSave={saveJobPatch} />
        <CommunicationHandoffPanel job={job} saving={saving} onSave={saveJobPatch} />
        <OperationsPanel job={job} setJob={setJob} mode="notes" />
        <OfflineDraftPanel job={job} saving={saving} onSave={saveJobPatch} />
        {job.completionNotes && <section className="card p-4 sm:p-6"><h2 className="mb-2 text-lg font-black">Completion notes</h2><p className="text-black/65">{job.completionNotes}</p></section>}
      </WorkspaceSection>
      <WorkspaceSection id="time" title="Time" summary={`${job.timeEntries?.length || 0} entries`} openSection={openSection} setOpenSection={setOpenSection}>
        <TimeLogPanel job={job} saving={saving} onSave={saveJobPatch} />
        <FactoryCostTrackerPanel job={job} saving={saving} onSave={saveJobPatch} />
      </WorkspaceSection>
      <WorkspaceSection id="closeout" title="Closeout" summary={`${readinessScore(job)}% billing ready`} openSection={openSection} setOpenSection={setOpenSection}>
        <GuidedCloseoutPanel job={job} canManageJob={canManageJob} />
        {canManageJob && <CloseoutQualityPanel job={job} />}
        {canManageJob && <ManagerCorrectionPanel job={job} saving={saving} onSave={saveJobPatch} />}
        <CompleteJobFlow job={job} saving={saving} canManageJob={canManageJob} onFinishWork={finishWorkSession} onSave={saveJobPatch} />
        <SignoffPanel job={job} saving={saving} onSave={saveJobPatch} />
        <CustomerSurveyPanel job={job} saving={saving} onSave={saveJobPatch} />
        {canManageJob && <BillingHandoffPanel job={job} saving={saving} onSave={saveJobPatch} />}
      </WorkspaceSection>
      <WorkspaceSection id="history" title="History" summary={`${job.activityLog?.length || 0} records`} openSection={openSection} setOpenSection={setOpenSection}>
        <OperationsPanel job={job} setJob={setJob} mode="history" />
      </WorkspaceSection>
    </div>
  </>;
}

function sectionForAnchor(anchor: string): WorkspaceSectionId | undefined {
  if (["overview", "profile-sheet", "scheduling"].includes(anchor)) return "overview";
  if (anchor === "checklist") return "checklist";
  if (["photos", "companycam"].includes(anchor)) return "photos";
  if (["parts", "parts-needed"].includes(anchor)) return "parts";
  if (["documents", "paperwork", "receipts"].includes(anchor)) return "documents";
  if (["notes", "operations", "communication-handoff", "additional-issue"].includes(anchor)) return "notes";
  if (["time", "time-log", "factory-costs"].includes(anchor)) return "time";
  if (["closeout", "complete-job", "signoffs", "customer-survey", "billing-handoff"].includes(anchor)) return "closeout";
  if (anchor === "history") return "history";
  return undefined;
}

function NeedsCorrectionBadge() {
  return <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-extrabold text-orange-800">Needs Correction</span>;
}

function ManagerOperationalSummary({ job }: { job: Job }) {
  const entries = job.timeEntries || [];
  const mileage = entries.reduce((total, entry) => total + (Number(entry.mileage) || 0), 0);
  const helperHours = Number(job.factoryCost?.helperHours) || 0;
  const receiptTotal = (job.receipts || []).reduce((total, receipt) => total + (Number(receipt.amount) || 0), 0);
  const receiptFiles = summarizeFiles(job).receipts;
  const metrics = [
    { label: "Work time", value: formatEntryDuration(entries, "Work started", "Departed") },
    { label: "Drive time", value: formatTravelDuration(entries) },
    { label: "Mileage", value: `${mileage.toFixed(1)} mi` },
    { label: "Helper time", value: helperHours ? `${formatHours(helperHours)} tracked` : "Not tracked" },
    { label: "Receipts / expenses", value: `${(job.receipts || []).length} tracked · $${receiptTotal.toFixed(2)}${receiptFiles ? ` · ${receiptFiles} file${receiptFiles === 1 ? "" : "s"}` : ""}` },
  ];

  return <section className="card mb-5 p-4 sm:p-5">
    <div className="mb-4"><p className="text-xs font-black uppercase tracking-widest text-forest">Manager review</p><h2 className="mt-1 text-lg font-black">Operational summary</h2><p className="mt-1 text-sm text-black/50">Read-only job totals from existing field logs, helper tracking, and receipts.</p></div>
    <div className="grid gap-2 sm:grid-cols-5">{metrics.map((metric) => <div key={metric.label} className="rounded-xl bg-sand p-3"><p className="text-xs font-bold uppercase tracking-wide text-black/45">{metric.label}</p><p className="mt-1 font-black text-ink">{metric.value}</p></div>)}</div>
  </section>;
}

function formatEntryDuration(entries: TimeEntry[], startType: TimeEntry["type"], endType: TimeEntry["type"]) {
  const ordered = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let startedAt = "";
  let totalMinutes = 0;
  for (const entry of ordered) {
    if (entry.type === startType) startedAt = entry.createdAt;
    if (entry.type === endType && startedAt) {
      totalMinutes += Math.max(0, Math.round((new Date(entry.createdAt).getTime() - new Date(startedAt).getTime()) / 60000));
      startedAt = "";
    }
  }
  if (startedAt) totalMinutes += Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
  return formatMinutes(totalMinutes);
}

function formatTravelDuration(entries: TimeEntry[]) {
  const ordered = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let startedAt = "";
  let totalMinutes = 0;
  for (const entry of ordered) {
    if (entry.notes === "Started Travel") startedAt = entry.createdAt;
    if (entry.type === "Arrived" && startedAt) {
      totalMinutes += Math.max(0, Math.round((new Date(entry.createdAt).getTime() - new Date(startedAt).getTime()) / 60000));
      startedAt = "";
    }
  }
  if (startedAt) totalMinutes += Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
  return formatMinutes(totalMinutes);
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatHours(hours: number) {
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded}h`;
}

function CorrectionSummary({ job }: { job: Job }) {
  const categories = activeCorrectionCategories(job);
  if (!categories.length) return null;
  return <section className="card mb-5 p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-black uppercase tracking-widest text-orange-700">Needs Correction</p><h2 className="mt-1 text-lg font-black">Correction summary</h2></div>
      <div className="flex flex-wrap gap-2">{categories.map((category) => <a key={category} href={correctionHref(category)} className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-800">{category}</a>)}</div>
    </div>
  </section>;
}

function ManagerCorrectionPanel({ job, saving, onSave }: { job: Job; saving: boolean; onSave: (patch: Partial<Job>) => Promise<Job | undefined> }) {
  const active = activeCorrectionCategories(job);
  const [selected, setSelected] = useState<CorrectionCategory[]>(active);

  useEffect(() => { setSelected(active); }, [active.join("|")]);

  async function markCorrection() {
    if (!selected.length) return;
    await onSave({
      status: "Needs Inspection",
      activityLog: [buildCorrectionActivity(selected), ...(job.activityLog || [])].slice(0, 50),
    });
  }

  return <section className="card p-4 sm:p-6">
    <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-black">Manager corrections</h2><p className="mt-1 text-sm text-black/50">Mark the closeout sections that need the crew&apos;s attention.</p></div>{active.length > 0 && <NeedsCorrectionBadge />}</div>
    <div className="grid gap-2 sm:grid-cols-4">{correctionCategories.map((category) => {
      const checked = selected.includes(category);
      return <label key={category} className={`flex min-h-12 items-center gap-3 rounded-xl border p-3 text-sm font-bold ${checked ? "border-orange-200 bg-orange-50 text-orange-900" : "border-black/10 bg-white text-ink"}`}><input type="checkbox" checked={checked} onChange={(event) => setSelected((old) => event.target.checked ? [...old, category] : old.filter((item) => item !== category))} className="size-5 accent-forest" />{category}</label>;
    })}</div>
    {active.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-4">{active.map((category) => <a key={category} href={correctionHref(category)} className={`rounded-xl p-3 text-sm font-bold ${correctionCategoryComplete(job, category) ? "bg-forest/5 text-forest" : "bg-orange-50 text-orange-800"}`}><span className="block text-[11px] font-black uppercase tracking-wide">{correctionCategoryComplete(job, category) ? "Ready" : "Open"}</span>{category}</a>)}</div>}
    <button type="button" disabled={saving || !selected.length} onClick={markCorrection} className="mt-4 min-h-12 w-full rounded-xl bg-orange-100 px-4 py-3 font-black text-orange-900 disabled:opacity-50">{saving ? "Saving..." : "Mark Needs Correction"}</button>
  </section>;
}

function correctionHref(category: CorrectionCategory) {
  if (category === "Photos") return "#photos";
  if (category === "Paperwork") return "#paperwork";
  if (category === "Checklist") return "#checklist";
  return "#complete-job";
}

function WorkspaceSection({ id, title, summary, openSection, setOpenSection, children }: { id: WorkspaceSectionId; title: string; summary: string; openSection: WorkspaceSectionId; setOpenSection: (section: WorkspaceSectionId) => void; children: React.ReactNode }) {
  const open = openSection === id;
  return <section id={`${id}-workspace`} className="scroll-mt-24">
    <button type="button" onClick={() => setOpenSection(id)} className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left ${open ? "border-forest/20 bg-forest/5" : "border-black/10 bg-white"}`}>
      <span>
        <span className="block text-lg font-black">{title}</span>
        <span className="mt-0.5 block text-xs font-bold text-black/45">{summary}</span>
      </span>
      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${open ? "bg-forest text-white" : "bg-sand text-black/45"}`}>{open ? "Open" : "View"}</span>
    </button>
    {open && <div className="mt-3 space-y-5">{children}</div>}
  </section>;
}

function WorkSessionPanel({ job, saving, canStart, onStart }: { job: Job; saving: boolean; canStart: boolean; onStart: () => void }) {
  const session = getWorkSession(job);
  const started = session.started?.createdAt;
  if (!started) {
    return <section className="card mb-5 p-4 sm:p-6">
      {canStart ? <button type="button" disabled={saving} onClick={onStart} className="min-h-14 w-full rounded-xl bg-forest px-4 py-4 text-lg font-black text-white disabled:opacity-50">{saving ? "Saving..." : "START JOB"}</button> : <div className="rounded-xl bg-sand p-4 text-center font-black text-black/55">Not Started</div>}
    </section>;
  }
  return <section className="card mb-5 p-4 sm:p-6">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-forest">Work Session</p>
        <h2 className="mt-1 text-xl font-black">{session.active ? "CONTINUE JOB" : "Work Session Finished"}</h2>
      </div>
      {canStart && (session.active ? <a href="#photos" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-forest px-4 py-3 font-black text-white">CONTINUE JOB</a> : <button type="button" disabled={saving} onClick={onStart} className="min-h-12 rounded-xl bg-forest px-4 py-3 font-black text-white disabled:opacity-50">{saving ? "Saving..." : "CONTINUE JOB"}</button>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-4">
      <MiniMetric label="Started" value={formatSessionDate(started)} icon={<ClockIcon />} />
      <MiniMetric label="Elapsed time" value={formatElapsed(started, session.finished?.createdAt)} icon={<ClockIcon />} />
      <MiniMetric label="Crew" value={job.assignedCrew || "Unassigned"} icon={<UserGroupIcon />} />
      <MiniMetric label="Current status" value={job.status} icon={<ClipboardDocumentListIcon />} />
    </div>
  </section>;
}

function OverviewPanel({ job, companyCam }: { job: Job; companyCam: CompanyCamState }) {
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city}`)}`;
  return <section className="card p-4 sm:p-6">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-black">Job information</h2>
        <p className="text-sm font-semibold text-black/45">{job.source}{job.dealerName ? ` · ${job.dealerName}` : ""}{job.factoryWorkOrderNumber ? ` · WO ${job.factoryWorkOrderNumber}` : ""}</p>
      </div>
      <div className="flex flex-wrap gap-2"><StatusBadge status={job.status} /><PriorityBadge priority={job.priority} /></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Info icon={<ClipboardDocumentListIcon />} label="Job ID">{job.jobId}</Info>
      <Info icon={<UserGroupIcon />} label="Customer">{job.customerName}</Info>
      <Info icon={<MapPinIcon />} label="Address">{job.address}<br />{job.city}</Info>
      <Info icon={<PhoneIcon />} label="Phone">{job.phone || "Not provided"}</Info>
      <Info icon={<ClipboardDocumentListIcon />} label="Dealer / Factory">{job.dealerName || job.factoryWorkOrderNumber || job.source}</Info>
      {job.serialUnitNumber && <Info icon={<WrenchScrewdriverIcon />} label="Serial / unit number">{job.serialUnitNumber}</Info>}
      {job.returnVisitRequired && <Info icon={<ArrowPathIcon />} label="Return visit required">Yes</Info>}
      <Info icon={<UserGroupIcon />} label="Assigned employees">{job.assignedCrew || "Unassigned"}</Info>
      <Info icon={<CalendarDaysIcon />} label="Due date">{formatJobDate(job.dueDate)}</Info>
      <Info icon={<CameraIcon />} label="CompanyCam">{companyCam.projectUrl ? "Linked" : companyCam.configured ? "Ready" : "Not connected"}</Info>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      <a href={mapsUrl} target="_blank" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 font-black text-white"><MapPinIcon className="size-5" />Open Maps</a>
      <a href={`tel:${job.phone}`} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black ${job.phone ? "text-ink" : "pointer-events-none text-black/25"}`}><PhoneIcon className="size-5" />Call Customer</a>
    </div>
  </section>;
}

function IntakeCompletenessPanel({ job }: { job: Job }) {
  const intake = intakeCompleteness(job);
  const missing = intake.core.filter((check) => !check.ok);
  const scheduling = intake.scheduling.filter((check) => !check.ok);
  const optionalRecorded = intake.optional.filter((check) => check.ok).length;
  return <section className={`mb-4 rounded-2xl border p-4 ${intake.complete ? "border-forest/20 bg-forest/5" : "border-orange-200 bg-orange-50"}`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className={`text-xs font-black uppercase tracking-widest ${intake.complete ? "text-forest" : "text-orange-800"}`}>Office intake check</p>
        <h2 className="mt-1 text-lg font-black">{intake.complete ? "Intake Complete" : "Intake Needs Information"}</h2>
        <p className="mt-1 text-sm text-black/55">{missing.length ? `${missing.length} core item${missing.length === 1 ? "" : "s"} missing` : "Core customer and work details are recorded."}</p>
      </div>
      <Link href={`/jobs/${job.jobId}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-black text-ink">Edit intake</Link>
    </div>
    {missing.length > 0 && <ul className="mt-3 grid gap-2 sm:grid-cols-2">{missing.map((check) => <li key={check.label} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-orange-950">{check.label}</li>)}</ul>}
    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-black/55">
      <span className="rounded-full bg-white px-3 py-1">Scheduling: {scheduling.length ? scheduling.map((check) => check.label).join(", ") : "date and crew assigned"}</span>
      <span className="rounded-full bg-white px-3 py-1">Optional details: {optionalRecorded} of {intake.optional.length} recorded</span>
    </div>
  </section>;
}

function ScopePanel({ job }: { job: Job }) {
  return <section className="card p-4 sm:p-6"><h2 className="mb-4 text-lg font-black">Scope of work</h2><p className="whitespace-pre-wrap leading-relaxed text-black/65">{job.scopeNotes || "No scope notes added."}</p>{job.partsNeeded && <div className="mt-5 rounded-xl bg-orange-50 p-4"><p className="mb-1 text-xs font-black uppercase tracking-wide text-orange-700">Parts needed</p><p className="font-semibold text-orange-950">{job.partsNeeded}</p></div>}</section>;
}

function ChecklistPanel({ job, saving, complete, percent, onToggle }: { job: Job; saving: boolean; complete: number; percent: number; onToggle: (id: string) => void }) {
  const checklist = checklistProgress(job);
  return <section id="checklist-panel" className="card p-4 sm:p-6">
    <div className="mb-4 flex items-start justify-between"><div><h2 className="text-lg font-black">Job checklist</h2><p className="text-sm text-black/45">Job completion: {percent}% · {complete} of {checklist.total} completed · {checklist.remaining} remaining</p></div>{saving && <span className="text-xs font-bold text-black/35">Saving…</span>}</div>
    <div className="mb-5 h-2 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-forest transition-all" style={{ width: `${percent}%` }} /></div>
    <div className="grid gap-2 sm:grid-cols-2">{checklist.items.map((item) => <button key={item.id} onClick={() => onToggle(item.id)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border p-3 text-left text-sm font-bold transition ${item.complete ? "border-forest/10 bg-forest/5 text-black/50" : "border-black/10 bg-white"}`}><span className={`grid size-6 shrink-0 place-items-center rounded-md border ${item.complete ? "border-forest bg-forest text-white" : "border-black/20"}`}>{item.complete && <CheckIcon className="size-4 stroke-[3]" />}</span><span className={item.complete ? "line-through" : ""}>{item.label}</span></button>)}</div>
    <div className="mt-5 border-t border-black/5 pt-4 text-sm"><div className="flex justify-between"><span className="text-black/45">Invoice</span><span className="font-extrabold">{job.invoiceStatus}</span></div><p className="mt-3 text-xs text-black/40">Invoice Simple integration can be connected here later.</p></div>
  </section>;
}

function formatJobDate(date: string) {
  if (!date) return "Not scheduled";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function JobCommandHub({ job, companyCam }: { job: Job; companyCam: CompanyCamState }) {
  const dispatchScore = dispatchReadinessScore(job);
  const closeoutScore = readinessScore(job);
  const dispatchMissing = dispatchBlockers(job);
  const topMissing = dispatchMissing.slice(0, 3);
  const checklist = checklistProgress(job);
  const calendarStatus = job.googleCalendarEventUrl ? "Linked" : job.dueDate ? "Date set" : "No date";
  const companyCamStatus = companyCam.projectUrl ? "Linked" : companyCam.configured ? "Ready" : "Needs token";

  return <section className="card mb-5 overflow-hidden print:hidden">
    <div className="bg-ink p-4 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-lime">Job command hub</p>
          <h2 className="mt-1 text-2xl font-black">What needs attention?</h2>
          <p className="mt-1 text-sm text-white/55">Phone-first snapshot for dispatch, paperwork, photos, calendar, and closeout.</p>
        </div>
        <Link href="/ready-check" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-lime px-4 py-2 text-sm font-black text-ink">Ready Check</Link>
      </div>
    </div>
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <CommandMetric label="Dispatch ready" value={`${dispatchScore}%`} detail={dispatchMissing.length ? `${dispatchMissing.length} item${dispatchMissing.length === 1 ? "" : "s"} missing` : "Ready to send"} tone={dispatchMissing.length ? "orange" : "green"} />
      <CommandMetric label="Closeout ready" value={`${closeoutScore}%`} detail={billingBlockers(job).length ? "Billing blockers open" : "Billing packet clean"} tone={billingBlockers(job).length ? "orange" : "green"} />
      <CommandMetric label="Checklist" value={`${checklist.complete}/${checklist.total}`} detail="Field checklist progress" tone={checklist.complete === checklist.total ? "green" : "blue"} />
      <CommandMetric label="Calendar / Cam" value={calendarStatus} detail={`CompanyCam: ${companyCamStatus}`} tone={job.googleCalendarEventUrl && companyCam.projectUrl ? "green" : "blue"} />
    </div>
    {topMissing.length > 0 && <div className="px-4 pb-4">
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-orange-800">Before sending crew</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {topMissing.map((item) => <a key={item.label} href={missingHref(item.label, job.jobId)} className="rounded-xl bg-white p-3 text-sm font-bold text-orange-950">
            <span className="block text-xs font-black uppercase tracking-wide text-orange-700">Fix</span>
            {item.label}
            <span className="mt-1 block text-xs font-semibold text-black/45">{item.detail}</span>
          </a>)}
        </div>
      </div>
    </div>}
  </section>;
}

function CommandMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "green" | "orange" | "blue" }) {
  const toneClass = tone === "green" ? "bg-forest/5 text-forest" : tone === "orange" ? "bg-orange-50 text-orange-800" : "bg-blue-50 text-blue-800";
  return <div className={`rounded-2xl p-4 ${toneClass}`}>
    <p className="text-xs font-black uppercase tracking-wide opacity-70">{label}</p>
    <p className="mt-1 text-2xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-black/45">{detail}</p>
  </div>;
}

function NextActionStrip({ job, companyCam }: { job: Job; companyCam: CompanyCamState }) {
  const actions = buildNextActions(job, companyCam).slice(0, 4);
  return <section className="card mb-5 p-4 print:hidden">
    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-forest">Next best actions</p>
        <h2 className="text-xl font-black">Do these first</h2>
      </div>
      <span className="rounded-full bg-sand px-3 py-1 text-xs font-black uppercase tracking-wide text-black/45">{job.status}</span>
    </div>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((action, index) => <a key={action.label} href={action.href} className={`rounded-2xl border p-3 ${index === 0 ? "border-forest/20 bg-forest/5" : "border-black/10 bg-sand"}`}>
        <p className={`text-[11px] font-black uppercase tracking-wide ${index === 0 ? "text-forest" : "text-black/35"}`}>{index === 0 ? "First" : `Then ${index + 1}`}</p>
        <p className="mt-1 font-black">{action.label}</p>
        <p className="mt-1 text-xs font-semibold text-black/50">{action.detail}</p>
      </a>)}
    </div>
  </section>;
}

function buildNextActions(job: Job, companyCam: CompanyCamState) {
  const actions: Array<{ label: string; detail: string; href: string }> = [];
  if (!job.dueDate) actions.push({ label: "Schedule the job", detail: "Add a due date before dispatching crew.", href: `/jobs/${job.jobId}/edit` });
  if (!job.assignedCrew?.trim()) actions.push({ label: "Assign employees", detail: "Pick one employee, multiple employees, or the full crew.", href: `/jobs/${job.jobId}/edit` });
  if (!job.scopeNotes?.trim()) actions.push({ label: "Review the scope", detail: "Add enough job notes so the field can start clean.", href: `/jobs/${job.jobId}/edit` });
  if (!job.phone?.trim() || !job.address?.trim() || !job.city?.trim()) actions.push({ label: "Complete customer info", detail: "Phone, address, and city are needed for field work.", href: `/jobs/${job.jobId}/edit` });
  if ((job.paperworkItems || defaultPaperwork(job)).some((item) => item.status === "Needed")) actions.push({ label: "Collect paperwork", detail: "Upload or mark work order and sign-off paperwork.", href: "#paperwork" });
  if ((job.partsItems || []).some((part) => ["Needed", "Ordered", "Picked up"].includes(part.status)) || job.status === "Waiting on Parts" || job.partsNeeded?.trim()) actions.push({ label: "Resolve parts", detail: "Order, pick up, install, or close open part requests.", href: "#parts-needed" });
  if (!job.googleCalendarEventUrl && job.dueDate) actions.push({ label: "Place on calendar", detail: "Use Google quick-add or sync after credentials are connected.", href: "#scheduling" });
  if (!companyCam.projectUrl) actions.push({ label: "Set up photo project", detail: "Create or link the CompanyCam project when credentials are ready.", href: "#companycam" });
  if (job.status === "In Progress" && !(job.afterPhotos || []).length) actions.push({ label: "Take after photos", detail: "Photos protect billing and completion proof.", href: "#photos" });
  if (job.status === "In Progress" && !job.completionNotes?.trim()) actions.push({ label: "Add completion notes", detail: "Write what was completed before closeout.", href: "#complete-job" });
  if (job.status === "Complete" && billingBlockers(job).length) actions.push({ label: "Finish closeout packet", detail: "Clear billing blockers before invoice handoff.", href: "#billing-handoff" });
  if (!actions.length) actions.push({ label: "Open closeout packet", detail: "This job looks clean. Review or print the packet.", href: `/jobs/${job.jobId}/packet` });
  actions.push({ label: "Share job handoff", detail: "Copy/share customer, address, scope, and parts notes.", href: "#profile-sheet" });
  return actions;
}

function missingHref(label: string, jobId: string) {
  if (["Scheduled", "Employee assigned"].includes(label)) return `/jobs/${jobId}/edit`;
  if (label === "Paperwork/work order") return "#paperwork";
  if (label === "Materials/parts") return "#parts-needed";
  if (label === "Scope notes" || label === "Customer info") return `/jobs/${jobId}/edit`;
  return `/jobs/${jobId}/edit`;
}

type JobAction = {
  label: string;
  detail?: string;
  href: string;
  icon: React.ReactNode;
  external?: boolean;
  disabled?: boolean;
};

type ProgressState = "complete" | "current" | "upcoming" | "neutral";

function JobWorkflowGuide({ job, canManageJob }: { job: Job; canManageJob: boolean }) {
  const primaryAction = getPrimaryJobAction(job, canManageJob);
  const quickActions = getQuickJobActions(job);
  const moreActions = getMoreJobActions(job, canManageJob);
  const progressSteps = getJobProgressSteps(job);

  return <section className="card mb-5 overflow-hidden print:hidden">
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_.75fr]">
      <div className="rounded-2xl bg-ink p-4 text-white">
        <p className="text-xs font-black uppercase tracking-widest text-lime">Next action</p>
        <h2 className="mt-1 text-2xl font-black">{primaryAction.label}</h2>
        {primaryAction.detail && <p className="mt-1 text-sm font-semibold text-white/60">{primaryAction.detail}</p>}
        <a href={primaryAction.href} target={primaryAction.external ? "_blank" : undefined} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime px-4 py-3 font-black text-ink sm:w-auto">
          <span className="[&>svg]:size-5">{primaryAction.icon}</span>
          {primaryAction.label}
        </a>
      </div>
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-forest">Quick actions</p>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => <WorkflowAction key={action.label} action={action} />)}
        </div>
      </div>
    </div>
    <div className="border-t border-black/5 px-4 py-3">
      <p className="mb-2 text-xs font-black uppercase tracking-widest text-forest">Job progress</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {progressSteps.map((step) => <a key={step.label} href={step.href} className={`min-w-32 rounded-xl border px-3 py-2 text-sm ${step.state === "complete" ? "border-forest/15 bg-forest/5 text-forest" : step.state === "current" ? "border-ink bg-ink text-white" : step.state === "upcoming" ? "border-black/10 bg-sand text-black/45" : "border-black/10 bg-white text-black/55"}`}>
          <span className="block text-[10px] font-black uppercase tracking-wide opacity-70">{step.state === "complete" ? "Done" : step.state === "current" ? "Now" : step.state === "upcoming" ? "Next" : "Check"}</span>
          <span className="mt-0.5 block font-black">{step.label}</span>
        </a>)}
      </div>
    </div>
    <details className="border-t border-black/5 px-4 py-3">
      <summary className="cursor-pointer text-sm font-black text-forest">More Actions</summary>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {moreActions.map((action) => action.label === "Share Job"
          ? <QuickShareAction key={action.label} job={job} compact />
          : <WorkflowAction key={action.label} action={action} />)}
      </div>
    </details>
  </section>;
}

function getPrimaryJobAction(job: Job, canManageJob: boolean): JobAction {
  const openParts = hasOpenParts(job);
  const status = job.status;
  if (openParts || status === "Waiting on Parts") return { label: "Review Parts", detail: "Parts are blocking or need a status update.", href: "#parts-needed", icon: <WrenchScrewdriverIcon /> };
  if (status === "Needs Inspection") return { label: "Review Closeout", detail: "Field work is ready for manager review.", href: "#closeout", icon: <CheckCircleIcon /> };
  if (["Complete", "Billed", "Paid"].includes(status)) {
    if (canManageJob && billingBlockers(job).length === 0) return { label: "Open Billing", detail: "Closeout looks ready for invoice handoff.", href: "#billing-handoff", icon: <BanknotesIcon /> };
    return { label: "Open Packet", detail: "Review job proof, paperwork, and closeout.", href: `/jobs/${job.jobId}/packet`, icon: <ClipboardDocumentListIcon /> };
  }
  if (status === "In Progress") {
    if (!(job.afterPhotos || []).length) return { label: "Add Progress", detail: "Add photos, notes, or proof from the field.", href: "#photos", icon: <CameraIcon /> };
    if (job.checklist.some((item) => !item.complete)) return { label: "Open Checklist", detail: "Finish the remaining field checklist items.", href: "#checklist", icon: <ClipboardDocumentListIcon /> };
    return { label: "Continue Work", detail: "Keep work moving from the field workspace.", href: "#time-log", icon: <WrenchScrewdriverIcon /> };
  }
  if (["New", "Scheduled"].includes(status)) {
    if (job.phone?.trim()) return { label: "Contact Customer", detail: "Confirm the visit before the crew rolls.", href: `tel:${job.phone}`, icon: <PhoneIcon /> };
    if (job.address?.trim() || job.city?.trim()) return { label: "Open Maps", detail: "Review the job location.", href: mapsHref(job), icon: <MapPinIcon />, external: true };
    return { label: canManageJob ? "Start Job" : "Open Field View", detail: "Open the field workflow for this job.", href: canManageJob ? "#time-log" : "/field", icon: <WrenchScrewdriverIcon /> };
  }
  return { label: "Continue Job", detail: "Open the workspace and move the job forward.", href: "#overview", icon: <ClipboardDocumentListIcon /> };
}

function getQuickJobActions(job: Job): JobAction[] {
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city}`)}`;
  const hasLocation = Boolean(job.address?.trim() || job.city?.trim());
  return [
    { href: `tel:${job.phone}`, label: "Call", icon: <PhoneIcon />, disabled: !job.phone },
    { href: mapsUrl, label: "Map", icon: <MapPinIcon />, external: true, disabled: !hasLocation },
    { href: "#photos", label: "Add Photo", icon: <CameraIcon /> },
    { href: "#operations", label: "Add Note", icon: <ChatBubbleLeftRightIcon /> },
  ];
}

function getMoreJobActions(job: Job, canManageJob: boolean): JobAction[] {
  const customerText = `sms:${job.phone}?&body=${encodeURIComponent(buildCustomerText(job))}`;
  return [
    { href: customerText, label: "Text Customer", icon: <ChatBubbleLeftRightIcon />, disabled: !job.phone },
    { href: "#share", label: "Share Job", icon: <ShareIcon /> },
    { href: "/field", label: "Field View", icon: <WrenchScrewdriverIcon /> },
    { href: "#paperwork", label: "Paperwork", icon: <ClipboardDocumentListIcon /> },
    { href: "#receipts", label: "Receipts", icon: <ReceiptPercentIcon /> },
    { href: "#parts-needed", label: "Parts", icon: <WrenchScrewdriverIcon /> },
    { href: "#time-log", label: "Time Log", icon: <ClockIcon /> },
    { href: "#complete-job", label: "Mark Complete", icon: <CheckCircleIcon /> },
    { href: "#signoffs", label: "Sign-off", icon: <CheckCircleIcon /> },
    { href: "#scheduling", label: "Calendar", icon: <CalendarDaysIcon /> },
    { href: "#companycam", label: "CompanyCam", icon: <CameraIcon /> },
    canManageJob ? { href: "#billing-handoff", label: "Billing", icon: <BanknotesIcon /> } : undefined,
  ].filter(Boolean) as JobAction[];
}

function getJobProgressSteps(job: Job): Array<{ label: string; href: string; state: ProgressState }> {
  const checklist = checklistProgress(job).items;
  const checklistDone = (label: string) => checklist.some((item) => item.label === label && item.complete);
  const started = ["In Progress", "Waiting on Parts", "Needs Inspection", "Complete", "Billed", "Paid"].includes(job.status) || (job.timeEntries || []).some((entry) => ["Arrived", "Work started"].includes(entry.type));
  const beforeDone = (job.beforePhotos || []).length > 0 || checklistDone("Before photos taken");
  const workDone = checklistDone("Work completed") || ["Needs Inspection", "Complete", "Billed", "Paid"].includes(job.status);
  const partsDone = !hasOpenParts(job);
  const afterDone = (job.afterPhotos || []).length > 0 || checklistDone("After photos taken");
  const paperworkDone = (job.paperworkItems || defaultPaperwork(job)).some((item) => item.status === "Collected" || item.status === "Submitted");
  const signoffDone = (job.signoffs || []).length > 0;
  const billingDone = ["Complete", "Billed", "Paid"].includes(job.status) || ["Ready", "Sent to Billing", "Sent", "Paid"].includes(job.invoiceStatus);
  const contactDone = job.activityLog?.some((entry) => entry.type === "Customer" || entry.type === "Source") || checklistDone("Customer/source notified");
  const facts = [
    { label: "Contact", href: "#communication-handoff", done: Boolean(contactDone), known: Boolean(job.phone || contactDone) },
    { label: "Arrive / Start", href: "#time-log", done: started, known: true },
    { label: "Before Photos", href: "#photos", done: beforeDone, known: true },
    { label: "Work / Checklist", href: "#checklist", done: workDone, known: true },
    { label: "Progress / Parts", href: "#parts-needed", done: partsDone, known: (job.partsItems || []).length > 0 || Boolean(job.partsNeeded) || hasOpenParts(job) },
    { label: "After Photos", href: "#photos", done: afterDone, known: true },
    { label: "Paperwork", href: "#paperwork", done: paperworkDone, known: true },
    { label: "Sign-off", href: "#signoffs", done: signoffDone, known: true },
    { label: "Review / Billing", href: "#billing-handoff", done: billingDone, known: true },
  ];
  const firstOpen = facts.findIndex((step) => step.known && !step.done);
  return facts.map((step, index) => ({
    label: step.label,
    href: step.href,
    state: step.done ? "complete" : !step.known ? "neutral" : index === firstOpen ? "current" : "upcoming",
  }));
}

function hasOpenParts(job: Job) {
  return (job.partsItems || []).some((part) => ["Needed", "Ordered", "Picked up"].includes(part.status)) || Boolean(job.partsNeeded?.trim());
}

function mapsHref(job: Job) {
  return `https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city}`)}`;
}

function WorkflowAction({ action }: { action: JobAction }) {
  const className = `flex min-h-14 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-sm font-black ${action.disabled ? "pointer-events-none border-black/5 bg-black/5 text-black/25" : "border-black/10 bg-white text-ink active:scale-[.98]"}`;
  return <a href={action.href} target={action.external ? "_blank" : undefined} className={className}><span className="text-forest [&>svg]:size-5">{action.icon}</span>{action.label}</a>;
}

function QuickShareAction({ job, compact = false }: { job: Job; compact?: boolean }) {
  async function share() {
    const text = buildFieldHandoff(job);
    if (navigator.share) {
      await navigator.share({ title: `${job.jobId} — ${job.customerName}`, text }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(text).catch(() => undefined);
  }
  return <button type="button" onClick={share} className={`flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-center font-black text-ink active:scale-[.98] ${compact ? "min-h-14 text-sm" : "min-h-20 flex-col text-xs"}`}><span className="text-forest [&>svg]:size-5"><ShareIcon /></span>Share Job</button>;
}

function FieldWorkspace({ job, companyCam }: { job: Job; companyCam: CompanyCamState }) {
  const photoCount = (job.beforePhotos || []).length + (job.damagePhotos || []).length + (job.serialTagPhotos || []).length + (job.afterPhotos || []).length;
  const paperworkCount = (job.workOrderFiles || []).length + (job.paperworkItems || []).filter((item) => item.status === "Collected" || item.status === "Submitted").length;
  const receiptCount = (job.receipts || []).length;
  const followUps = (job.activityLog || []).filter((entry) => entry.notify && !entry.resolvedAt).length;
  const closeoutScore = readinessScore(job);
  const groups = [
    {
      title: "Start work",
      detail: `${job.assignedCrew || "Unassigned"} · ${job.dueDate || "No date"}`,
      icon: <WrenchScrewdriverIcon />,
      actions: [
        { label: "Open field view", href: "/field", primary: true },
        { label: "Time log", href: "#time-log" },
        { label: "Scope & parts", href: "#parts-needed" },
      ],
    },
    {
      title: "Proof & files",
      detail: `${photoCount} photos · ${paperworkCount} paperwork · ${receiptCount} receipts`,
      icon: <CameraIcon />,
      actions: [
        { label: "Add photos", href: "#photos", primary: true },
        { label: "Paperwork", href: "#paperwork" },
        { label: "Receipts", href: "#receipts" },
      ],
    },
    {
      title: "Communicate",
      detail: `${followUps} open follow-up${followUps === 1 ? "" : "s"}`,
      icon: <ChatBubbleLeftRightIcon />,
      actions: [
        { label: "Call", href: `tel:${job.phone}`, primary: true, disabled: !job.phone },
        { label: "Text", href: `sms:${job.phone}?&body=${encodeURIComponent(buildCustomerText(job))}`, disabled: !job.phone },
        { label: "Add note", href: "#operations" },
      ],
    },
    {
      title: "Schedule & apps",
      detail: `${job.googleCalendarEventUrl ? "Calendar linked" : "Calendar quick-add"} · ${companyCam.projectUrl ? "CompanyCam linked" : "CompanyCam ready"}`,
      icon: <CalendarDaysIcon />,
      actions: [
        { label: "Calendar", href: "#scheduling", primary: true },
        { label: "CompanyCam", href: "#companycam" },
        { label: "Maps", href: `https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city}`)}`, external: true },
      ],
    },
    {
      title: "Closeout",
      detail: `${closeoutScore}% billing ready · ${job.invoiceStatus || "Not started"}`,
      icon: <CheckCircleIcon />,
      actions: [
        { label: "Mark complete", href: "#complete-job", primary: true },
        { label: "Sign-off", href: "#signoffs" },
        { label: "Billing", href: "#billing-handoff" },
      ],
    },
  ];

  return <section className="mb-5 print:hidden">
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-forest">Field workspace</p>
        <h2 className="text-xl font-black">Grouped job tools</h2>
      </div>
      <Link href={`/jobs/${job.jobId}/packet`} className="text-sm font-black text-forest">Open packet</Link>
    </div>
    <div className="grid gap-3 lg:grid-cols-5">
      {groups.map((group) => <WorkspaceGroup key={group.title} title={group.title} detail={group.detail} icon={group.icon} actions={group.actions} />)}
    </div>
  </section>;
}

function WorkspaceGroup({ title, detail, icon, actions }: { title: string; detail: string; icon: React.ReactNode; actions: Array<{ label: string; href: string; primary?: boolean; external?: boolean; disabled?: boolean }> }) {
  return <div className="card p-3">
    <div className="mb-3 flex items-start gap-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime text-ink [&>svg]:size-5">{icon}</span>
      <div className="min-w-0">
        <h3 className="font-black">{title}</h3>
        <p className="mt-0.5 text-xs font-semibold text-black/45">{detail}</p>
      </div>
    </div>
    <div className="grid gap-2">
      {actions.map((action) => <a key={action.label} href={action.href} target={action.external ? "_blank" : undefined} className={`min-h-11 rounded-xl px-3 py-2 text-center text-sm font-black ${action.disabled ? "pointer-events-none bg-black/5 text-black/25" : action.primary ? "bg-forest text-white" : "border border-black/10 bg-white text-ink"}`}>{action.label}</a>)}
    </div>
  </div>;
}

function CommunicationHandoffPanel({ job, saving, onSave }: { job: Job; saving: boolean; onSave: (patch: Partial<Job>) => Promise<Job | undefined> }) {
  const [copiedKey, setCopiedKey] = useState("");
  const [message, setMessage] = useState("");
  const phone = job.phone?.trim();
  const sourceName = sourceContactLabel(job);
  const templates: Array<{
    key: string;
    label: string;
    detail: string;
    type: JobActivity["type"];
    audience: NonNullable<JobActivity["audience"]>;
    text: string;
    href?: string;
    hrefLabel?: string;
    markChecklist?: boolean;
  }> = [
    {
      key: "customer",
      label: "Customer update",
      detail: "Copy or open a phone text for the customer.",
      type: "Customer",
      audience: "All",
      text: buildCustomerText(job),
      href: phone ? `sms:${phone}?&body=${encodeURIComponent(buildCustomerText(job))}` : undefined,
      hrefLabel: "Open Text",
      markChecklist: true,
    },
    {
      key: "source",
      label: `${sourceName} update`,
      detail: "Use for dealer, factory, or individual customer source notes.",
      type: "Source",
      audience: "Admin",
      text: buildSourceText(job),
      markChecklist: true,
    },
    {
      key: "manager",
      label: "Manager handoff",
      detail: "Copy for Ronnie/admin, billing, or closeout review.",
      type: "Note",
      audience: "Manager",
      text: buildManagerHandoffText(job),
    },
  ];

  async function copyTemplate(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setMessage("Message copied.");
      window.setTimeout(() => setCopiedKey(""), 2200);
    } catch {
      setMessage("Copy did not work on this device. You can still select the text manually.");
    }
  }

  async function logNotified(template: typeof templates[number]) {
    setMessage("");
    const entry: JobActivity = {
      id: `activity-${Date.now()}`,
      type: template.type,
      message: `${template.label} prepared/notified. ${template.text}`,
      createdAt: new Date().toISOString(),
      createdBy: "Manager",
      audience: template.audience,
    };
    const nextChecklist = template.markChecklist
      ? job.checklist.map((item) => /notified/i.test(item.label) ? { ...item, complete: true } : item)
      : job.checklist;
    const saved = await onSave({
      checklist: nextChecklist,
      activityLog: [entry, ...(job.activityLog || [])].slice(0, 50),
    });
    if (saved) setMessage(`${template.label} logged on the job.`);
  }

  return <section id="communication-handoff" className="card mb-5 p-4 sm:p-6 print:hidden">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink"><ChatBubbleLeftRightIcon className="size-5" /></span>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-forest">Communication handoff</p>
        <h2 className="text-lg font-black">Ready-to-send job updates</h2>
        <p className="text-sm text-black/50">Copy messages, open a customer text, and log who was notified. Nothing sends automatically.</p>
      </div>
    </div>
    <div className="grid gap-3 lg:grid-cols-3">
      {templates.map((template) => <div key={template.key} className="rounded-2xl border border-black/10 bg-white p-3">
        <div className="mb-3">
          <h3 className="font-black">{template.label}</h3>
          <p className="mt-1 text-xs font-semibold text-black/45">{template.detail}</p>
        </div>
        <p className="min-h-28 whitespace-pre-wrap rounded-xl bg-sand p-3 text-sm font-semibold leading-relaxed text-black/65">{template.text}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => copyTemplate(template.key, template.text)} className="min-h-11 rounded-xl bg-forest px-3 py-2 text-sm font-black text-white">{copiedKey === template.key ? "Copied" : "Copy"}</button>
          {template.href
            ? <a href={template.href} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm font-black text-ink">{template.hrefLabel || "Open"}</a>
            : <button type="button" onClick={() => shareProfile(job, template.text)} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-ink">Share</button>}
          <button type="button" disabled={saving} onClick={() => logNotified(template)} className="col-span-2 min-h-11 rounded-xl bg-lime px-3 py-2 text-sm font-black text-ink disabled:opacity-50">{saving ? "Saving…" : "Log Notified"}</button>
        </div>
      </div>)}
    </div>
    {message && <p className="mt-3 rounded-xl bg-forest/5 p-3 text-sm font-bold text-forest">{message}</p>}
  </section>;
}

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) { return <div className="flex gap-3"><span className="mt-0.5 text-forest [&>svg]:size-5">{icon}</span><div><p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-black/35">{label}</p><div className="text-sm font-semibold">{children}</div></div></div>; }
function PhotoCount({ label, count }: { label: string; count: number }) { return <div className="rounded-xl bg-sand p-3 text-center"><p className="text-2xl font-black">{count}</p><p className="text-xs font-bold text-black/45">{label}</p></div>; }

function AdditionalIssuePanel({ job, saving, onSave }: { job: Job; saving: boolean; onSave: (patch: Partial<Job>) => Promise<Job | undefined> }) {
  const [description, setDescription] = useState("");
  const [returnVisit, setReturnVisit] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = description.trim();
    if (!issue) return;
    const entry: JobActivity = {
      id: `activity-${Date.now()}`,
      type: "Status",
      message: [
        "Additional issue reported — manager review needed.",
        `Issue: ${issue}`,
        `Return visit needed: ${returnVisit ? "Yes" : "No"}`,
        customerNote.trim() ? `Customer informed / approval note: ${customerNote.trim()}` : "Customer informed / approval note: Not recorded",
      ].join("\n"),
      createdAt: new Date().toISOString(),
      createdBy: "Field",
      audience: "Manager",
      notify: true,
      followUpDueDate: new Date().toLocaleDateString("en-CA"),
    };
    const saved = await onSave({ activityLog: [entry, ...(job.activityLog || [])].slice(0, 50) });
    if (!saved) return;
    setDescription("");
    setReturnVisit(false);
    setCustomerNote("");
    setMessage("Additional issue saved for manager review. Add photos or parts below if needed.");
  }

  return <section id="additional-issue" className="card scroll-mt-24 p-4 sm:p-6">
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-800"><WrenchScrewdriverIcon className="size-5" /></span>
      <div><p className="text-xs font-black uppercase tracking-widest text-orange-800">Field documentation</p><h2 className="text-lg font-black">Additional Issue</h2><p className="text-sm text-black/50">Document work found outside the original work order for manager review. This does not approve billing.</p></div>
    </div>
    <form onSubmit={submit} className="mt-4 grid gap-3">
      <label className="block"><span className="label">What did you find?</span><textarea required className="field min-h-24 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the issue clearly for the manager." /></label>
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 text-sm font-bold"><input type="checkbox" checked={returnVisit} onChange={(event) => setReturnVisit(event.target.checked)} className="size-5 accent-forest" /> Return visit needed</label>
      <label className="block"><span className="label">Customer informed / approval note (optional)</span><input className="field" value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="What the customer was told; no billing approval is recorded here." /></label>
      <button disabled={saving || !description.trim()} className="min-h-12 rounded-xl bg-orange-700 px-4 py-3 font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save Additional Issue"}</button>
    </form>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <a href="#photos" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-ink"><CameraIcon className="size-5" /> Add issue photos</a>
      <a href="#parts-needed" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-ink"><WrenchScrewdriverIcon className="size-5" /> Add needed part</a>
    </div>
    <p className="mt-2 text-xs font-semibold text-black/45">Use the existing Damage or Parts photo category so photos stay on this job.</p>
    {message && <p role="status" className="mt-3 rounded-xl bg-forest/5 p-3 text-sm font-bold text-forest">{message}</p>}
  </section>;
}

type PhotoBucket = "beforePhotos" | "damagePhotos" | "serialTagPhotos" | "afterPhotos";
type NativePhotoCategory = Extract<FileCategory, "Before" | "Progress" | "After" | "Damage" | "Serial / Tags" | "Parts" | "Paperwork" | "Receipt">;
type PhotoGalleryItem = {
  id: string;
  category: NativePhotoCategory;
  url: string;
  fileName: string;
  fileSize?: number;
  uploadedAt?: string;
  caption?: string;
  uploadedBy?: string;
  source: "file" | "legacy";
};

const photoCategories: { category: NativePhotoCategory; label: string; help: string; legacyBucket?: PhotoBucket }[] = [
  { category: "Before", label: "Before", help: "Start-of-job proof", legacyBucket: "beforePhotos" },
  { category: "Progress", label: "Progress", help: "Work in progress" },
  { category: "After", label: "After", help: "Completion proof", legacyBucket: "afterPhotos" },
  { category: "Damage", label: "Damage", help: "Issues or warranty proof", legacyBucket: "damagePhotos" },
  { category: "Serial / Tags", label: "Serial / Tags", help: "VIN, data plates, labels", legacyBucket: "serialTagPhotos" },
  { category: "Parts", label: "Parts", help: "Parts used or needed" },
  { category: "Paperwork", label: "Paperwork", help: "Forms and job docs" },
  { category: "Receipt", label: "Receipts", help: "Receipt backup photos" },
];

function PhotoUploadPanel({ job, saving, onSave }: { job: Job; saving: boolean; onSave: (patch: Partial<Job>) => Promise<Job | undefined> }) {
  const [selectedCategory, setSelectedCategory] = useState<NativePhotoCategory>("Before");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [message, setMessage] = useState("");
  const gallery = groupJobPhotos(job);
  const proofChecks = [
    { label: "Before photos", complete: (job.beforePhotos || []).length > 0, detail: `${(job.beforePhotos || []).length} uploaded` },
    { label: "Serial/VIN tag", complete: (job.serialTagPhotos || []).length > 0, detail: `${(job.serialTagPhotos || []).length} uploaded` },
    { label: "After photos", complete: (job.afterPhotos || []).length > 0, detail: `${(job.afterPhotos || []).length} uploaded` },
    { label: "Damage photos", complete: (job.damagePhotos || []).length > 0 || !/damage|repair|warranty/i.test(`${job.jobType} ${job.scopeNotes}`), detail: `${(job.damagePhotos || []).length} uploaded` },
  ];
  const proofReady = proofChecks.filter((check) => check.complete).length;
  const totalPhotos = photoTotal(job);

  function chooseFiles(files: FileList | null) {
    setSelectedFiles(Array.from(files || []).filter((file) => file.type.startsWith("image/")));
    setMessage("");
  }

  async function uploadSelectedPhotos() {
    if (!selectedFiles.length) {
      setMessage("Choose at least one photo first.");
      return;
    }
    setUploading(true);
    setMessage("");
    const uploaded: WorkOrderFile[] = [];
    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        setUploadProgress(`Uploading ${index + 1} of ${selectedFiles.length}`);
        const prepared = await preparePhotoForUpload(selectedFiles[index]);
        uploaded.push(await uploadStoredFile(prepared, job.jobId, selectedCategory, caption.trim()));
      }
      const patch: Partial<Job> = {
        workOrderFiles: [...uploaded, ...(job.workOrderFiles || [])],
        activityLog: addJobActivity(job, `${uploaded.length} ${uploaded.length === 1 ? "photo" : "photos"} uploaded to ${selectedCategory}.`, "Note"),
      };
      const legacyBucket = photoCategories.find((item) => item.category === selectedCategory)?.legacyBucket;
      if (legacyBucket) {
        const urls = uploaded.map((file) => file.storageUrl || file.dataUrl).filter(Boolean);
        patch[legacyBucket] = [...(job[legacyBucket] || []), ...urls];
      }
      await onSave(patch);
      setSelectedFiles([]);
      setCaption("");
      setMessage(`${uploaded.length} ${uploaded.length === 1 ? "photo" : "photos"} uploaded to ${selectedCategory}.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Photos could not be uploaded.");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  }

  async function copyProofSummary() {
    const summary = [
      `${job.jobId} — ${job.customerName}`,
      `Photo proof: ${proofReady}/${proofChecks.length} ready · ${totalPhotos} total photos`,
      ...proofChecks.map((check) => `${check.complete ? "READY" : "NEEDED"}: ${check.label} (${check.detail})`),
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(summary).then(() => window.alert("Photo proof summary copied."), () => window.alert(summary));
  }

  async function updatePhotoCaption(fileId: string, nextCaption: string) {
    await onSave({
      workOrderFiles: (job.workOrderFiles || []).map((file) => file.id === fileId ? { ...file, caption: nextCaption.trim() || undefined } : file),
      activityLog: addJobActivity(job, "Photo caption updated.", "Note"),
    });
  }

  return <section id="photos" className="card p-4 sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800"><CameraIcon className="size-5" /></span>
      <div>
        <h2 className="text-lg font-black">Photos & documentation</h2>
        <p className="text-sm text-black/50">Upload from phone camera or photo library. Photos stay on the job profile.</p>
      </div>
    </div>
    <div className="mb-4 overflow-hidden rounded-2xl border border-black/10 bg-white">
      <div className="flex flex-col gap-3 bg-sand p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-forest">Photo proof checklist</p>
          <h3 className="mt-1 text-xl font-black">{proofReady}/{proofChecks.length} ready · {totalPhotos} total photos</h3>
          <p className="mt-1 text-sm font-semibold text-black/45">Before, serial/VIN, and after photos protect closeout and billing.</p>
        </div>
        <button type="button" onClick={copyProofSummary} className="min-h-11 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-black text-ink">Copy summary</button>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-4">
        {proofChecks.map((check) => <div key={check.label} className={`rounded-xl p-3 ${check.complete ? "bg-forest/5" : "bg-orange-50"}`}>
          <p className={`text-[11px] font-black uppercase tracking-wide ${check.complete ? "text-forest" : "text-orange-800"}`}>{check.complete ? "Ready" : "Needed"}</p>
          <p className="mt-1 font-black">{check.label}</p>
          <p className="mt-1 text-xs font-semibold text-black/45">{check.detail}</p>
        </div>)}
      </div>
    </div>
    <div className="rounded-2xl border border-black/10 bg-sand p-3 sm:p-4">
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <button type="button" disabled={saving || uploading} onClick={() => setSelectedCategory("Before")} className={`min-h-16 rounded-xl p-3 text-left disabled:opacity-50 ${selectedCategory === "Before" ? "bg-forest text-white" : "bg-white text-ink"}`}>
          <p className="text-xs font-black uppercase tracking-wide opacity-70">1. Before</p>
          <p className="mt-1 text-sm font-black">Start photos + serial/VIN</p>
        </button>
        <button type="button" disabled={saving || uploading} onClick={() => setSelectedCategory("Progress")} className={`min-h-16 rounded-xl p-3 text-left disabled:opacity-50 ${selectedCategory === "Progress" ? "bg-forest text-white" : "bg-white text-ink"}`}>
          <p className="text-xs font-black uppercase tracking-wide opacity-70">2. During</p>
          <p className="mt-1 text-sm font-black">Progress; use Damage if needed</p>
        </button>
        <button type="button" disabled={saving || uploading} onClick={() => setSelectedCategory("After")} className={`min-h-16 rounded-xl p-3 text-left disabled:opacity-50 ${selectedCategory === "After" ? "bg-forest text-white" : "bg-white text-ink"}`}>
          <p className="text-xs font-black uppercase tracking-wide opacity-70">3. Completed</p>
          <p className="mt-1 text-sm font-black">Finished work, clean area, no debris</p>
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <label className="block"><span className="label">Category</span><select className="field" value={selectedCategory} disabled={saving || uploading} onChange={(event) => setSelectedCategory(event.target.value as NativePhotoCategory)}>{photoCategories.map((item) => <option key={item.category} value={item.category}>{item.label}</option>)}</select></label>
        <label className="block"><span className="label">Optional caption</span><input className="field" value={caption} disabled={saving || uploading} onChange={(event) => setCaption(event.target.value)} placeholder="Short note for this upload batch" /></label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-center font-black text-white ${(saving || uploading) ? "opacity-50" : ""}`}>
          <CameraIcon className="size-5" /> Take Photo
          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={saving || uploading} onChange={(event) => chooseFiles(event.target.files)} />
        </label>
        <label className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-black/10 bg-white px-4 py-3 text-center font-black text-ink ${(saving || uploading) ? "opacity-50" : ""}`}>
          <CameraIcon className="size-5" /> Upload Photos
          <input type="file" accept="image/*" multiple className="hidden" disabled={saving || uploading} onChange={(event) => chooseFiles(event.target.files)} />
        </label>
        <button type="button" disabled={saving || uploading || selectedFiles.length === 0} onClick={uploadSelectedPhotos} className="min-h-14 rounded-xl bg-lime px-4 py-3 font-black text-ink disabled:opacity-50">{uploading ? uploadProgress || "Uploading…" : `Upload ${selectedFiles.length || ""}`.trim()}</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-black/45">
        <span className="rounded-full bg-white px-3 py-1">{selectedFiles.length ? `${selectedFiles.length} selected` : "No photos selected"}</span>
        <span className="rounded-full bg-white px-3 py-1">Large photos are resized before upload</span>
      </div>
      {message && <p role="status" className="mt-3 rounded-xl bg-white p-3 text-sm font-bold text-forest">{message}</p>}
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      {photoCategories.map((bucket) => {
        const photos = gallery[bucket.category] || [];
        return <div key={bucket.category} className="rounded-2xl border border-black/10 bg-white p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div><p className="font-black">{bucket.label}</p><p className="text-xs font-semibold text-black/45">{bucket.help}</p></div>
            <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-black text-forest">{photos.length}</span>
          </div>
          {photos.length > 0 ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{photos.map((photo, index) => <PhotoGalleryTile key={photo.id} photo={photo} label={`${bucket.label} ${index + 1}`} onCaptionSave={updatePhotoCaption} />)}</div> : <p className="rounded-xl bg-sand p-3 text-sm font-semibold text-black/45">No photos yet.</p>}
        </div>;
      })}
    </div>
  </section>;
}

function PhotoGalleryTile({ photo, label, onCaptionSave }: { photo: PhotoGalleryItem; label: string; onCaptionSave: (fileId: string, caption: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(photo.caption || "");
  const [saving, setSaving] = useState(false);
  async function saveCaption() {
    if (photo.source !== "file") return;
    setSaving(true);
    await onCaptionSave(photo.id, caption);
    setSaving(false);
    setEditing(false);
  }
  return <div className="overflow-hidden rounded-xl border border-black/10 bg-sand">
    <a href={photo.url} target="_blank" className="block aspect-square bg-white">
      <img src={photo.url} alt={label} loading="lazy" className="size-full object-cover" />
    </a>
    <div className="p-2">
      <p className="truncate text-xs font-black">{photo.fileName}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-black/40">{photo.uploadedBy ? `${photo.uploadedBy} · ` : ""}{photo.fileSize ? `${(photo.fileSize / 1024).toFixed(0)} KB` : "Saved photo"}</p>
      {editing ? <div className="mt-2 space-y-2">
        <input className="field !min-h-10 !py-2 text-xs" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Caption" />
        <button type="button" disabled={saving} onClick={saveCaption} className="min-h-10 w-full rounded-lg bg-forest px-3 py-2 text-xs font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save caption"}</button>
      </div> : <>
        {photo.caption && <p className="mt-2 text-xs font-semibold text-black/55">{photo.caption}</p>}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <a href={photo.url} target="_blank" className="min-h-10 rounded-lg bg-white px-3 py-2 text-center text-xs font-black text-forest">Open</a>
          {photo.source === "file" && <button type="button" onClick={() => setEditing(true)} className="min-h-10 rounded-lg bg-white px-3 py-2 text-xs font-black text-ink">Caption</button>}
        </div>
      </>}
    </div>
  </div>;
}

function groupJobPhotos(job: Job): Record<NativePhotoCategory, PhotoGalleryItem[]> {
  const groups = photoCategories.reduce((accumulator, item) => {
    accumulator[item.category] = [];
    return accumulator;
  }, {} as Record<NativePhotoCategory, PhotoGalleryItem[]>);
  const seen = new Set<string>();
  for (const file of job.workOrderFiles || []) {
    if (!isNativePhotoCategory(file.category) || !file.fileType.startsWith("image/")) continue;
    const url = file.storageUrl || file.dataUrl;
    if (!url) continue;
    seen.add(url);
    groups[file.category].push({
      id: file.id,
      category: file.category,
      url,
      fileName: file.fileName,
      fileSize: file.fileSize,
      uploadedAt: file.uploadedAt,
      caption: file.caption,
      uploadedBy: file.uploadedBy,
      source: "file",
    });
  }
  for (const bucket of photoCategories) {
    if (!bucket.legacyBucket) continue;
    for (const [index, url] of (job[bucket.legacyBucket] || []).entries()) {
      if (!url || seen.has(url)) continue;
      groups[bucket.category].push({
        id: `${bucket.legacyBucket}-${index}`,
        category: bucket.category,
        url,
        fileName: `${bucket.label} photo`,
        source: "legacy",
      });
    }
  }
  return groups;
}

function photoTotal(job: Job) {
  const groups = groupJobPhotos(job);
  return photoCategories.reduce((total, category) => total + groups[category.category].length, 0);
}

function isNativePhotoCategory(category: FileCategory | undefined): category is NativePhotoCategory {
  return Boolean(category && photoCategories.some((item) => item.category === category));
}

async function preparePhotoForUpload(file: File) {
  if (!file.type.startsWith("image/") || file.size < 900_000) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const maxLongEdge = 2200;
  const longEdge = Math.max(bitmap.width, bitmap.height);
  if (longEdge <= maxLongEdge && file.size < 2_500_000) return file;
  const scale = Math.min(1, maxLongEdge / longEdge);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob || blob.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

type CloseoutRequirementStatus = "complete" | "missing" | "not-required" | "not-due";
type CloseoutStage = "current" | "review" | "billing";
type CloseoutRequirement = {
  name: string;
  status: CloseoutRequirementStatus;
  detail: string;
  href?: string;
  blocking: boolean;
};

function closeoutRequirements(job: Job, stage: CloseoutStage = "current", options: { requireAfterPhotos?: boolean } = {}): CloseoutRequirement[] {
  const closeoutDue = isCloseoutDue(job, stage);
  const billingDue = stage === "billing";
  const started = hasStarted(job) || closeoutDue;
  const checklistItems = checklistProgress(job).items;
  const requiredChecklist = checklistItems.filter((item) => !/invoice created/i.test(item.label));
  const checklistComplete = requiredChecklist.every((item) => item.complete);
  const beforeRequired = requiredChecklist.some((item) => /before photos/i.test(item.label));
  const afterRequired = options.requireAfterPhotos ?? requiredChecklist.some((item) => /after photos/i.test(item.label));
  const paperwork = job.paperworkItems || defaultPaperwork(job);
  const paperworkReady = hasPaperwork(job, paperwork);
  const completionSignoffItem = paperwork.find((item) => /completion sign-?off/i.test(item.label));
  const signatureRequired = closeoutDue && Boolean(completionSignoffItem && completionSignoffItem.status !== "Not needed");
  const signatureReady = hasCompletionSignoff(job) || ["Collected", "Submitted", "Not needed"].includes(completionSignoffItem?.status || "");
  const laborTimeEntries = (job.timeEntries || []).filter((entry) => entry.type !== "Note");
  const partsOpen = (job.partsItems || []).filter((part) => ["Needed", "Ordered", "Picked up"].includes(part.status));
  const partsBlocking = job.status === "Waiting on Parts" || partsOpen.length > 0;
  const receiptApplicable = receiptBackupApplies(job);
  const receiptReady = !receiptApplicable || !isReceiptBackupMissing(job);
  const managerReviewed = ["Complete", "Billed", "Paid"].includes(job.status);

  return [
    requirement("Work checklist", checklistItems.length === 0 ? "not-required" : checklistComplete ? "complete" : "missing", checklistItems.length === 0 ? "No checklist on this job" : checklistComplete ? "Checklist complete" : `${requiredChecklist.filter((item) => !item.complete).length} checklist item${requiredChecklist.filter((item) => !item.complete).length === 1 ? "" : "s"} open`, "#checklist", stage !== "current" || started),
    requirement("Before photos", !beforeRequired ? "not-required" : !started ? "not-due" : hasBeforePhotos(job) ? "complete" : "missing", !beforeRequired ? "Not required by this workflow" : !started ? "Not due yet" : hasBeforePhotos(job) ? `${photoCountFor(job, "Before")} saved` : "Before photos missing", "#photos", started),
    requirement("After photos", !afterRequired ? "not-required" : !closeoutDue ? "not-due" : hasAfterPhotos(job) ? "complete" : "missing", !afterRequired ? "Not required by this workflow" : !closeoutDue ? "Not due yet" : hasAfterPhotos(job) ? `${photoCountFor(job, "After")} saved` : "After photos missing", "#photos", closeoutDue),
    requirement("Paperwork", !closeoutDue ? "not-due" : paperworkReady ? "complete" : "missing", !closeoutDue ? "Not due yet" : paperworkReady ? "Paperwork collected or attached" : "Paperwork or work order missing", "#paperwork", closeoutDue),
    requirement("Customer signature", !signatureRequired ? "not-required" : signatureReady ? "complete" : "missing", !signatureRequired ? "No required sign-off identified" : signatureReady ? "Completion sign-off saved" : "Completion sign-off missing", "#signoffs", signatureRequired),
    requirement("Time entered", !started ? "not-due" : laborTimeEntries.length > 0 ? "complete" : "missing", !started ? "Not due yet" : laborTimeEntries.length > 0 ? `${laborTimeEntries.length} labor/time entr${laborTimeEntries.length === 1 ? "y" : "ies"}` : "No labor/time entry", "#time-log", started || stage !== "current"),
    requirement("Parts resolved", partsBlocking ? "missing" : (job.partsItems || []).length ? "complete" : "not-required", partsBlocking ? `${partsOpen.length || 1} open part issue${(partsOpen.length || 1) === 1 ? "" : "s"}` : (job.partsItems || []).length ? "No blocking parts open" : "No parts required", "#parts-needed", partsBlocking),
    requirement("Receipt backup", !receiptApplicable ? "not-required" : receiptReady ? "complete" : "missing", !receiptApplicable ? "No receipt backup needed" : receiptReady ? "Receipt backup attached" : "Receipt dollars need backup", "#receipts", receiptApplicable),
    requirement("Completion notes", !closeoutDue ? "not-due" : job.completionNotes?.trim() ? "complete" : "missing", !closeoutDue ? "Not due yet" : job.completionNotes?.trim() ? "Completion note saved" : "Completion note missing", "#complete-job", closeoutDue),
    requirement("Manager review", !billingDue ? ["Complete", "Billed", "Paid"].includes(job.status) ? "complete" : job.status === "Needs Inspection" ? "missing" : "not-due" : managerReviewed ? "complete" : "missing", managerReviewed ? "Manager approved complete" : job.status === "Needs Inspection" ? "Manager review required" : "Not due yet", "#complete-job", billingDue || job.status === "Needs Inspection"),
  ];
}

function requirement(name: string, status: CloseoutRequirementStatus, detail: string, href: string | undefined, due: boolean): CloseoutRequirement {
  return { name, status, detail, href, blocking: due && status === "missing" };
}

function blockingRequirements(requirements: CloseoutRequirement[]) {
  return requirements.filter((item) => item.blocking);
}

function closeoutReadiness(job: Job, canManageJob: boolean) {
  const requirements = closeoutRequirements(job);
  const blockers = blockingRequirements(requirements);
  const missing = requirements.filter((item) => item.status === "missing").length;
  const notDue = requirements.filter((item) => item.status === "not-due").length;
  if (!blockers.length && ["Complete", "Billed", "Paid"].includes(job.status)) return { label: "Ready for Billing", detail: "Manager review is complete and closeout blockers are clear.", tone: "green" as const, missing, notDue };
  if (job.status === "Needs Inspection") return { label: "Manager review required", detail: blockers.length ? `${blockers.length} blocking item${blockers.length === 1 ? "" : "s"} still open.` : "Field submitted this job for manager review.", tone: "blue" as const, missing, notDue };
  if (!blockers.length && hasStarted(job)) return { label: "Ready for Review", detail: canManageJob ? "Requirements are clear for manager approval." : "This job can be submitted for manager review.", tone: "green" as const, missing, notDue };
  if (blockers.length) return { label: "Missing items", detail: `${blockers.length} blocking item${blockers.length === 1 ? "" : "s"} must be completed first.`, tone: "orange" as const, missing, notDue };
  return { label: "Not due yet", detail: "Closeout requirements unlock as the work starts and moves toward review.", tone: "blue" as const, missing, notDue };
}

function isCloseoutDue(job: Job, stage: CloseoutStage) {
  return stage !== "current" || ["Needs Inspection", "Complete", "Billed", "Paid"].includes(job.status) || ["Ready", "Sent to Billing", "Sent", "Paid"].includes(job.invoiceStatus);
}

function hasStarted(job: Job) {
  return ["In Progress", "Waiting on Parts", "Needs Inspection", "Complete", "Billed", "Paid"].includes(job.status) || (job.timeEntries || []).some((entry) => ["Arrived", "Work started"].includes(entry.type));
}

function photoCountFor(job: Job, category: NativePhotoCategory) {
  return (groupJobPhotos(job)[category] || []).length;
}

function hasBeforePhotos(job: Job) {
  return photoCountFor(job, "Before") > 0;
}

function hasAfterPhotos(job: Job) {
  return photoCountFor(job, "After") > 0;
}

function hasPaperwork(job: Job, paperwork = job.paperworkItems || defaultPaperwork(job)) {
  const paperworkItems = paperwork.filter((item) => !/sign-?off|invoice/i.test(item.label));
  return Boolean(job.paperworkPickedUp || (job.workOrderFiles || []).some((file) => ["Work Order", "Paperwork", "Signed Document"].includes(file.category || "")) || paperworkItems.some((item) => ["Collected", "Submitted", "Not needed"].includes(item.status)));
}

function hasCompletionSignoff(job: Job) {
  return (job.signoffs || []).some((signoff) => signoff.accepted && ["Completion Sign-off", "Customer Approval"].includes(signoff.type));
}

function receiptBackupApplies(job: Job) {
  return isReceiptBackupMissing(job) || (job.receipts || []).some((receipt) => Boolean(receipt.amount || receipt.file)) || hasFactoryCostWork(job.factoryCost);
}

function CompleteJobFlow({ job, saving, canManageJob, onFinishWork, onSave }: { job: Job; saving: boolean; canManageJob: boolean; onFinishWork: () => void; onSave: (patch: Partial<Job>) => Promise<Job | undefined> }) {
  const [notes, setNotes] = useState(job.completionNotes || "");
  const [notified, setNotified] = useState(false);
  const [invoiceReady, setInvoiceReady] = useState(job.invoiceStatus === "Ready");
  const [requireAfterPhotos, setRequireAfterPhotos] = useState(true);
  const session = getWorkSession(job);
  const draftJob = { ...job, completionNotes: notes.trim() || job.completionNotes };
  const reviewRequirements = closeoutRequirements(draftJob, "review", { requireAfterPhotos });
  const reviewBlockers = blockingRequirements(reviewRequirements);
  const afterPhotosReady = hasAfterPhotos(job);
  const canSubmitForReview = reviewBlockers.length === 0;
  const canComplete = canManageJob && canSubmitForReview;

  useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.json())
      .then((settings) => setRequireAfterPhotos(settings.requireAfterPhotosToComplete ?? true))
      .catch(() => setRequireAfterPhotos(true));
  }, []);

  async function completeJob() {
    if (!canComplete) return;
    const checklist = job.checklist.map((item) => {
      const completeLabels = ["Work completed", "After photos taken", "Completion notes added", "Dealer/factory notified"];
      return completeLabels.includes(item.label) ? { ...item, complete: true } : item;
    });
    await onSave({
      status: "Complete",
      completionNotes: notes.trim(),
      invoiceStatus: invoiceReady ? "Ready" : job.invoiceStatus,
      checklist,
      activityLog: addJobActivity(job, `Job marked complete.${notified ? " Customer/source notified." : ""}${invoiceReady ? " Invoice marked ready." : ""}`, "Status"),
    });
  }

  async function sendForManagerReview() {
    if (!canSubmitForReview) return;
    const checklist = job.checklist.map((item) => {
      const completeLabels = ["Work completed", "After photos taken", "Completion notes added"];
      return completeLabels.includes(item.label) ? { ...item, complete: true } : item;
    });
    await onSave({
      status: "Needs Inspection",
      completionNotes: notes.trim(),
      checklist,
      activityLog: addJobActivity(job, "Field work marked ready for manager review.", "Status"),
    });
  }

  return <section id="complete-job" className="card p-4 sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><CheckCircleIcon className="size-5" /></span>
      <div>
        <h2 className="text-lg font-black">Complete job</h2>
        <p className="text-sm text-black/50">Final manager/crew closeout so billing and paperwork do not get missed.</p>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <CloseoutCheck label="After photos" complete={afterPhotosReady} detail={`${photoCountFor(job, "After")} uploaded`} />
      <CloseoutCheck label="Completion notes" complete={notes.trim().length > 0} detail={notes.trim() ? "Added" : "Required"} />
      <CloseoutCheck label="Status" complete={job.status === "Complete"} detail={job.status} />
    </div>
    <label className="mt-4 block"><span className="label">Completion notes</span><textarea className="field min-h-28 resize-y" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What was completed, what was found, anything billing should know..." /></label>
    <div className={`mt-3 grid gap-2 ${canManageJob ? "sm:grid-cols-2" : ""}`}>
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 text-sm font-bold"><input type="checkbox" checked={notified} onChange={(event) => setNotified(event.target.checked)} className="size-5 accent-forest" /> Customer/dealer/factory notified</label>
      {canManageJob && <label className="flex min-h-12 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 text-sm font-bold"><input type="checkbox" checked={invoiceReady} onChange={(event) => setInvoiceReady(event.target.checked)} className="size-5 accent-forest" /> Mark invoice ready</label>}
    </div>
    {requireAfterPhotos && !afterPhotosReady && <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">Add at least one After photo before completing the job.</p>}
    {reviewBlockers.length > 0 && <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">Complete {reviewBlockers.length} item{reviewBlockers.length === 1 ? "" : "s"} first: {reviewBlockers.map((item) => item.name).join(", ")}.</p>}
    <div className="mt-4 rounded-2xl border border-black/10 bg-sand p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black">Finish Work</p>
          <p className="text-xs font-semibold text-black/45">{session.active ? "Closes the current work session without submitting for review." : session.started ? "Current work session is already closed." : "Start the job before finishing work."}</p>
        </div>
        <button type="button" disabled={saving || !session.active} onClick={onFinishWork} className="min-h-11 rounded-xl bg-ink px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving..." : "Finish Work"}</button>
      </div>
    </div>
    <div className={`mt-4 grid gap-2 ${canManageJob ? "sm:grid-cols-2" : ""}`}>
      <button type="button" disabled={saving || !canSubmitForReview} onClick={sendForManagerReview} className="min-h-12 rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black text-ink disabled:opacity-50">{saving ? "Saving…" : canSubmitForReview ? "Submit for Review" : `Complete ${reviewBlockers.length} items first`}</button>
      {canManageJob && <button type="button" disabled={saving || !canComplete} onClick={completeJob} className="min-h-12 rounded-xl bg-forest px-4 py-3 font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Manager Approve Complete"}</button>}
    </div>
  </section>;
}

function PartsPanel({ job, saving, onSave }: { job: Job; saving: boolean; onSave: (patch: Partial<Job>) => Promise<Job | undefined> }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const parts = job.partsItems || [];
  const openParts = parts.filter((part) => ["Needed", "Ordered", "Picked up"].includes(part.status));

  async function addPart(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const part: PartItem = {
      id: `part-${Date.now()}`,
      name: trimmed,
      quantity: quantity.trim() || "1",
      status: "Needed",
      requestedBy: "Field",
      requestedAt: new Date().toISOString(),
      notes: notes.trim(),
    };
    await onSave({
      partsItems: [part, ...parts],
      status: job.status === "Complete" ? job.status : "Waiting on Parts",
      partsNeeded: [job.partsNeeded, `${part.quantity} × ${part.name}${part.notes ? ` — ${part.notes}` : ""}`].filter(Boolean).join("\n"),
      activityLog: addJobActivity(job, `Part requested: ${part.quantity} × ${part.name}.`, "Parts"),
    });
    setName("");
    setQuantity("1");
    setNotes("");
  }

  async function updatePart(id: string, status: PartItem["status"]) {
    const current = parts.find((part) => part.id === id);
    const nextParts = parts.map((part) => part.id === id ? { ...part, status } : part);
    const stillOpen = nextParts.some((part) => ["Needed", "Ordered", "Picked up"].includes(part.status));
    await onSave({
      partsItems: nextParts,
      status: stillOpen && !["Complete", "Billed", "Paid"].includes(job.status) ? "Waiting on Parts" : job.status,
      activityLog: addJobActivity(job, `Part updated: ${current?.name || "part"} marked ${status}.`, "Parts"),
    });
  }

  return <section id="parts-needed" className="card p-4 sm:p-6 scroll-mt-24">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-800"><WrenchScrewdriverIcon className="size-5" /></span>
      <div>
        <h2 className="text-lg font-black">Parts tracker</h2>
        <p className="text-sm text-black/50">Request, order, pick up, and install parts without losing the note in a text box.</p>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <MiniMetric label="Open parts" value={openParts.length} icon={<WrenchScrewdriverIcon />} />
      <MiniMetric label="Total requested" value={parts.length} icon={<ClipboardDocumentListIcon />} />
      <MiniMetric label="Installed" value={parts.filter((part) => part.status === "Installed").length} icon={<CheckCircleIcon />} />
    </div>
    <form onSubmit={addPart} className="mt-4 grid gap-2 rounded-2xl border border-black/10 bg-white p-3 sm:grid-cols-[1fr_.35fr]">
      <input className="field !min-h-11 !py-2 text-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="Part needed" />
      <input className="field !min-h-11 !py-2 text-sm" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Qty" />
      <input className="field !min-h-11 !py-2 text-sm sm:col-span-2" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes: where to buy, size, color, serial, etc." />
      <button disabled={saving || !name.trim()} className="min-h-11 rounded-xl bg-ink px-4 py-2 font-black text-white disabled:opacity-50 sm:col-span-2">{saving ? "Saving…" : "Request Part"}</button>
    </form>
    <div className="mt-4 space-y-2">
      {parts.length ? parts.map((part) => <div key={part.id} className="rounded-xl bg-sand p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-black">{part.quantity} × {part.name}</p>
            <p className="text-xs font-semibold text-black/45">Requested {new Date(part.requestedAt).toLocaleDateString()} by {part.requestedBy}</p>
            {part.notes && <p className="mt-1 text-xs font-semibold text-black/55">{part.notes}</p>}
          </div>
          <select className="field !min-h-10 !w-auto !py-2 text-sm font-bold" value={part.status} onChange={(event) => updatePart(part.id, event.target.value as PartItem["status"])}>
            {["Needed", "Ordered", "Picked up", "Installed", "Not needed"].map((status) => <option key={status}>{status}</option>)}
          </select>
        </div>
      </div>) : <p className="rounded-xl bg-sand p-3 text-sm font-semibold text-black/45">No structured parts requested yet.</p>}
    </div>
  </section>;
}

function CloseoutCheck({ label, complete, detail }: { label: string; complete: boolean; detail: string }) {
  return <div className={`rounded-xl border p-3 ${complete ? "border-forest/15 bg-forest/5" : "border-orange-200 bg-orange-50"}`}>
    <p className={`text-xs font-black uppercase tracking-wide ${complete ? "text-forest" : "text-orange-800"}`}>{complete ? "Ready" : "Needed"}</p>
    <p className="font-black">{label}</p>
    <p className="text-xs font-semibold text-black/45">{detail}</p>
  </div>;
}

function CloseoutRequirementRow({ requirement }: { requirement: CloseoutRequirement }) {
  const statusLabel: Record<CloseoutRequirementStatus, string> = {
    complete: "Complete",
    missing: "Missing",
    "not-required": "Not required",
    "not-due": "Not due yet",
  };
  const tone = requirement.status === "complete" ? "border-forest/15 bg-forest/5 text-forest" : requirement.status === "missing" ? "border-orange-200 bg-orange-50 text-orange-800" : "border-black/10 bg-sand text-black/45";
  const content = <div className="flex min-h-14 items-start justify-between gap-3 rounded-xl border p-3">
    <div className="min-w-0">
      <p className="font-black text-ink">{requirement.name}</p>
      <p className="mt-0.5 text-xs font-semibold text-black/45">{requirement.detail}</p>
    </div>
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${tone}`}>{statusLabel[requirement.status]}</span>
  </div>;
  if (!requirement.href || requirement.status !== "missing") return content;
  return <a href={requirement.href} className="block">{content}</a>;
}

function GuidedCloseoutPanel({ job, canManageJob }: { job: Job; canManageJob: boolean }) {
  const requirements = closeoutRequirements(job);
  const summary = closeoutReadiness(job, canManageJob);
  const blockers = blockingRequirements(requirements);
  const nextAction = blockers.find((item) => item.href) || requirements.find((item) => item.status === "missing" && item.href);
  const bannerClass = summary.tone === "green" ? "bg-forest text-white" : summary.tone === "orange" ? "bg-orange-50 text-orange-900" : "bg-blue-50 text-blue-900";

  return <section className="card overflow-hidden">
    <div className={`p-4 ${bannerClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest opacity-70">Smart closeout</p>
          <h2 className="mt-1 text-2xl font-black">{summary.label}</h2>
          <p className="mt-1 text-sm font-semibold opacity-75">{summary.detail}</p>
        </div>
        <div className="flex gap-2 text-center text-xs font-black">
          <span className="rounded-xl bg-white/90 px-3 py-2 text-ink">{summary.missing} missing</span>
          <span className="rounded-xl bg-white/90 px-3 py-2 text-ink">{summary.notDue} not due</span>
        </div>
      </div>
    </div>
    <div className="space-y-2 p-4">
      {requirements.map((item) => <CloseoutRequirementRow key={item.name} requirement={item} />)}
    </div>
    <div className="border-t border-black/5 p-4">
      {nextAction?.href ? <a href={nextAction.href} className="block min-h-12 rounded-xl bg-forest px-4 py-3 text-center font-black text-white">{nextAction.status === "missing" ? `Fix: ${nextAction.name}` : "Continue Closeout"}</a> : canManageJob ? <a href="#billing-handoff" className="block min-h-12 rounded-xl bg-ink px-4 py-3 text-center font-black text-white">Billing handoff</a> : <a href="#complete-job" className="block min-h-12 rounded-xl bg-forest px-4 py-3 text-center font-black text-white">Submit for Review</a>}
    </div>
    {blockers.length > 0 && <p className="mx-4 mb-4 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">Blocking closeout items: {blockers.map((blocker) => blocker.name).join(", ")}.</p>}
  </section>;
}

function CloseoutQualityPanel({ job }: { job: Job }) {
  const checks = closeoutRequirements(job, "billing");
  const blockers = blockingRequirements(checks);
  const complete = checks.filter((check) => check.status === "complete" || check.status === "not-required").length;
  const score = Math.round((complete / checks.length) * 100);
  return <section className="card p-4 sm:p-6">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-black">Closeout quality check</h2>
        <p className="mt-1 text-sm text-black/50">Manager/billing readiness based on notes, photos, paperwork, parts, and invoice status.</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-black ${blockers.length ? "bg-orange-100 text-orange-800" : "bg-forest text-white"}`}>{score}% ready</span>
    </div>
    <div className="space-y-2">
      {checks.map((check) => <CloseoutRequirementRow key={check.name} requirement={check} />)}
    </div>
    {blockers.length > 0 && <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">Billing blockers: {blockers.map((item) => item.name).join(", ")}.</p>}
  </section>;
}

function billingBlockerAction(blocker: { label: string; detail: string }) {
  switch (blocker.label) {
    case "Job complete": return { label: "Incomplete closeout", href: "#complete-job" };
    case "Completion notes": return { label: "Missing completion notes", href: "#complete-job" };
    case "After photos": return { label: "Missing required photos", href: "#photos" };
    case "Paperwork": return { label: "Missing paperwork", href: "#paperwork" };
    case "Completion sign-off": return { label: "Missing signature", href: "#signoffs" };
    case "Open parts": return { label: "Open parts", href: "#parts" };
    case "Travel arrival": return { label: "Missing drive time", href: "#time-log" };
    case "Mileage log": return { label: "Missing mileage", href: "#time-log" };
    case "Work session": return { label: "Missing work hours", href: "#time-log" };
    case "Helper cost details": return { label: blocker.detail === "Helper rate missing" ? "Missing helper rate" : "Missing helper hours", href: "#time-log" };
    case "Receipt backup": return { label: "Missing required receipt/documentation", href: "#receipts" };
    case "Manager corrections": return { label: "Correction required" };
    default: return { label: blocker.label };
  }
}

type InvoiceSummaryStatus = "Recorded" | "Not recorded" | "Not applicable";
type InvoiceSummaryField = { label: string; value: InvoiceSummaryStatus; href?: string };

function ContractorInvoiceDataSummary({ job }: { job: Job }) {
  const entries = job.timeEntries || [];
  const receipts = job.receipts || [];
  const paperwork = job.paperworkItems || defaultPaperwork(job);
  const tracker = job.factoryCost;
  const tripStarts = entries.filter((entry) => entry.notes === "Started Travel");
  const tripOrigins = tripStarts.map((entry) => entry.origin?.trim()).filter((origin): origin is string => Boolean(origin));
  const paperworkComplete = paperwork.filter((item) => ["Collected", "Submitted", "Not needed"].includes(item.status)).length;
  const acceptedSignoffs = (job.signoffs || []).filter((signoff) => signoff.accepted).length;
  const receiptFiles = summarizeFiles(job).receipts;
  const installedParts = (job.partsItems || []).filter((part) => part.status === "Installed").map((part) => part.name).filter(Boolean);
  const recorded = (value: unknown): InvoiceSummaryStatus => value ? "Recorded" : "Not recorded";
  const receiptCategoryRecorded = (categories: NonNullable<ReceiptItem["category"]>[]) => receipts.some((receipt) => receipt.category && categories.includes(receipt.category));
  const groups: { title: string; fields: InvoiceSummaryField[] }[] = [
    {
      title: "Job",
      fields: [
        { label: "Customer", value: recorded(job.customerName) },
        { label: "Contractor / technician", value: recorded(job.assignedCrew) },
        { label: "Work order", value: recorded(job.factoryWorkOrderNumber) },
        { label: "Serial / unit number", value: recorded(job.serialUnitNumber?.trim()) },
        { label: "Return visit required", value: job.returnVisitRequired === undefined ? "Not recorded" : job.returnVisitRequired ? "Recorded" : "Not applicable" },
        { label: "Job date", value: recorded(job.dueDate) },
        { label: "Work completed", value: recorded(job.completionNotes?.trim()), href: "#complete-job" },
        { label: "Installed parts / add-ons", value: recorded(installedParts.length), href: "#parts" },
      ],
    },
    {
      title: "Travel",
      fields: [
        { label: "Trip date", value: recorded(tripStarts.length), href: "#time-log" },
        { label: "Origin", value: recorded(tripOrigins.length), href: "#time-log" },
        { label: "Destination", value: recorded([job.address, job.city].filter(Boolean).join(", ")), href: "#time-log" },
        { label: "Mileage", value: recorded(entries.some((entry) => entry.mileage?.trim())), href: "#time-log" },
        { label: "Billing mileage", value: recorded(tracker?.miles?.trim()), href: "#factory-costs" },
        { label: "Drive time", value: recorded(tracker?.driveTimeHours?.trim() || formatTravelDuration(entries) !== "0m"), href: "#time-log" },
      ],
    },
    {
      title: "Labor",
      fields: [
        { label: "Work hours", value: recorded(formatEntryDuration(entries, "Work started", "Departed") !== "0m"), href: "#time-log" },
        { label: "Helper hours", value: recorded(tracker?.helperHours?.trim()), href: "#factory-costs" },
      ],
    },
    {
      title: "Expenses",
      fields: [
        { label: "Meals", value: recorded(receiptCategoryRecorded(["Meal"])), href: "#receipts" },
        { label: "Lodging", value: recorded(receiptCategoryRecorded(["Lodging"])), href: "#receipts" },
        { label: "Parts / Materials", value: recorded(receiptCategoryRecorded(["Parts / Materials", "Parts", "Materials"])), href: "#receipts" },
        { label: "Materials tracked", value: recorded(tracker?.materialsTotal?.trim()), href: "#factory-costs" },
        { label: "Misc", value: recorded(receiptCategoryRecorded(["Misc", "Other", "Fuel", "Tools"])), href: "#receipts" },
        { label: "Other expenses tracked", value: recorded(tracker?.otherReceiptsTotal?.trim()), href: "#factory-costs" },
        { label: "Receipt total", value: recorded(receipts.some((receipt) => receipt.amount?.trim())), href: "#receipts" },
        { label: "Receipt/document backup", value: recorded(receiptFiles), href: "#receipts" },
      ],
    },
    {
      title: "Closeout",
      fields: [
        { label: "Paperwork", value: recorded(paperworkComplete), href: "#paperwork" },
        { label: "Signature", value: recorded(acceptedSignoffs), href: "#signoffs" },
        { label: "Customer survey", value: recorded(job.customerSurvey?.completed), href: "#customer-survey" },
        { label: "Service rating", value: recorded(job.customerSurvey?.serviceRating), href: "#customer-survey" },
        { label: "Customer satisfied", value: job.customerSurvey?.customerSatisfied === undefined ? "Not recorded" : "Recorded", href: "#customer-survey" },
        { label: "Survey comments", value: recorded(job.customerSurvey?.comments?.trim()), href: "#customer-survey" },
        { label: "Notes", value: job.completionNotes?.trim() ? "Recorded" : "Not recorded", href: "#complete-job" },
      ],
    },
  ];
  const recordedCount = groups.flatMap((group) => group.fields).filter((field) => field.value === "Recorded").length;
  const fieldCount = groups.flatMap((group) => group.fields).length;

  return <section className="mb-4 rounded-2xl border border-black/10 bg-sand p-4">
    <div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-forest">Manager summary</p><h3 className="mt-1 text-lg font-black">Contractor Invoice Data Summary</h3><p className="mt-1 text-sm text-black/50">Available job and field data only. This does not create an invoice.</p></div><p className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-forest">Contractor paperwork {recordedCount} of {fieldCount} recorded</p></div>
    <div className="grid gap-2 lg:grid-cols-2">
      {groups.map((group) => <div key={group.title} className="rounded-xl bg-white p-3">
        <h4 className="text-sm font-black text-ink">{group.title}</h4>
        <dl className="mt-2 space-y-1 text-sm">{group.fields.map((field) => <div key={field.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><dt className="font-semibold text-black/50">{field.label}</dt><dd className={`text-right text-xs font-black ${field.value === "Recorded" ? "text-forest" : "text-black/45"}`}>{field.href ? <a href={field.href} className="underline">{field.value}</a> : field.value}</dd></div>)}</dl>
      </div>)}
    </div>
  </section>;
}

function BillingHandoffPanel({ job, saving, onSave }: { job: Job; saving: boolean; onSave: (patch: Partial<Job>) => Promise<Job | undefined> }) {
  const billingRequirements = closeoutRequirements(job, "billing");
  const closeoutBlockers = blockingRequirements(billingRequirements);
  const readinessBlockers = billingBlockers(job);
  const actionableBlockers = readinessBlockers.map(billingBlockerAction);
  const blockerNames = [...new Set([...closeoutBlockers.map((blocker) => blocker.name), ...readinessBlockers.map((blocker) => blocker.label)])];
  const blockers = blockerNames.map((name) => ({ name }));
  const complete = billingRequirements.filter((check) => check.status === "complete" || check.status === "not-required").length;
  const score = Math.round((complete / billingRequirements.length) * 100);
  const receiptTotal = (job.receipts || []).reduce((sum, receipt) => sum + (Number(receipt.amount) || 0), 0);
  const factoryCosts = getFactoryCostTotals(job.factoryCost);
  const factoryTotal = job.source === "Factory" ? factoryCosts.grandTotal : 0;
  const receiptBackupMissing = isReceiptBackupMissing(job);
  const [copied, setCopied] = useState(false);

  async function handoff(invoiceStatus: string, message: string) {
    await onSave({
      invoiceStatus,
      activityLog: addJobActivity(job, message, "Invoice"),
    });
  }

  async function handoffWithJobPatch(invoiceStatus: string, message: string, extra: Partial<Job>) {
    await onSave({
      ...extra,
      invoiceStatus,
      activityLog: addJobActivity(job, message, "Invoice"),
    });
  }

  async function saveBillingMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const invoiceAmount = String(data.get("invoiceAmount") || "").trim();
    await onSave({
      invoiceDate: String(data.get("invoiceDate") || "").trim() || undefined,
      invoiceAmount: invoiceAmount ? Number(invoiceAmount) : undefined,
      paymentDueDate: String(data.get("paymentDueDate") || "").trim() || undefined,
      paidDate: String(data.get("paidDate") || "").trim() || undefined,
    });
  }

  async function copyBillingSummary() {
    const summary = [
      `Billing handoff - ${job.jobId}`,
      `Customer: ${job.customerName}`,
      `Source: ${job.source}${job.dealerName ? ` - ${job.dealerName}` : ""}`,
      `Factory WO: ${job.factoryWorkOrderNumber || "N/A"}`,
      `Address: ${job.address}, ${job.city}`,
      `Phone: ${job.phone || "N/A"}`,
      `Job type: ${job.jobType || "N/A"}`,
      `Status: ${job.status}`,
      `Invoice status: ${job.invoiceStatus || "Not started"}`,
      `Invoice date: ${job.invoiceDate || "Not recorded"}`,
      `Invoice amount: ${job.invoiceAmount === undefined ? "Not recorded" : `$${job.invoiceAmount.toFixed(2)}`}`,
      `Payment due date: ${job.paymentDueDate || "Not recorded"}`,
      `Paid date: ${job.paidDate || "Not recorded"}`,
      `Closeout score: ${score}%`,
      `Receipts: ${job.receipts?.length || 0} totaling $${receiptTotal.toFixed(2)}`,
      job.source === "Factory" ? `Factory cost total: $${factoryTotal.toFixed(2)}` : "",
      receiptBackupMissing ? "Receipt backup missing: uploaded receipt file needed." : "",
      `Files: ${job.workOrderFiles?.length || 0}`,
      `Sign-offs: ${job.signoffs?.length || 0}`,
      `Completion notes: ${job.completionNotes || "Missing"}`,
      blockers.length ? `Blockers: ${blockers.map((blocker) => blocker.name).join(", ")}` : "Blockers: None",
    ].join("\n");
    await navigator.clipboard?.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return <section id="billing-handoff" className="card p-4 sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink"><BanknotesIcon className="size-5" /></span>
      <div>
        <h2 className="text-lg font-black">Billing handoff</h2>
        <p className="text-sm text-black/50">One-tap office status for invoice work. This does not create an Invoice Simple invoice yet.</p>
      </div>
    </div>
    <ContractorInvoiceDataSummary job={job} />
    <div className="mb-3 grid gap-3 sm:grid-cols-4">
      <MiniMetric label="Closeout score" value={`${score}%`} icon={<CheckCircleIcon />} />
      <MiniMetric label="Invoice status" value={job.invoiceStatus || "Not started"} icon={<BanknotesIcon />} />
      <MiniMetric label="Blockers" value={blockers.length} icon={<ClipboardDocumentListIcon />} />
      <MiniMetric label={job.source === "Factory" ? "Factory total" : "Receipts"} value={`$${(job.source === "Factory" ? factoryTotal : receiptTotal).toFixed(0)}`} icon={<ReceiptPercentIcon />} />
    </div>
    <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <MiniMetric label="Invoice date" value={job.invoiceDate ? formatJobDate(job.invoiceDate) : "Not recorded"} icon={<CalendarDaysIcon />} />
      <MiniMetric label="Invoice amount" value={job.invoiceAmount === undefined ? "Not recorded" : `$${job.invoiceAmount.toFixed(2)}`} icon={<BanknotesIcon />} />
      <MiniMetric label="Payment due date" value={job.paymentDueDate ? formatJobDate(job.paymentDueDate) : "Not recorded"} icon={<CalendarDaysIcon />} />
      <MiniMetric label="Paid date" value={job.paidDate ? formatJobDate(job.paidDate) : "Not recorded"} icon={<CheckCircleIcon />} />
    </div>
    <form onSubmit={saveBillingMetadata} className="mb-3 grid gap-3 rounded-2xl border border-black/10 bg-sand p-3 sm:grid-cols-2">
      <label><span className="label">Invoice date</span><input name="invoiceDate" type="date" className="field" defaultValue={job.invoiceDate || ""} /></label>
      <label><span className="label">Invoice amount</span><input name="invoiceAmount" type="number" min="0" step="0.01" inputMode="decimal" className="field" defaultValue={job.invoiceAmount ?? ""} placeholder="Not recorded" /></label>
      <label><span className="label">Payment due date</span><input name="paymentDueDate" type="date" className="field" defaultValue={job.paymentDueDate || ""} /></label>
      <label><span className="label">Paid date</span><input name="paidDate" type="date" className="field" defaultValue={job.paidDate || ""} /></label>
      <button disabled={saving} className="min-h-12 rounded-xl bg-white px-4 py-3 font-black text-ink disabled:opacity-50 sm:col-span-2">{saving ? "Saving…" : "Save billing details"}</button>
    </form>
    {actionableBlockers.length > 0 && <div className="mb-3 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">
      <div className="flex items-center justify-between gap-3"><span>Not Ready for Billing</span><span>{actionableBlockers.length} blocker{actionableBlockers.length === 1 ? "" : "s"}</span></div>
      <ul className="mt-2 space-y-1 font-semibold">
        {actionableBlockers.map((blocker) => <li key={blocker.label}>{blocker.href ? <a href={blocker.href} className="underline">{blocker.label}</a> : blocker.label}</li>)}
      </ul>
    </div>}
    {receiptBackupMissing && <p className="mb-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-900">Receipt backup missing for entered dollars. <a href="#receipts" className="underline">Open receipts</a></p>}
    <div className="grid gap-2 sm:grid-cols-3">
      <button type="button" disabled={saving || blockers.length > 0} onClick={() => handoff("Ready", "Billing handoff: marked Ready for Invoice.")} className="min-h-12 rounded-xl bg-forest px-4 py-3 font-black text-white disabled:opacity-50">Ready for Invoice</button>
      <button type="button" disabled={saving} onClick={() => handoff("Needs more info", "Billing handoff: needs more information before invoice.")} className="min-h-12 rounded-xl border-2 border-orange-200 bg-orange-50 px-4 py-3 font-black text-orange-900 disabled:opacity-50">Needs More Info</button>
      <button type="button" disabled={saving || blockers.length > 0 || job.invoiceStatus !== "Ready"} onClick={() => handoff("Sent to Billing", "Billing handoff: sent to billing queue.")} className="min-h-12 rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black disabled:opacity-50">Sent to Billing</button>
      <button type="button" disabled={saving || blockers.length > 0 || !["Sent to Billing", "Ready", "Draft"].includes(job.invoiceStatus)} onClick={() => handoffWithJobPatch("Sent", "Billing handoff: invoice sent to customer.", { status: job.status === "Complete" ? "Billed" : job.status })} className="min-h-12 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 font-black text-blue-900 disabled:opacity-50">Invoice Sent</button>
      <button type="button" disabled={saving} onClick={() => handoff("On hold", "Billing handoff: invoice placed on hold for follow-up.")} className="min-h-12 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 font-black text-amber-900 disabled:opacity-50">On Hold</button>
      <button type="button" disabled={saving || blockers.length > 0 || (!["Sent", "Paid"].includes(job.invoiceStatus) && job.status !== "Billed")} onClick={() => handoffWithJobPatch("Paid", "Billing handoff: invoice marked paid.", { status: "Paid" })} className="min-h-12 rounded-xl bg-lime px-4 py-3 font-black text-ink disabled:opacity-50">Paid</button>
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <button type="button" onClick={copyBillingSummary} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black print:hidden"><ClipboardDocumentListIcon className="size-5" />{copied ? "Billing Summary Copied" : "Copy Billing Summary"}</button>
      <Link href={`/jobs/${job.jobId}/packet`} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black print:hidden"><ClipboardDocumentListIcon className="size-5" />Open Closeout Packet</Link>
    </div>
  </section>;
}

function FactoryCostTrackerPanel({ job, saving, onSave }: { job: Job; saving: boolean; onSave: (patch: Partial<Job>) => Promise<Job | undefined> }) {
  const [draft, setDraft] = useState<FactoryCostTracker>(job.factoryCost || defaultFactoryCost());
  const hasSavedCostWork = hasFactoryCostWork(job.factoryCost);

  useEffect(() => {
    if (job.source !== "Factory" || hasSavedCostWork) return;
    let active = true;
    fetch("/api/settings")
      .then((response) => response.json())
      .then((settings: Partial<BusinessSettings>) => {
        if (active && settings.factoryCostDefaults) setDraft((old) => ({ ...old, ...settings.factoryCostDefaults }));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [hasSavedCostWork, job.source]);

  if (job.source !== "Factory") return null;

  const totals = getFactoryCostTotals(draft);
  const fields: { key: keyof FactoryCostTracker; label: string; placeholder?: string }[] = [
    { key: "miles", label: "Miles", placeholder: "0" },
    { key: "mileageRate", label: "Mileage rate", placeholder: "0.67" },
    { key: "driveTimeHours", label: "Drive time hours", placeholder: "0" },
    { key: "hourlyRate", label: "Hourly rate", placeholder: "0" },
    { key: "helperHours", label: "Helper hours", placeholder: "0" },
    { key: "helperRate", label: "Helper rate", placeholder: "0" },
    { key: "perDiemDays", label: "Per diem days", placeholder: "0" },
    { key: "perDiemRate", label: "Per diem rate", placeholder: "0" },
    { key: "hotelTotal", label: "Hotel receipts total", placeholder: "0.00" },
    { key: "materialsTotal", label: "Materials receipts total", placeholder: "0.00" },
    { key: "otherReceiptsTotal", label: "Other receipts total", placeholder: "0.00" },
  ];

  async function saveTracker() {
    const saved = await onSave({
      factoryCost: draft,
      activityLog: addJobActivity(job, `Factory cost tracker updated. Grand total: $${totals.grandTotal.toFixed(2)}.`, "Invoice"),
    });
    if (saved?.factoryCost) setDraft(saved.factoryCost);
  }

  return <section id="factory-costs" className="card p-4 sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800"><BanknotesIcon className="size-5" /></span>
      <div>
        <h2 className="text-lg font-black">Factory cost tracker</h2>
        <p className="text-sm text-black/50">Track mileage, hotel receipts, per diem, labor/helper time, drive time, materials, and the factory job total.</p>
      </div>
    </div>
    <div className="mb-4 grid gap-3 sm:grid-cols-4">
      <MiniMetric label="Mileage" value={`$${totals.mileage.toFixed(2)}`} icon={<MapPinIcon />} />
      <MiniMetric label="Labor" value={`$${(totals.driveTime + totals.helper).toFixed(2)}`} icon={<ClockIcon />} />
      <MiniMetric label="Receipts" value={`$${(totals.hotel + totals.materials + totals.otherReceipts).toFixed(2)}`} icon={<ReceiptPercentIcon />} />
      <MiniMetric label="Grand total" value={`$${totals.grandTotal.toFixed(2)}`} icon={<BanknotesIcon />} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => <label key={field.key}>
        <span className="label">{field.label}</span>
        <input className="field" inputMode="decimal" value={draft[field.key] || ""} onChange={(event) => setDraft((old) => ({ ...old, [field.key]: event.target.value }))} placeholder={field.placeholder} />
      </label>)}
      <label className="sm:col-span-2">
        <span className="label">Cost notes</span>
        <textarea className="field min-h-24 resize-y" value={draft.notes || ""} onChange={(event) => setDraft((old) => ({ ...old, notes: event.target.value }))} placeholder="Hotel name, receipt notes, material notes, helper details..." />
      </label>
    </div>
    <button type="button" disabled={saving} onClick={saveTracker} className="mt-4 min-h-12 w-full rounded-xl bg-forest px-4 py-3 font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save Factory Cost Tracker"}</button>
  </section>;
}

function SignoffPanel({ job, saving, onSave }: { job: Job; saving: boolean; onSave: (patch: Partial<Job>) => Promise<Job | undefined> }) {
  const [type, setType] = useState<SignoffItem["type"]>("Completion Sign-off");
  const [signerRole, setSignerRole] = useState<SignoffItem["signerRole"]>("Customer");
  const [signerName, setSignerName] = useState(job.customerName || "");
  const [typedSignature, setTypedSignature] = useState("");
  const [accepted, setAccepted] = useState(true);
  const [notes, setNotes] = useState("");
  const signoffs = job.signoffs || [];
  const canSave = signerName.trim() && typedSignature.trim() && accepted;

  async function saveSignoff(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    const signoff: SignoffItem = {
      id: `signoff-${Date.now()}`,
      type,
      signerName: signerName.trim(),
      signerRole,
      signedAt: new Date().toISOString(),
      accepted,
      notes: notes.trim(),
      typedSignature: typedSignature.trim(),
    };
    const nextPaperwork = (job.paperworkItems || defaultPaperwork(job)).map((item) => item.id === "completion-signoff" ? { ...item, status: "Collected" as const, notes: `${signoff.signerName} signed ${new Date(signoff.signedAt).toLocaleDateString()}` } : item);
    await onSave({
      signoffs: [signoff, ...signoffs].slice(0, 25),
      paperworkItems: nextPaperwork,
      activityLog: addJobActivity(job, `${type} signed by ${signoff.signerName}.`, "Signoff"),
    });
    setTypedSignature("");
    setNotes("");
  }

  return <section id="signoffs" className="card p-4 sm:p-6 scroll-mt-24">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><CheckCircleIcon className="size-5" /></span>
      <div>
        <h2 className="text-lg font-black">Customer / source sign-off</h2>
        <p className="text-sm text-black/50">Simple typed sign-off for work authorization, completion proof, or inspection notes.</p>
      </div>
    </div>
    <form onSubmit={saveSignoff} className="grid gap-3 rounded-2xl border border-black/10 bg-white p-3 sm:grid-cols-2">
      <label><span className="label">Sign-off type</span><select className="field" value={type} onChange={(event) => setType(event.target.value as SignoffItem["type"])}>
        {["Completion Sign-off", "Work Authorization", "Customer Approval", "Inspection"].map((option) => <option key={option}>{option}</option>)}
      </select></label>
      <label><span className="label">Signer role</span><select className="field" value={signerRole} onChange={(event) => setSignerRole(event.target.value as SignoffItem["signerRole"])}>
        {["Customer", "Dealer", "Factory", "Manager", "Other"].map((option) => <option key={option}>{option}</option>)}
      </select></label>
      <label><span className="label">Signer name</span><input className="field" value={signerName} onChange={(event) => setSignerName(event.target.value)} placeholder="Customer / dealer / factory contact" /></label>
      <label><span className="label">Typed signature</span><input className="field" value={typedSignature} onChange={(event) => setTypedSignature(event.target.value)} placeholder="Type full name to sign" /></label>
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 text-sm font-bold sm:col-span-2"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="size-5 accent-forest" /> Signer confirms this record is accurate.</label>
      <label className="sm:col-span-2"><span className="label">Notes</span><textarea className="field min-h-24 resize-y" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Example: work completed, customer satisfied, inspection passed, exceptions noted..." /></label>
      <button disabled={saving || !canSave} className="min-h-12 rounded-xl bg-forest px-4 py-3 font-black text-white disabled:opacity-50 sm:col-span-2">{saving ? "Saving…" : "Save Sign-off"}</button>
    </form>
    <div className="mt-4 space-y-2">
      {signoffs.length ? signoffs.slice(0, 5).map((signoff) => <div key={signoff.id} className="rounded-xl bg-sand p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-black">{signoff.type}</p>
            <p className="text-xs font-semibold text-black/45">{signoff.signerName} · {signoff.signerRole} · {new Date(signoff.signedAt).toLocaleString()}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${signoff.accepted ? "bg-forest text-white" : "bg-orange-100 text-orange-800"}`}>{signoff.accepted ? "Accepted" : "Not accepted"}</span>
        </div>
        {signoff.notes && <p className="mt-2 text-sm font-semibold text-black/55">{signoff.notes}</p>}
        <p className="mt-2 rounded-lg bg-white p-2 text-xs font-bold text-black/45">Typed signature: {signoff.typedSignature}</p>
      </div>) : <p className="rounded-xl bg-sand p-3 text-sm font-semibold text-black/45">No sign-offs saved yet.</p>}
    </div>
  </section>;
}

function CustomerSurveyPanel({ job, saving, onSave }: { job: Job; saving: boolean; onSave: (patch: Partial<Job>) => Promise<Job | undefined> }) {
  const [survey, setSurvey] = useState<CustomerSurvey>(job.customerSurvey || { completed: false });
  const set = <K extends keyof CustomerSurvey>(key: K, value: CustomerSurvey[K]) => setSurvey((current) => ({ ...current, [key]: value }));

  async function saveSurvey(event: React.FormEvent) {
    event.preventDefault();
    const customerSurvey: CustomerSurvey = {
      ...survey,
      comments: survey.comments?.trim() || undefined,
      completedDate: survey.completed ? survey.completedDate || new Date().toISOString() : undefined,
    };
    await onSave({
      customerSurvey,
      activityLog: addJobActivity(job, customerSurvey.completed ? "Customer survey recorded as complete." : "Customer survey updated.", "Customer"),
    });
  }

  return <section id="customer-survey" className="card p-4 sm:p-6 scroll-mt-24">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-800"><ChatBubbleLeftRightIcon className="size-5" /></span>
      <div><h2 className="text-lg font-black">Customer Survey</h2><p className="text-sm text-black/50">Record the customer’s service feedback. An existing customer sign-off can be reused; no additional signature is needed.</p></div>
    </div>
    <form onSubmit={saveSurvey} className="grid gap-3 rounded-2xl border border-black/10 bg-white p-3 sm:grid-cols-2">
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-black/10 bg-sand p-3 text-sm font-bold sm:col-span-2"><input type="checkbox" checked={survey.completed} onChange={(event) => set("completed", event.target.checked)} className="size-5 accent-forest" /> Survey completed</label>
      <label><span className="label">Service rating</span><select className="field" value={survey.serviceRating || ""} onChange={(event) => set("serviceRating", event.target.value as CustomerSurvey["serviceRating"] || undefined)}><option value="">Not recorded</option>{["1", "2", "3", "4", "5"].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>
      <label><span className="label">Customer satisfied</span><select className="field" value={survey.customerSatisfied === undefined ? "" : survey.customerSatisfied ? "yes" : "no"} onChange={(event) => set("customerSatisfied", event.target.value === "" ? undefined : event.target.value === "yes")}><option value="">Not recorded</option><option value="yes">Yes</option><option value="no">No</option></select></label>
      <label><span className="label">Would recommend</span><select className="field" value={survey.wouldRecommend === undefined ? "" : survey.wouldRecommend ? "yes" : "no"} onChange={(event) => set("wouldRecommend", event.target.value === "" ? undefined : event.target.value === "yes")}><option value="">Not recorded</option><option value="yes">Yes</option><option value="no">No</option></select></label>
      <label className="sm:col-span-2"><span className="label">Comments</span><textarea className="field min-h-24 resize-y" value={survey.comments || ""} onChange={(event) => set("comments", event.target.value)} placeholder="Customer feedback or follow-up notes" /></label>
      <button disabled={saving} className="min-h-12 rounded-xl bg-forest px-4 py-3 font-black text-white disabled:opacity-50 sm:col-span-2">{saving ? "Saving…" : "Save Customer Survey"}</button>
    </form>
  </section>;
}

function addJobActivity(job: Job, message: string, type: JobActivity["type"] = "Note") {
  const entry: JobActivity = {
    id: `activity-${Date.now()}`,
    type,
    message,
    createdAt: new Date().toISOString(),
    createdBy: "Manager",
  };
  return [entry, ...(job.activityLog || [])].slice(0, 50);
}

function getWorkSession(job: Job) {
  const entries = [...(job.timeEntries || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const started = entries.find((entry) => entry.type === "Work started");
  const finished = entries.find((entry) => entry.type === "Departed");
  return {
    started,
    finished,
    active: Boolean(started && (!finished || started.createdAt > finished.createdAt)),
  };
}

function getTravelState(job: Job) {
  const entries = [...(job.timeEntries || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const started = entries.find((entry) => entry.notes === "Started Travel");
  const arrived = entries.find((entry) => entry.type === "Arrived");
  return {
    started,
    arrived,
    active: Boolean(started && (!arrived || started.createdAt > arrived.createdAt)),
  };
}

function buildTimeActivity(job: Job, employeeName: string, message: string) {
  const entry: JobActivity = {
    id: `activity-${Date.now()}`,
    type: "Time",
    message,
    createdAt: new Date().toISOString(),
    createdBy: employeeName,
    audience: "All",
  };
  return [entry, ...(job.activityLog || [])].slice(0, 50);
}

function activityMessageForTimeEntry(entry: TimeEntry) {
  if (entry.notes === "Started Travel") return "Started Travel";
  if (entry.type === "Arrived") return "Arrived at Job";
  if (entry.type === "Mileage") return `Mileage Added${entry.mileage ? ` (${entry.mileage} miles)` : ""}${entry.notes ? ` - ${entry.notes}` : ""}`;
  if (entry.type === "Departed") return "Departed";
  if (entry.type === "Work started") return "Started Job";
  return `Time log: ${entry.type}${entry.notes ? ` - ${entry.notes}` : ""}`;
}

function validMileage(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0;
}

function travelLabel(travel: ReturnType<typeof getTravelState>) {
  if (travel.active) return "Travel is active. Tap Arrive at Job when you get on site.";
  if (travel.started && travel.arrived && travel.arrived.createdAt > travel.started.createdAt) return "Arrived at job. Start or continue work separately.";
  if (travel.started) return "Travel was started. Arrival has not been recorded.";
  return "No travel started for this job yet.";
}

function travelDuration(travel: ReturnType<typeof getTravelState>) {
  if (!travel.started) return "Not available";
  const end = travel.arrived && travel.arrived.createdAt > travel.started.createdAt ? travel.arrived.createdAt : undefined;
  return formatElapsed(travel.started.createdAt, end);
}

function formatSessionDate(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatElapsed(startedAt: string, finishedAt?: string) {
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - new Date(startedAt).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  if (!remainder) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function formatWorkedToday(entries: TimeEntry[], today: string) {
  const todayEntries = entries
    .filter((entry) => entry.createdAt.slice(0, 10) === today && ["Work started", "Departed"].includes(entry.type))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let startedAt = "";
  let totalMinutes = 0;
  for (const entry of todayEntries) {
    if (entry.type === "Work started") {
      startedAt = entry.createdAt;
    } else if (entry.type === "Departed" && startedAt) {
      totalMinutes += Math.max(0, Math.round((new Date(entry.createdAt).getTime() - new Date(startedAt).getTime()) / 60000));
      startedAt = "";
    }
  }
  if (startedAt) totalMinutes += Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function CalendarPanel({ job, setJob }: { job: Job; setJob: React.Dispatch<React.SetStateAction<Job>> }) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  async function syncCalendar() {
    setSyncing(true);
    setMessage("");
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncToCalendar: true }),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || "Google Calendar sync failed.");
      setJob((old) => ({ ...old, ...saved }));
      if (saved.googleCalendarEventUrl) setMessage("Google Calendar event linked.");
      else if (saved.integrationWarnings?.length) setMessage(saved.integrationWarnings.join(" "));
      else setMessage("Calendar sync is turned on, but Google Calendar credentials are not connected yet.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Google Calendar sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  const calendarDate = job.dueDate ? new Date(`${job.dueDate}T12:00:00`) : null;
  const calendarLocation = [job.address, job.city].filter(Boolean).join(", ");
  const googleCalendarQuickAdd = calendarDate ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${job.jobId} — ${job.customerName} — ${job.jobType}`)}&dates=${job.dueDate.replaceAll("-", "")}/${new Date(calendarDate.getTime() + 86400000).toISOString().slice(0, 10).replaceAll("-", "")}&location=${encodeURIComponent(calendarLocation)}&details=${encodeURIComponent(`Status: ${job.status}\nEmployees: ${job.assignedCrew}\nPriority: ${job.priority}\n\n${job.scopeNotes}`)}` : "https://calendar.google.com";

  return <section id="scheduling" className="card p-4 sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><CalendarDaysIcon className="size-5" /></span>
      <div>
        <h2 className="text-lg font-black">Scheduling</h2>
        <p className="text-sm text-black/50">Place this job on Google Calendar and keep the profile linked.</p>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-sand p-4">
        <p className="text-xs font-black uppercase tracking-wide text-black/35">Due date</p>
        <p className="font-extrabold">{calendarDate ? calendarDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "No due date"}</p>
        <p className="mt-2 text-xs font-semibold text-black/45">{job.googleCalendarEventUrl ? "Linked to Google Calendar" : "Not linked to Google Calendar yet"}</p>
      </div>
      <div className="space-y-2">
        {job.googleCalendarEventUrl && <a href={job.googleCalendarEventUrl} target="_blank" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 font-black text-white">Open Calendar Event <ArrowTopRightOnSquareIcon className="size-5" /></a>}
        <button type="button" onClick={syncCalendar} disabled={syncing || !job.dueDate} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black disabled:opacity-50"><ArrowPathIcon className={`size-5 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Syncing…" : job.googleCalendarEventUrl ? "Update Google Calendar" : "Add to Google Calendar"}</button>
        <a href={googleCalendarQuickAdd} target="_blank" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-center font-black text-emerald-900">Open Google quick add <ArrowTopRightOnSquareIcon className="size-5" /></a>
      </div>
    </div>
    {message && <p className="mt-3 rounded-lg border border-black/10 bg-white p-3 text-sm font-bold text-black/60">{message}</p>}
  </section>;
}

function defaultPaperwork(job: Job): PaperworkItem[] {
  return [
    { id: "work-order", label: job.source === "Factory" ? "Factory work order" : job.source === "Dealer" ? "Dealer paperwork" : "Customer work authorization", status: job.paperworkPickedUp ? "Collected" : "Needed", notes: job.factoryWorkOrderNumber || job.dealerName || "" },
    { id: "completion-signoff", label: "Completion sign-off", status: job.status === "Complete" || job.status === "Billed" || job.status === "Paid" ? "Collected" : "Needed" },
    { id: "invoice-backup", label: "Invoice backup", status: job.invoiceStatus === "Sent" || job.invoiceStatus === "Paid" ? "Submitted" : "Needed" },
  ];
}

function OperationsPanel({ job, setJob, mode }: { job: Job; setJob: React.Dispatch<React.SetStateAction<Job>>; mode: "documents" | "notes" | "history" }) {
  const [note, setNote] = useState("");
  const [audience, setAudience] = useState<JobActivity["audience"]>("All");
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const paperwork = job.paperworkItems || defaultPaperwork(job);
  const receipts = job.receipts || [];
  const activity = job.activityLog || [];
  const workOrderFiles = job.workOrderFiles || [];
  const collected = paperwork.filter((item) => item.status === "Collected" || item.status === "Submitted" || item.status === "Not needed").length;
  const receiptTotal = receipts.reduce((sum, receipt) => sum + (Number(receipt.amount) || 0), 0);
  const fileSummary = summarizeFiles(job);

  async function savePatch(patch: Partial<Job>) {
    setSaving(true);
    setError("");
    const next = { ...job, ...patch };
    const correctionPatch = correctionResolutionPatch(job, next);
    const finalNext = { ...next, ...correctionPatch };
    const patchToSave = { ...patch, ...correctionPatch };
    setJob(finalNext);
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patchToSave) });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || "The job update could not be saved.");
      setJob((old) => ({ ...old, ...saved, checklist: saved.checklist?.length ? saved.checklist : old.checklist }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The job update could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function addActivity(message: string, type: JobActivity["type"] = "Note") {
    const entry: JobActivity = {
      id: `activity-${Date.now()}`,
      type,
      message,
      createdAt: new Date().toISOString(),
      createdBy: "Manager",
      audience,
      notify,
    };
    return [entry, ...activity].slice(0, 50);
  }

  async function submitNote(message = note, type: JobActivity["type"] = "Note") {
    const trimmed = message.trim();
    if (!trimmed) return;
    setNote("");
    setNotify(false);
    await savePatch({ activityLog: addActivity(trimmed, type) });
  }

  async function updatePaperwork(id: string, status: PaperworkItem["status"]) {
    const nextPaperwork = paperwork.map((item) => item.id === id ? { ...item, status } : item);
    await savePatch({ paperworkItems: nextPaperwork, activityLog: addActivity(`Paperwork updated: ${paperwork.find((item) => item.id === id)?.label} marked ${status}.`, "Paperwork") });
  }

  async function addReceipt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const vendor = String(formData.get("vendor") || "").trim();
    const amount = String(formData.get("amount") || "").trim();
    const file = formData.get("receiptFile");
    if (!vendor && !amount && !(file instanceof File && file.size > 0)) return;
    const uploadedFile = file instanceof File && file.size > 0 ? await uploadStoredFile(file, job.jobId, "Receipt") : undefined;
    const receipt: ReceiptItem = {
      id: `receipt-${Date.now()}`,
      vendor: vendor || "Receipt",
      amount,
      category: String(formData.get("category") || "Misc") as NonNullable<ReceiptItem["category"]>,
      date: String(formData.get("date") || new Date().toLocaleDateString("en-CA")),
      reimbursable: formData.get("reimbursable") === "on",
      notes: String(formData.get("notes") || "").trim(),
      file: uploadedFile,
    };
    await savePatch({ receipts: [receipt, ...receipts], activityLog: addActivity(`Receipt added: ${receipt.vendor}${receipt.amount ? ` $${receipt.amount}` : ""}.`, "Receipt") });
    event.currentTarget.reset();
  }

  async function addPaperworkFile(file: File | undefined, category: FileCategory) {
    if (!file) return;
    const uploaded = await uploadStoredFile(file, job.jobId, category);
    await savePatch({
      workOrderFiles: [uploaded, ...workOrderFiles],
      paperworkItems: paperwork.map((item) => item.id === "work-order" ? { ...item, status: "Collected", notes: uploaded.fileName } : item),
      activityLog: addActivity(`${category} uploaded: ${uploaded.fileName}.`, "Paperwork"),
    });
  }

  if (mode === "documents") {
    return <section id="documents-panel" className="card p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink"><ClipboardDocumentListIcon className="size-5" /></span>
        <div>
          <h2 className="text-lg font-black">Documents</h2>
          <p className="text-sm text-black/50">Paperwork, receipts, signed documents, and work order files for this job.</p>
        </div>
      </div>
      {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Paperwork" value={`${collected}/${paperwork.length}`} icon={<ClipboardDocumentListIcon />} />
        <MiniMetric label="Receipts" value={`$${receiptTotal.toFixed(2)}`} icon={<ReceiptPercentIcon />} />
        <MiniMetric label="Files" value={workOrderFiles.length} icon={<ClipboardDocumentListIcon />} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black text-black/55 sm:grid-cols-5">
        <FileSummaryPill label="Work orders" value={fileSummary.workOrders} />
        <FileSummaryPill label="Paperwork" value={fileSummary.paperwork} />
        <FileSummaryPill label="Signed docs" value={fileSummary.signedDocs} />
        <FileSummaryPill label="Receipt files" value={fileSummary.receipts} />
        <FileSummaryPill label="Other" value={fileSummary.other} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div id="paperwork" className="rounded-2xl border border-black/10 bg-white p-3">
          <h3 className="mb-3 font-black">Paperwork</h3>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <FileUploadButton label="Upload work order" category="Work Order" disabled={saving} onFile={addPaperworkFile} />
            <FileUploadButton label="Upload paperwork" category="Paperwork" disabled={saving} onFile={addPaperworkFile} />
            <FileUploadButton label="Upload signed doc" category="Signed Document" disabled={saving} onFile={addPaperworkFile} />
          </div>
          {workOrderFiles.length > 0 && <FileList files={workOrderFiles} />}
          <div className="space-y-2">{paperwork.map((item) => <div key={item.id} className="rounded-xl bg-sand p-3">
            <p className="font-extrabold">{item.label}</p>
            {item.notes && <p className="text-xs font-semibold text-black/45">{item.notes}</p>}
            <select className="field mt-2 !min-h-10 !py-2 text-sm" value={item.status} onChange={(event) => updatePaperwork(item.id, event.target.value as PaperworkItem["status"])}>
              {["Needed", "Collected", "Submitted", "Not needed"].map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>)}</div>
        </div>
        <div id="receipts" className="rounded-2xl border border-black/10 bg-white p-3">
          <h3 className="mb-3 font-black">Receipts</h3>
          <form onSubmit={addReceipt} className="grid gap-2">
            <input name="vendor" className="field !min-h-11 !py-2 text-sm" placeholder="Vendor / store" />
            <div className="grid grid-cols-2 gap-2">
              <input name="amount" className="field !min-h-11 !py-2 text-sm" inputMode="decimal" placeholder="Amount" />
              <input name="date" type="date" className="field !min-h-11 !py-2 text-sm" defaultValue={new Date().toLocaleDateString("en-CA")} />
            </div>
            <select name="category" className="field !min-h-11 !py-2 text-sm">{["Meal", "Lodging", "Parts / Materials", "Misc"].map((category) => <option key={category}>{category}</option>)}</select>
            <label className="flex min-h-10 items-center gap-2 text-sm font-bold"><input name="reimbursable" type="checkbox" className="size-4 accent-forest" /> Reimbursable</label>
            <input name="notes" className="field !min-h-11 !py-2 text-sm" placeholder="Notes" />
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 bg-sand px-3 py-3 text-center text-sm font-black text-ink">
              Upload receipt photo/PDF
              <input name="receiptFile" type="file" accept="image/*,.pdf" className="hidden" />
            </label>
            <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-ink px-4 py-2 font-black text-white disabled:opacity-50">Add Receipt</button>
          </form>
          <div className="mt-3 space-y-2">{receipts.slice(0, 5).map((receipt) => <div key={receipt.id} className="rounded-xl bg-sand p-3 text-sm">
            <div className="flex justify-between gap-3"><span className="font-extrabold">{receipt.vendor}</span><span className="font-black">${receipt.amount || "0"}</span></div>
            <p className="text-xs font-semibold text-black/45">{receipt.category || "Uncategorized"} · {receipt.date}{receipt.reimbursable ? " · Reimbursable" : ""}</p>
            {receipt.notes && <p className="mt-1 text-xs text-black/55">{receipt.notes}</p>}
            {receipt.file && <a href={receipt.file.storageUrl || receipt.file.dataUrl} target="_blank" className="mt-2 inline-flex min-h-10 items-center justify-center rounded-lg bg-white px-3 py-2 text-xs font-black text-forest">Open receipt file</a>}
          </div>)}</div>
        </div>
      </div>
    </section>;
  }

  if (mode === "notes") {
    return <section id="operations" className="card p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink"><ChatBubbleLeftRightIcon className="size-5" /></span>
        <div>
          <h2 className="text-lg font-black">Notes</h2>
          <p className="text-sm text-black/50">Customer, dealer/factory, manager, and field notes for this job.</p>
        </div>
      </div>
      {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      <MiniMetric label="Updates" value={activity.length} icon={<ChatBubbleLeftRightIcon />} />
      <div className="mt-5 rounded-2xl border border-black/10 bg-white p-3">
        <label className="label">Add job update</label>
        <textarea className="field min-h-24 resize-y" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Example: Customer called, parts ordered, dealer notified..." />
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label><span className="label">Who is this update for?</span><select value={audience} onChange={(event) => setAudience(event.target.value as JobActivity["audience"])} className="field !min-h-11 !py-2 text-sm font-bold">
            {["All", "Admin", "Manager", "Employee"].map((option) => <option key={option}>{option}</option>)}
          </select></label>
          <label className="flex min-h-11 items-center gap-2 self-end rounded-xl border border-black/10 bg-sand px-3 py-2 text-sm font-bold"><input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} className="size-4 accent-forest" /> Flag for follow-up</label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["Customer contacted", "Left voicemail", "Text sent", "Parts ordered", "Dealer/factory notified", "Work complete"] as const).map((template) => <button key={template} type="button" onClick={() => submitNote(template, template === "Parts ordered" ? "Parts" : template === "Work complete" ? "Status" : template === "Dealer/factory notified" ? "Source" : "Customer")} className="min-h-11 rounded-xl border border-black/10 bg-sand px-3 py-2 text-xs font-black text-ink">{template}</button>)}
        </div>
        <button type="button" disabled={saving || !note.trim()} onClick={() => submitNote()} className="mt-3 min-h-12 w-full rounded-xl bg-forest px-4 py-3 font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save Update"}</button>
      </div>
    </section>;
  }

  return <section id="history" className="card p-4 sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink"><ClipboardDocumentListIcon className="size-5" /></span>
      <div>
        <h2 className="text-lg font-black">History</h2>
        <p className="text-sm text-black/50">Existing activity log records for this job.</p>
      </div>
    </div>
    <div className="space-y-2">{activity.length ? activity.slice(0, 8).map((entry) => <div key={entry.id} className="rounded-xl bg-sand p-3">
      <div className="flex items-start justify-between gap-3"><p className="font-bold">{entry.message}</p><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-black/45">{entry.type}</span></div>
      <p className="mt-1 text-xs font-semibold text-black/40">{entry.createdBy} · {new Date(entry.createdAt).toLocaleString()} · {entry.audience || "All"}{entry.notify ? " · Follow-up flagged" : ""}</p>
    </div>) : <p className="rounded-xl bg-sand p-3 text-sm font-semibold text-black/45">No updates yet.</p>}</div>
  </section>;
}

function MiniMetric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <div className="rounded-xl bg-sand p-3"><div className="mb-2 text-forest [&>svg]:size-5">{icon}</div><p className="text-2xl font-black">{value}</p><p className="text-xs font-bold text-black/45">{label}</p></div>;
}

function FileSummaryPill({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-sand p-3 text-center">
    <p className="text-xl font-black text-ink">{value}</p>
    <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-black/40">{label}</p>
  </div>;
}

function summarizeFiles(job: Job) {
  const summary = { workOrders: 0, paperwork: 0, signedDocs: 0, receipts: 0, other: 0 };
  for (const file of job.workOrderFiles || []) {
    if (file.category === "Work Order") summary.workOrders += 1;
    else if (file.category === "Paperwork") summary.paperwork += 1;
    else if (file.category === "Signed Document") summary.signedDocs += 1;
    else if (file.category === "Receipt") summary.receipts += 1;
    else summary.other += 1;
  }
  for (const receipt of job.receipts || []) {
    if (receipt.file) summary.receipts += 1;
  }
  return summary;
}

function OfflineDraftPanel({ job, saving, onSave }: { job: Job; saving: boolean; onSave: (patch: Partial<Job>) => Promise<Job | undefined> }) {
  const [draft, setDraft] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState("");
  const storageKey = `company-command-draft-${job.jobId}`;

  useEffect(() => {
    setOnline(navigator.onLine);
    const saved = window.localStorage.getItem(storageKey) || "";
    setDraft(saved);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [storageKey]);

  function saveDraft(value: string) {
    setDraft(value);
    window.localStorage.setItem(storageKey, value);
    setLastSaved(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    setMessage("");
  }

  async function pushDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const entry = addJobActivity(job, `Field draft note: ${trimmed}`, "Note");
    const saved = await onSave({ activityLog: entry });
    if (saved) {
      window.localStorage.removeItem(storageKey);
      setDraft("");
      setMessage("Draft pushed to job activity.");
    } else {
      setMessage("Could not push yet. Draft is still saved on this phone.");
    }
  }

  function clearDraft() {
    window.localStorage.removeItem(storageKey);
    setDraft("");
    setMessage("Draft cleared from this phone.");
  }

  return <section className="card p-4 sm:p-6 print:hidden">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800"><ChatBubbleLeftRightIcon className="size-5" /></span>
        <div>
          <h2 className="text-lg font-black">Offline field draft</h2>
          <p className="text-sm text-black/50">Scratch notes save on this phone first. Push them to job activity when ready.</p>
        </div>
      </div>
      <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${online ? "bg-forest text-white" : "bg-orange-100 text-orange-800"}`}>{online ? "Online" : "Offline"}</span>
    </div>
    <textarea className="field min-h-32 resize-y" value={draft} onChange={(event) => saveDraft(event.target.value)} placeholder="Type field notes here even if service is bad. Example: customer wants call before arrival, extra trim damage on back side..." />
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
      <p className="text-xs font-bold text-black/40">{draft ? `Saved on this phone${lastSaved ? ` at ${lastSaved}` : ""}.` : "No local draft saved."}</p>
      <button type="button" onClick={clearDraft} disabled={!draft || saving} className="min-h-11 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-black text-black/55 disabled:opacity-50">Clear Draft</button>
      <button type="button" onClick={pushDraft} disabled={!draft.trim() || saving} className="min-h-11 rounded-xl bg-forest px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Push to Activity"}</button>
    </div>
    {message && <p className="mt-3 rounded-xl bg-sand p-3 text-sm font-bold text-black/55">{message}</p>}
  </section>;
}

function TimeLogPanel({ job, saving, onSave }: { job: Job; saving: boolean; onSave: (patch: Partial<Job>) => Promise<Job | undefined> }) {
  const user = useAuthUser();
  const [mileage, setMileage] = useState("");
  const [origin, setOrigin] = useState("");
  const [notes, setNotes] = useState("");
  const [mileageError, setMileageError] = useState("");
  const entries = job.timeEntries || [];
  const employeeName = user?.employeeName || user?.email || "Field";
  const today = new Date().toLocaleDateString("en-CA");
  const todayEntries = entries.filter((entry) => entry.createdAt.slice(0, 10) === today);
  const mileageTotal = entries.reduce((sum, entry) => sum + (Number(entry.mileage) || 0), 0);
  const session = getWorkSession(job);
  const travel = getTravelState(job);
  const lastUpdated = entries[0]?.createdAt;

  async function addTimeEntry(type: TimeEntry["type"], options: { mileage?: string; origin?: string; notes?: string } = {}) {
    const trimmedMileage = options.mileage?.trim() || "";
    const trimmedOrigin = options.origin?.trim() || "";
    const entry: TimeEntry = {
      id: `time-${Date.now()}`,
      type,
      employeeName,
      createdAt: new Date().toISOString(),
      mileage: trimmedMileage || undefined,
      origin: trimmedOrigin || undefined,
      notes: options.notes?.trim(),
    };
    const statusPatch: Partial<Job> = type === "Work started" && ["New", "Scheduled"].includes(job.status) ? { status: "In Progress" } : {};
    const activity = buildTimeActivity(job, employeeName, activityMessageForTimeEntry(entry));
    await onSave({
      ...statusPatch,
      timeEntries: [entry, ...entries].slice(0, 100),
      activityLog: activity,
    });
  }

  async function submitNote(event: React.FormEvent) {
    event.preventDefault();
    setMileageError("");
    if (!mileage.trim() && !notes.trim()) return;
    if (mileage.trim() && !validMileage(mileage)) {
      setMileageError("Enter miles as a number zero or greater.");
      return;
    }
    await addTimeEntry(mileage.trim() ? "Mileage" : "Note", { mileage, notes });
    setMileage("");
    setNotes("");
  }

  async function startTravel() {
    if (travel.active) return;
    await addTimeEntry("Note", { origin, notes: "Started Travel" });
    setOrigin("");
  }

  async function arriveAtJob() {
    if (!travel.active) return;
    await addTimeEntry("Arrived", { notes: "Arrived at job." });
  }

  return <section id="time-log" className="card p-4 sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink"><ClockIcon className="size-5" /></span>
      <div>
        <h2 className="text-lg font-black">Time & trip log</h2>
        <p className="text-sm text-black/50">Crew field log for arrival, work time, travel, mileage, and notes.</p>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <MiniMetric label="Started" value={session.started ? formatSessionDate(session.started.createdAt) : "Not Started"} icon={<ClockIcon />} />
      <MiniMetric label="Worked today" value={formatWorkedToday(entries, today)} icon={<ClockIcon />} />
      <MiniMetric label="Last updated" value={lastUpdated ? formatSessionDate(lastUpdated) : "No entries"} icon={<ClipboardDocumentListIcon />} />
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
      <MiniMetric label="Today entries" value={todayEntries.length} icon={<ClockIcon />} />
      <MiniMetric label="Total entries" value={entries.length} icon={<ClipboardDocumentListIcon />} />
      <MiniMetric label="Mileage" value={mileageTotal.toFixed(1)} icon={<MapPinIcon />} />
    </div>
    <div className="mt-4 rounded-2xl border border-black/10 bg-sand p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black">Travel and mileage</p>
          <p className="text-xs font-semibold text-black/45">{travelLabel(travel)}</p>
        </div>
        {travel.active
          ? <button type="button" disabled={saving} onClick={arriveAtJob} className="min-h-11 rounded-xl bg-forest px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving..." : "Arrive at Job"}</button>
          : !travel.started && !session.started
            ? <button type="button" disabled={saving} onClick={startTravel} className="min-h-11 rounded-xl bg-forest px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving..." : "Start Travel"}</button>
            : <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-black text-black/45">Travel Recorded</span>}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniMetric label="Travel started" value={travel.started ? formatSessionDate(travel.started.createdAt) : "Not started"} icon={<MapPinIcon />} />
        <MiniMetric label="Arrival" value={travel.active ? "In travel" : travel.arrived ? formatSessionDate(travel.arrived.createdAt) : "Not recorded"} icon={<MapPinIcon />} />
        <MiniMetric label="Drive time" value={travelDuration(travel)} icon={<ClockIcon />} />
      </div>
      {!travel.started && !session.started && <label className="mt-3 block text-sm font-bold text-black/55">Origin<input className="field mt-1 !min-h-11 !py-2 text-sm" value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Starting location (optional)" /></label>}
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {(["Arrived", "Work started", "Paused", "Departed"] as TimeEntry["type"][]).map((type) => <button key={type} type="button" disabled={saving} onClick={() => addTimeEntry(type)} className="min-h-12 rounded-xl bg-forest px-3 py-3 text-sm font-black text-white disabled:opacity-50">{type}</button>)}
    </div>
    <form onSubmit={submitNote} className="mt-4 grid gap-2 rounded-2xl border border-black/10 bg-white p-3 sm:grid-cols-[.45fr_1fr_auto]">
      <input className="field !min-h-11 !py-2 text-sm" value={mileage} onChange={(event) => setMileage(event.target.value)} inputMode="decimal" placeholder="Miles" />
      <input className="field !min-h-11 !py-2 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Trip/time note" />
      <button disabled={saving || (!mileage.trim() && !notes.trim())} className="min-h-11 rounded-xl bg-ink px-4 py-2 font-black text-white disabled:opacity-50">Add Log</button>
    </form>
    {mileageError && <p role="alert" className="mt-2 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">{mileageError}</p>}
    <div className="mt-4 space-y-2">
      {entries.length ? entries.slice(0, 8).map((entry) => <div key={entry.id} className="rounded-xl bg-sand p-3">
        <div className="flex items-start justify-between gap-3">
          <div><p className="font-black">{entry.type}{entry.mileage ? ` · ${entry.mileage} miles` : ""}</p><p className="text-xs font-semibold text-black/45">{entry.employeeName} · {new Date(entry.createdAt).toLocaleString()}</p></div>
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-black/45">Time</span>
        </div>
        {entry.notes && <p className="mt-2 text-sm font-semibold text-black/55">{entry.notes}</p>}
      </div>) : <p className="rounded-xl bg-sand p-3 text-sm font-semibold text-black/45">No time entries yet.</p>}
    </div>
  </section>;
}

function ProfileSheetPanel({ job }: { job: Job }) {
  const [copied, setCopied] = useState(false);
  const text = buildProfileSheet(job);
  async function copyProfile() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return <section id="profile-sheet" className="card p-4 sm:p-6 scroll-mt-24">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink"><ClipboardDocumentListIcon className="size-5" /></span>
      <div>
        <h2 className="text-lg font-black">Customer profile sheet</h2>
        <p className="text-sm text-black/50">Quick handoff summary for crew, office, dealer, factory, or billing.</p>
      </div>
    </div>
    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-sand p-4 text-sm font-semibold leading-relaxed text-black/70">{text}</pre>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 print:hidden">
      <button type="button" onClick={copyProfile} className="min-h-12 rounded-xl bg-forest px-4 py-3 font-black text-white">{copied ? "Copied" : "Copy Profile Sheet"}</button>
      <button type="button" onClick={() => shareProfile(job, text)} className="min-h-12 rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black">Share Profile</button>
      <button type="button" onClick={() => window.print()} className="min-h-12 rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black sm:col-span-2">Print Profile</button>
    </div>
  </section>;
}

async function shareProfile(job: Job, text: string) {
  if (navigator.share) {
    await navigator.share({ title: `${job.jobId} — ${job.customerName}`, text }).catch(() => undefined);
    return;
  }
  await navigator.clipboard.writeText(text).catch(() => undefined);
}

function buildCustomerText(job: Job) {
  return `RTS update for ${job.customerName}: your ${job.jobType || "service"} job is scheduled for ${job.dueDate || "TBD"}. Address: ${job.address}, ${job.city}. Reply here if anything changes.`;
}

function sourceContactLabel(job: Job) {
  if (job.source === "Dealer") return job.dealerName || "Dealer";
  if (job.source === "Factory") return job.factoryWorkOrderNumber ? `Factory WO ${job.factoryWorkOrderNumber}` : "Factory";
  return "Individual customer";
}

function buildSourceText(job: Job) {
  return [
    `RTS source update — ${job.jobId}`,
    `${job.customerName} · ${job.address}, ${job.city}`,
    `Source: ${job.source}${job.dealerName ? ` / ${job.dealerName}` : ""}${job.factoryWorkOrderNumber ? ` / WO ${job.factoryWorkOrderNumber}` : ""}`,
    `Status: ${job.status} · Priority: ${job.priority}`,
    `Due: ${job.dueDate || "Not scheduled"} · Assigned: ${job.assignedCrew || "Unassigned"}`,
    `Scope: ${job.scopeNotes || "No scope notes added."}`,
    `Parts: ${job.partsNeeded || "None listed."}`,
  ].join("\n");
}

function buildManagerHandoffText(job: Job) {
  const openFollowUps = (job.activityLog || []).filter((entry) => entry.notify && !entry.resolvedAt).length;
  const checklist = checklistProgress(job);
  return [
    `Manager handoff — ${job.jobId} ${job.customerName}`,
    `Status/Priority: ${job.status} / ${job.priority}`,
    `Schedule: ${job.dueDate || "Not scheduled"} · Crew: ${job.assignedCrew || "Unassigned"}`,
    `Checklist: ${checklist.complete}/${checklist.total} · Open follow-ups: ${openFollowUps}`,
    `Calendar: ${job.googleCalendarEventUrl ? "Linked" : "Not linked"} · CompanyCam: ${job.companyCamProjectUrl ? "Linked" : "Not linked"}`,
    `Invoice: ${job.invoiceStatus || "Not started"}`,
    "",
    `Completion notes: ${job.completionNotes || "Not complete yet."}`,
  ].join("\n");
}

function buildFieldHandoff(job: Job) {
  return [
    `${job.jobId} — ${job.customerName}`,
    `Phone: ${job.phone || "Not provided"}`,
    `Address: ${job.address}, ${job.city}`,
    `Due: ${job.dueDate || "Not scheduled"}`,
    `Status/Priority: ${job.status} / ${job.priority}`,
    `Assigned: ${job.assignedCrew || "Unassigned"}`,
    `Type: ${job.jobType || "Work order"}`,
    "",
    `Scope: ${job.scopeNotes || "No scope notes."}`,
    `Parts: ${job.partsNeeded || "None listed."}`,
  ].join("\n");
}

function buildProfileSheet(job: Job) {
  return [
    `JOB: ${job.jobId}`,
    `CUSTOMER: ${job.customerName}`,
    `PHONE: ${job.phone || "Not provided"}`,
    `ADDRESS: ${job.address}, ${job.city}`,
    `SOURCE: ${job.source}${job.dealerName ? ` — ${job.dealerName}` : ""}${job.factoryWorkOrderNumber ? ` — WO ${job.factoryWorkOrderNumber}` : ""}`,
    `DUE DATE: ${job.dueDate || "Not scheduled"}`,
    `STATUS: ${job.status}`,
    `PRIORITY: ${job.priority}`,
    `ASSIGNED: ${job.assignedCrew || "Unassigned"}`,
    `HOME SIZE: ${job.homeSize || "Unknown"}`,
    `JOB TYPE: ${job.jobType || "Work order"}`,
    "",
    "SCOPE:",
    job.scopeNotes || "No scope notes added.",
    "",
    "PARTS NEEDED:",
    job.partsNeeded || "None listed.",
    "",
    "COMPLETION NOTES:",
    job.completionNotes || "Not complete yet.",
  ].join("\n");
}

function FileUploadButton({ label, category, disabled, onFile }: { label: string; category: FileCategory; disabled: boolean; onFile: (file: File | undefined, category: FileCategory) => void }) {
  return <label className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-black/15 bg-sand px-3 py-3 text-center text-sm font-black text-ink ${disabled ? "opacity-50" : ""}`}>
    {label}
    <input type="file" accept="image/*,.pdf,.doc,.docx,.txt,.csv" className="hidden" disabled={disabled} onChange={(event) => onFile(event.target.files?.[0], category)} />
  </label>;
}

function FileList({ files }: { files: WorkOrderFile[] }) {
  return <div className="mb-3 space-y-2">{files.map((file) => <div key={file.id} className="rounded-xl border border-black/10 bg-sand p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-extrabold">{file.fileName}</p>
        <p className="text-xs font-semibold text-black/45">{file.category || "File"} · {(file.fileSize / 1024).toFixed(1)} KB</p>
      </div>
      <a href={file.storageUrl || file.dataUrl} target="_blank" className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-black text-forest">Open</a>
    </div>
    {file.extractedText && <details className="mt-3 rounded-lg bg-white p-3 text-xs font-semibold text-black/55">
      <summary className="cursor-pointer font-black text-forest">View saved work-order text</summary>
      <p className="mt-2 whitespace-pre-wrap">{file.extractedText}</p>
    </details>}
  </div>)}</div>;
}

async function uploadStoredFile(file: File, jobId: string, category: FileCategory, caption = ""): Promise<WorkOrderFile> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("jobId", jobId);
  formData.append("category", category);
  if (caption) formData.append("caption", caption);
  const response = await authFetch("/api/files/upload", { method: "POST", body: formData });
  if (response.ok) return response.json();
  return fallbackStoredFile(file, category, caption);
}

function fallbackStoredFile(file: File, category: FileCategory, caption = "") {
  return new Promise<WorkOrderFile>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `file-${Date.now()}`,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      dataUrl: String(reader.result || ""),
      category,
      caption: caption || undefined,
      uploadedAt: new Date().toISOString(),
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function CompanyCamPanel({ job, status, setStatus, onJobSynced }: { job: Job; status: CompanyCamState; setStatus: React.Dispatch<React.SetStateAction<CompanyCamState>>; onJobSynced: React.Dispatch<React.SetStateAction<Job>> }) {
  const [syncing, setSyncing] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  async function syncProject() {
    setSyncing(true);
    setStatus((old) => ({ ...old, error: "" }));
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}/companycam`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "CompanyCam project could not be synced.");
      setStatus((old) => ({ ...old, ...result, connected: true, error: "" }));
      if (result.job) onJobSynced((old) => ({ ...old, ...result.job }));
    } catch (caught) {
      setStatus((old) => ({ ...old, error: caught instanceof Error ? caught.message : "CompanyCam project could not be synced." }));
    } finally {
      setSyncing(false);
    }
  }

  async function loadPhotos() {
    setLoadingPhotos(true);
    setStatus((old) => ({ ...old, photoError: "" }));
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}/companycam?photos=1`);
      const result = await response.json();
      if (!response.ok) throw new Error("CompanyCam photos could not be loaded.");
      setStatus((old) => ({ ...old, ...result, photos: result.photos || [], photoError: result.photoError || "" }));
    } catch {
      setStatus((old) => ({ ...old, photoError: "CompanyCam photos could not be loaded." }));
    } finally {
      setLoadingPhotos(false);
    }
  }

  return <section id="companycam-panel" className="card p-4 sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800"><CameraIcon className="size-5" /></span>
      <div>
        <h2 className="text-lg font-black">CompanyCam</h2>
        <p className="text-sm text-black/50">Create or open the photo project for this customer job.</p>
      </div>
    </div>
    <div className="rounded-xl border border-black/10 bg-sand p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-black/35">Project status</p>
          <p className="font-extrabold">{status.projectUrl ? "Project linked" : "No CompanyCam project yet"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-black uppercase tracking-wide text-black/35">Photos</p>
          <p className="text-2xl font-black">{status.photoCount ?? "—"}</p>
        </div>
      </div>
      {status.projectUrl && <a href={status.projectUrl} target="_blank" className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-center font-black text-white">Open CompanyCam <ArrowTopRightOnSquareIcon className="size-5" /></a>}
      {status.projectUrl && <CompanyCamPhotoReferences projectUrl={status.projectUrl} photos={status.photos} loading={loadingPhotos} onLoad={loadPhotos} />}
      <button type="button" onClick={syncProject} disabled={syncing} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-black/10 bg-white px-4 py-3 text-center font-black disabled:opacity-50">
        <ArrowPathIcon className={`size-5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing…" : status.projectUrl ? "Update CompanyCam project" : "Create CompanyCam project"}
      </button>
      {!status.configured && <p className="mt-3 text-xs font-semibold text-orange-700">CompanyCam token is not connected in Vercel yet. The button is ready, but it will not create projects until that token is added.</p>}
      {status.error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{status.error}</p>}
      {status.photoError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{status.photoError}</p>}
    </div>
  </section>;
}

function CompanyCamPhotoReferences({ projectUrl, photos, loading, onLoad }: { projectUrl: string; photos?: CompanyCamState["photos"]; loading: boolean; onLoad: () => void }) {
  return <>
    <button type="button" onClick={onLoad} disabled={loading} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-black/10 bg-white px-4 py-2 text-center text-sm font-black disabled:opacity-50">
      <ArrowPathIcon className={`size-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Loading references…" : "View CompanyCam photo references"}
    </button>
    {photos && <div className="mt-3 grid grid-cols-4 gap-2" aria-label="CompanyCam photo references">
      {photos.slice(0, 8).map((photo) => photo.thumbnailUrl ? <a key={photo.id} href={projectUrl} target="_blank" title={photo.createdAt ? `Added ${formatJobDate(photo.createdAt)}` : "Open in CompanyCam"} className="aspect-square overflow-hidden rounded-lg border border-black/10 bg-white"><img src={photo.thumbnailUrl} alt="CompanyCam project photo reference" className="size-full object-cover" /></a> : <a key={photo.id} href={projectUrl} target="_blank" className="grid aspect-square place-items-center rounded-lg border border-black/10 bg-white text-xs font-bold text-black/50">Photo</a>)}
    </div>}
    {photos?.length === 0 && !loading && <p className="mt-3 text-xs font-semibold text-black/55">No CompanyCam photo references are available for this project.</p>}
    <p className="mt-3 text-xs font-semibold text-black/55">CompanyCam photos are reference-only. Native RTS photos remain required for closeout and billing evidence.</p>
  </>;
}
