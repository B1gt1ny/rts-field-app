"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BriefcaseIcon, CameraIcon, CalendarDaysIcon, CheckCircleIcon, ClipboardDocumentCheckIcon, ClockIcon, DocumentTextIcon, ExclamationTriangleIcon, MapPinIcon, PhoneIcon, PlayIcon, ReceiptPercentIcon, UserCircleIcon, UserGroupIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { defaultFactoryCost, type BusinessSettings, type Employee, type FactoryCostTracker, type Job, type JobActivity } from "@/lib/types";
import { authFetch } from "@/lib/client-auth";
import { getFactoryCostTotals, hasFactoryCostWork } from "@/lib/factory-costs";
import { hasReceiptDollars, hasUploadedReceiptBackup } from "@/lib/receipt-backup";
import { checklistProgress } from "@/lib/job-readiness";
import { useAuthUser } from "./AuthGate";
import { StatusBadge } from "./StatusBadge";

const activeStatuses = ["New", "Scheduled", "In Progress", "Waiting on Parts", "Needs Inspection"];
const defaultFieldNoteTemplates = [
  "Arrived | Crew arrived on site. | Time",
  "Customer not home | Customer not home. Crew needs follow-up before returning. | Customer",
  "Parts missing | Parts missing or incorrect. Need manager review before work can continue. | Parts",
  "Blocked | Crew is blocked and needs manager direction before continuing. | Status",
  "Work complete | Field work complete. Ready for closeout review. | Status",
];
type CrewFilter = "today" | "overdue" | "started" | "parts" | "closeout" | "all";
type FieldPermissions = Pick<BusinessSettings, "employeeCanRequestHelp" | "employeeCanStartJobs" | "employeeCanAddQuickNotes" | "employeeCanAddCompletionNotes" | "employeeCanUploadFiles" | "employeeCanRequestParts" | "employeeCanAddFactoryCosts" | "employeeCanSendReadyReview" | "employeeCanAddSignoffs" | "employeeCanViewPackets">;
type FieldReviewOptions = Pick<BusinessSettings, "requireFactoryCostsForReview" | "requireReceiptBackupForReview" | "requireBeforePhotosForReview" | "requireSerialTagPhotoForReview" | "requireDamagePhotosForReview" | "requireAfterPhotosForReview" | "requireCompletionNotesForReview" | "requireWorkCompleteForReview" | "requirePartsClosedForReview">;

const defaultFieldPermissions: FieldPermissions = {
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
};

export function FieldAppView() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingJobId, setSavingJobId] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [crewFilter, setCrewFilter] = useState<CrewFilter>("today");
  const [fieldNotice, setFieldNotice] = useState("Open your assigned job, check the scope, take required photos, add notes, and tap Ready Review when field work is complete.");
  const [reviewInstructions, setReviewInstructions] = useState("Manager review checks after photos, completion notes, work completed, and open parts before billing.");
  const [customerTextTemplate, setCustomerTextTemplate] = useState("RTS update for {customerName}: crew is on your job {jobId}.");
  const [fieldNoteTemplates, setFieldNoteTemplates] = useState(defaultFieldNoteTemplates);
  const [factoryCostInstructions, setFactoryCostInstructions] = useState("Factory jobs: enter miles, drive time, hotel, materials, and other receipt totals before sending the job for review.");
  const [requireBeforePhotosForReview, setRequireBeforePhotosForReview] = useState(true);
  const [requireSerialTagPhotoForReview, setRequireSerialTagPhotoForReview] = useState(true);
  const [requireDamagePhotosForReview, setRequireDamagePhotosForReview] = useState(false);
  const [requireAfterPhotosForReview, setRequireAfterPhotosForReview] = useState(true);
  const [requireCompletionNotesForReview, setRequireCompletionNotesForReview] = useState(true);
  const [requireWorkCompleteForReview, setRequireWorkCompleteForReview] = useState(true);
  const [requirePartsClosedForReview, setRequirePartsClosedForReview] = useState(true);
  const [requireFactoryCostsForReview, setRequireFactoryCostsForReview] = useState(true);
  const [requireReceiptBackupForReview, setRequireReceiptBackupForReview] = useState(true);
  const [fieldSupportName, setFieldSupportName] = useState("Office");
  const [fieldSupportPhone, setFieldSupportPhone] = useState("");
  const [employeeHelpInstructions, setEmployeeHelpInstructions] = useState("If something blocks the job, tap Need Help, add what is missing, then call or text the office before leaving.");
  const [showCompletedJobsInFieldApp, setShowCompletedJobsInFieldApp] = useState(false);
  const [fieldPermissions, setFieldPermissions] = useState<FieldPermissions>(defaultFieldPermissions);
  const user = useAuthUser();
  const lockedToLogin = user?.role === "Employee" && Boolean(user.employeeId);
  const today = new Date().toLocaleDateString("en-CA");

  useEffect(() => {
    Promise.all([
      authFetch("/api/jobs").then((response) => response.json()),
      fetch("/api/employees").then((response) => response.json()),
      fetch("/api/settings").then((response) => response.json()).catch(() => null),
    ]).then(([jobData, employeeData, settings]) => {
      setJobs(Array.isArray(jobData) ? jobData : []);
      const businessSettings = settings as Partial<BusinessSettings> | null;
      if (businessSettings?.employeeFieldNotice) setFieldNotice(businessSettings.employeeFieldNotice);
      if (businessSettings?.managerReviewInstructions) setReviewInstructions(businessSettings.managerReviewInstructions);
      if (businessSettings?.customerTextTemplate) setCustomerTextTemplate(businessSettings.customerTextTemplate);
      if (businessSettings?.employeeFieldNoteTemplates?.length) setFieldNoteTemplates(businessSettings.employeeFieldNoteTemplates);
      if (businessSettings?.factoryCostInstructions) setFactoryCostInstructions(businessSettings.factoryCostInstructions);
      setRequireBeforePhotosForReview(businessSettings?.requireBeforePhotosForReview ?? true);
      setRequireSerialTagPhotoForReview(businessSettings?.requireSerialTagPhotoForReview ?? true);
      setRequireDamagePhotosForReview(businessSettings?.requireDamagePhotosForReview ?? false);
      setRequireAfterPhotosForReview(businessSettings?.requireAfterPhotosForReview ?? true);
      setRequireCompletionNotesForReview(businessSettings?.requireCompletionNotesForReview ?? true);
      setRequireWorkCompleteForReview(businessSettings?.requireWorkCompleteForReview ?? true);
      setRequirePartsClosedForReview(businessSettings?.requirePartsClosedForReview ?? true);
      setRequireFactoryCostsForReview(businessSettings?.requireFactoryCostsForReview ?? true);
      setRequireReceiptBackupForReview(businessSettings?.requireReceiptBackupForReview ?? true);
      setFieldSupportName(businessSettings?.fieldSupportName || "Office");
      setFieldSupportPhone(businessSettings?.fieldSupportPhone || businessSettings?.phone || "");
      setEmployeeHelpInstructions(businessSettings?.employeeHelpInstructions || "If something blocks the job, tap Need Help, add what is missing, then call or text the office before leaving.");
      setShowCompletedJobsInFieldApp(businessSettings?.showCompletedJobsInFieldApp ?? false);
      setFieldPermissions({ ...defaultFieldPermissions, ...pickFieldPermissions(businessSettings) });
      const activeEmployees = Array.isArray(employeeData) ? employeeData.filter((employee: Employee) => employee.active) : [];
      setEmployees(activeEmployees);
      const remembered = window.localStorage.getItem("company-command-employee-id");
      const linked = user?.employeeId || "";
      setEmployeeId(activeEmployees.some((employee) => employee.id === linked) ? linked : activeEmployees.some((employee) => employee.id === remembered) ? remembered || "" : activeEmployees[0]?.id || "");
    }).finally(() => setLoading(false));
  }, [user?.employeeId]);

  function chooseEmployee(id: string) {
    setEmployeeId(id);
    window.localStorage.setItem("company-command-employee-id", id);
  }

  const employee = employees.find((item) => item.id === employeeId);
  const assignedJobs = useMemo(() => {
    if (!employee) return [];
    return jobs.filter((job) => {
      const assigned = job.fullCrew || job.assignedEmployeeIds?.includes(employee.id) || job.assignedCrew === employee.name;
      return assigned && (showCompletedJobsInFieldApp || activeStatuses.includes(job.status));
    });
  }, [employee, jobs, showCompletedJobsInFieldApp]);
  const todayJobs = assignedJobs.filter((job) => job.dueDate === today);
  const activeJobs = assignedJobs.filter((job) => activeStatuses.includes(job.status));
  const reviewOptions: FieldReviewOptions = { requireFactoryCostsForReview, requireReceiptBackupForReview, requireBeforePhotosForReview, requireSerialTagPhotoForReview, requireDamagePhotosForReview, requireAfterPhotosForReview, requireCompletionNotesForReview, requireWorkCompleteForReview, requirePartsClosedForReview };
  const waitingJobs = assignedJobs.filter((job) => job.status === "Waiting on Parts");
  const overdueJobs = activeJobs.filter((job) => job.dueDate && job.dueDate < today);
  const startedJobs = activeJobs.filter((job) => job.status === "In Progress");
  const closeoutJobs = assignedJobs.filter((job) => needsFieldCloseout(job, reviewOptions));
  const actionJobs = activeJobs.filter((job) => job.dueDate <= today || needsFieldCloseout(job, reviewOptions)).sort((a, b) => fieldSort(a, b, today)).slice(0, 6);
  const filteredAssignedJobs = assignedJobs.filter((job) => matchesCrewFilter(job, crewFilter, today, reviewOptions)).sort((a, b) => fieldSort(a, b, today));
  const sortedAssignedJobs = [...assignedJobs].sort((a, b) => fieldWorkSort(a, b, today));
  const currentJob = sortedAssignedJobs.find((job) => job.status === "In Progress")
    || sortedAssignedJobs.find((job) => job.dueDate === today)
    || sortedAssignedJobs.find((job) => job.dueDate > today)
    || sortedAssignedJobs[0];
  const fieldBlockers = getFieldBlockers(sortedAssignedJobs, reviewOptions, today).slice(0, 5);
  const sevenDaySchedule = groupSevenDayAssignments(sortedAssignedJobs, today);
  const recentFieldActivity = employee ? getRecentFieldActivity(assignedJobs, employee.name, today).slice(0, 5) : [];
  const crewFilterCounts: Record<CrewFilter, number> = {
    today: todayJobs.length,
    overdue: overdueJobs.length,
    started: startedJobs.length,
    parts: waitingJobs.length,
    closeout: closeoutJobs.length,
    all: assignedJobs.length,
  };

  async function startJob(job: Job) {
    setSavingJobId(job.jobId);
    const employeeName = employee?.name || user?.employeeName || "Crew";
    const session = getWorkSession(job);
    const now = new Date().toISOString();
    const activity: JobActivity = {
      id: `activity-${Date.now()}`,
      type: "Time",
      message: "Started Job",
      createdAt: now,
      createdBy: employeeName,
      audience: "All",
    };
    const timeEntry: NonNullable<Job["timeEntries"]>[number] | undefined = session.active ? undefined : {
      id: `time-${Date.now()}`,
      type: "Work started",
      employeeName,
      createdAt: now,
      notes: "Started from Field App.",
    };
    const patch: Partial<Job> = {
      status: ["New", "Scheduled"].includes(job.status) ? "In Progress" : job.status,
      activityLog: session.active ? job.activityLog || [] : [activity, ...(job.activityLog || [])].slice(0, 50),
      timeEntries: timeEntry ? [timeEntry, ...(job.timeEntries || [])].slice(0, 100) : job.timeEntries || [],
    };
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const saved = await response.json();
      if (response.ok) setJobs((old) => old.map((item) => item.jobId === job.jobId ? { ...item, ...saved } : item));
    } finally {
      setSavingJobId("");
    }
  }

  async function startTravel(job: Job) {
    const travel = getTravelState(job);
    if (travel.active) return;
    setSavingJobId(job.jobId);
    const employeeName = employee?.name || user?.employeeName || "Crew";
    const now = new Date().toISOString();
    const activity: JobActivity = {
      id: `activity-${Date.now()}`,
      type: "Time",
      message: "Started Travel",
      createdAt: now,
      createdBy: employeeName,
      audience: "All",
    };
    const timeEntry: NonNullable<Job["timeEntries"]>[number] = {
      id: `time-${Date.now()}`,
      type: "Note",
      employeeName,
      createdAt: now,
      notes: "Started Travel",
    };
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityLog: [activity, ...(job.activityLog || [])].slice(0, 50),
          timeEntries: [timeEntry, ...(job.timeEntries || [])].slice(0, 100),
        }),
      });
      const saved = await response.json();
      if (response.ok) setJobs((old) => old.map((item) => item.jobId === job.jobId ? { ...item, ...saved } : item));
    } finally {
      setSavingJobId("");
    }
  }

  async function arriveAtJob(job: Job) {
    const travel = getTravelState(job);
    if (!travel.active) return;
    setSavingJobId(job.jobId);
    const employeeName = employee?.name || user?.employeeName || "Crew";
    const now = new Date().toISOString();
    const activity: JobActivity = {
      id: `activity-${Date.now()}`,
      type: "Time",
      message: "Arrived at Job",
      createdAt: now,
      createdBy: employeeName,
      audience: "All",
    };
    const timeEntry: NonNullable<Job["timeEntries"]>[number] = {
      id: `time-${Date.now()}`,
      type: "Arrived",
      employeeName,
      createdAt: now,
      notes: "Arrived at job from Field App.",
    };
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityLog: [activity, ...(job.activityLog || [])].slice(0, 50),
          timeEntries: [timeEntry, ...(job.timeEntries || [])].slice(0, 100),
        }),
      });
      const saved = await response.json();
      if (response.ok) setJobs((old) => old.map((item) => item.jobId === job.jobId ? { ...item, ...saved } : item));
    } finally {
      setSavingJobId("");
    }
  }

  async function toggleChecklist(job: Job, itemId: string) {
    setSavingJobId(job.jobId);
    const employeeName = employee?.name || user?.employeeName || "Crew";
    const checklist = (job.checklist || []).map((item) => item.id === itemId ? { ...item, complete: !item.complete } : item);
    const changed = checklist.find((item) => item.id === itemId);
    const activity: JobActivity = {
      id: `activity-${Date.now()}`,
      type: "Status",
      message: `${employeeName} marked checklist item ${changed?.complete ? "complete" : "not complete"}: ${changed?.label || "Checklist item"}.`,
      createdAt: new Date().toISOString(),
      createdBy: employeeName,
      audience: "All",
    };
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist, activityLog: [activity, ...(job.activityLog || [])].slice(0, 50) }),
      });
      const saved = await response.json();
      if (response.ok) setJobs((old) => old.map((item) => item.jobId === job.jobId ? { ...item, ...saved, checklist: saved.checklist?.length ? saved.checklist : checklist } : item));
    } finally {
      setSavingJobId("");
    }
  }

  async function saveFieldNote(job: Job, message: string, type: JobActivity["type"] = "Note") {
    const trimmed = message.trim();
    if (!trimmed) return;
    setSavingJobId(job.jobId);
    const employeeName = employee?.name || user?.employeeName || "Crew";
    const activity: JobActivity = {
      id: `activity-${Date.now()}`,
      type,
      message: trimmed,
      createdAt: new Date().toISOString(),
      createdBy: employeeName,
      audience: "All",
      notify: /parts|missing|not home|blocked|problem|issue|return/i.test(trimmed),
      followUpDueDate: /parts|missing|not home|blocked|problem|issue|return/i.test(trimmed) ? today : undefined,
    };
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityLog: [activity, ...(job.activityLog || [])].slice(0, 50) }),
      });
      const saved = await response.json();
      if (response.ok) {
        setJobs((old) => old.map((item) => item.jobId === job.jobId ? { ...item, ...saved } : item));
        setNoteDrafts((old) => ({ ...old, [job.jobId]: "" }));
      }
    } finally {
      setSavingJobId("");
    }
  }

  async function saveFactoryCost(job: Job, costPatch: Partial<FactoryCostTracker>) {
    setSavingJobId(job.jobId);
    const employeeName = employee?.name || user?.employeeName || "Crew";
    const factoryCost = { ...defaultFactoryCost(), ...(job.factoryCost || {}), ...costPatch };
    const total = getFactoryCostTotals(factoryCost).grandTotal;
    const activity: JobActivity = {
      id: `activity-${Date.now()}`,
      type: "Invoice",
      message: `${employeeName} updated factory costs from the field. Factory total: $${total.toFixed(2)}.`,
      createdAt: new Date().toISOString(),
      createdBy: employeeName,
      audience: "Admin",
      notify: true,
      followUpDueDate: today,
    };
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factoryCost, activityLog: [activity, ...(job.activityLog || [])].slice(0, 50) }),
      });
      const saved = await response.json();
      if (response.ok) setJobs((old) => old.map((item) => item.jobId === job.jobId ? { ...item, ...saved } : item));
    } finally {
      setSavingJobId("");
    }
  }

  async function saveCompletionNotes(job: Job, completionNotes: string) {
    const trimmed = completionNotes.trim();
    if (!trimmed) return;
    setSavingJobId(job.jobId);
    const employeeName = employee?.name || user?.employeeName || "Crew";
    const checklist = (job.checklist || []).map((item) => item.label === "Completion notes added" ? { ...item, complete: true } : item);
    const activity: JobActivity = {
      id: `activity-${Date.now()}`,
      type: "Status",
      message: `${employeeName} added completion notes from the field.`,
      createdAt: new Date().toISOString(),
      createdBy: employeeName,
      audience: "All",
    };
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completionNotes: trimmed, checklist, activityLog: [activity, ...(job.activityLog || [])].slice(0, 50) }),
      });
      const saved = await response.json();
      if (response.ok) setJobs((old) => old.map((item) => item.jobId === job.jobId ? { ...item, ...saved, checklist: saved.checklist?.length ? saved.checklist : checklist } : item));
    } finally {
      setSavingJobId("");
    }
  }

  async function readyForManagerReview(job: Job) {
    setSavingJobId(job.jobId);
    const employeeName = employee?.name || user?.employeeName || "Crew";
    const checklist = (job.checklist || []).map((item) => {
      const closeoutLabels = ["Work completed", "After photos taken", "Completion notes added"];
      return closeoutLabels.includes(item.label) ? { ...item, complete: true } : item;
    });
    const activity: JobActivity = {
      id: `activity-${Date.now()}`,
      type: "Status",
      message: `${employeeName} marked field work ready for manager review.`,
      createdAt: new Date().toISOString(),
      createdBy: employeeName,
      audience: "Manager",
      notify: true,
      followUpDueDate: today,
    };
    const timeEntry: NonNullable<Job["timeEntries"]>[number] = {
      id: `time-${Date.now()}`,
      type: "Note",
      employeeName,
      createdAt: new Date().toISOString(),
      notes: "Ready for manager review from Field App.",
    };
    const completionNotes = job.completionNotes?.trim() || "Field work marked ready for manager review.";
    const patch: Partial<Job> = {
      status: "Needs Inspection",
      completionNotes,
      checklist,
      activityLog: [activity, ...(job.activityLog || [])].slice(0, 50),
      timeEntries: [timeEntry, ...(job.timeEntries || [])].slice(0, 100),
    };
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const saved = await response.json();
      if (response.ok) setJobs((old) => old.map((item) => item.jobId === job.jobId ? { ...item, ...saved, checklist: saved.checklist?.length ? saved.checklist : checklist } : item));
    } finally {
      setSavingJobId("");
    }
  }

  return <div className="mx-auto max-w-3xl space-y-4">
    <section className="rounded-2xl bg-ink p-4 text-white sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-lime">Employee field app</p>
          <h1 className="mt-1 truncate text-2xl font-black">{employee?.name || user?.employeeName || "Field work"}</h1>
          <p className="mt-1 text-sm font-semibold text-white/60">{formatTodayLabel()} · {todayJobs.length} assigned today</p>
          <p className="mt-2 text-sm text-white/70">Next job, next action, then the rest of today.</p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime text-ink"><UserCircleIcon className="size-6" /></span>
      </div>
      {employees.length > 0 && !lockedToLogin && <label className="mt-4 block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-white/60">Viewing employee</span>
        <select value={employeeId} onChange={(event) => chooseEmployee(event.target.value)} className="field bg-white text-ink">
          {employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>}
      {lockedToLogin && <p className="mt-3 text-xs font-bold text-white/45">This login is locked to {user?.employeeName || "the linked employee"}.</p>}
    </section>

    {loading ? <p className="card p-5 text-sm font-bold text-black/45">Loading assigned jobs...</p> : null}

    {!loading && !employees.length ? <section className="card p-6 text-center">
      <p className="font-black">No employees added yet.</p>
      <p className="mt-1 text-sm text-black/45">An admin can add employees from the employee manager.</p>
      <Link href="/employees" className="btn-primary mt-4">Open Employees</Link>
    </section> : null}

    {!loading && employee && <CurrentJobPanel job={currentJob} saving={savingJobId === currentJob?.jobId} permissions={fieldPermissions} onStart={(job) => startJob(job)} onStartTravel={(job) => startTravel(job)} onArrive={(job) => arriveAtJob(job)} />}

    {!loading && employee && <EmployeeSevenDaySchedule groups={sevenDaySchedule} />}

    {!loading && employee && fieldBlockers.length > 0 && <FieldBlockers blockers={fieldBlockers} />}

    {!loading && employee && recentFieldActivity.length > 0 && <RecentFieldActivity items={recentFieldActivity} />}

    {!loading && employee && assignedJobs.length ? <section id="all-assigned-work" className="scroll-mt-24">
      <details>
        <summary className="cursor-pointer rounded-xl border border-black/10 bg-white px-4 py-3 text-base font-black">All assigned work</summary>
        <div className="mt-3">
          <CrewFilterBar value={crewFilter} counts={crewFilterCounts} onChange={setCrewFilter} />
          <div className="grid gap-3 md:grid-cols-2">{filteredAssignedJobs.map((job) => <FieldJobCard key={job.jobId} job={job} noteDraft={noteDrafts[job.jobId] || ""} saving={savingJobId === job.jobId} permissions={fieldPermissions} customerTextTemplate={customerTextTemplate} fieldNoteTemplates={fieldNoteTemplates} reviewInstructions={reviewInstructions} factoryCostInstructions={factoryCostInstructions} requireBeforePhotosForReview={requireBeforePhotosForReview} requireSerialTagPhotoForReview={requireSerialTagPhotoForReview} requireDamagePhotosForReview={requireDamagePhotosForReview} requireAfterPhotosForReview={requireAfterPhotosForReview} requireCompletionNotesForReview={requireCompletionNotesForReview} requireWorkCompleteForReview={requireWorkCompleteForReview} requirePartsClosedForReview={requirePartsClosedForReview} requireFactoryCostsForReview={requireFactoryCostsForReview} requireReceiptBackupForReview={requireReceiptBackupForReview} fieldSupportName={fieldSupportName} fieldSupportPhone={fieldSupportPhone} employeeHelpInstructions={employeeHelpInstructions} onStart={() => startJob(job)} onReadyReview={() => readyForManagerReview(job)} onChecklist={(itemId) => toggleChecklist(job, itemId)} onNote={(message, type) => saveFieldNote(job, message, type)} onCompletionNotes={(notes) => saveCompletionNotes(job, notes)} onFactoryCost={(costPatch) => saveFactoryCost(job, costPatch)} onNoteDraft={(value) => setNoteDrafts((old) => ({ ...old, [job.jobId]: value }))} />)}</div>
          {assignedJobs.length > 0 && !filteredAssignedJobs.length && <div className="card p-6 text-center">
            <p className="font-black">No jobs in this lane.</p>
            <p className="mt-1 text-sm text-black/45">Try another crew filter or view all assigned work.</p>
            <button type="button" onClick={() => setCrewFilter("all")} className="mt-4 min-h-11 rounded-xl bg-forest px-4 py-2 font-black text-white">Show All Work</button>
          </div>}
        </div>
      </details>
    </section> : null}

    {!loading && employee && !assignedJobs.length ? <div className="card p-6 text-center">
        <p className="font-black">No jobs assigned to {employee.name}.</p>
        <p className="mt-1 text-sm text-black/45">Assign this employee on a job edit screen, or mark a job as Full Crew.</p>
      </div> : null}
  </div>;
}

function CurrentJobPanel({ job, saving, permissions, onStart, onStartTravel, onArrive }: { job?: Job; saving: boolean; permissions: FieldPermissions; onStart: (job: Job) => void; onStartTravel: (job: Job) => void; onArrive: (job: Job) => void }) {
  if (!job) return <section className="card p-5 text-center">
    <p className="text-lg font-black">No assigned work right now.</p>
    <p className="mt-1 text-sm font-semibold text-black/45">Assigned jobs will show here when dispatch puts them on your crew list.</p>
  </section>;
  const action = primaryFieldAction(job);
  const session = getWorkSession(job);
  const travel = getTravelState(job);
  return <section className="card overflow-hidden">
    <div className="bg-sand p-4">
      <p className="text-xs font-black uppercase tracking-widest text-forest">Current / next job</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-black/45">{job.jobId} · {job.priority}</p>
          <h2 className="mt-1 truncate text-2xl font-black">{job.customerName}</h2>
          <p className="mt-1 text-sm font-semibold text-black/55">{job.city || "No city"} · {formatDue(job.dueDate)}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>
      {job.assignedCrew && <p className="mt-2 text-xs font-black uppercase tracking-wide text-black/40">Crew: {job.assignedCrew}</p>}
      <p className="mt-2 text-xs font-black uppercase tracking-wide text-black/40">{travel.active ? "Traveling" : session.started ? "Started" : travel.arrived ? "Arrived" : "Not Started"}</p>
      <p className="mt-3 rounded-xl bg-white p-3 text-sm font-bold text-black/65">{nextActionReason(job)}</p>
    </div>
    <div className="space-y-3 p-4">
      <CurrentJobInfo job={job} />
      {job.phone && <p className="rounded-xl bg-blue-50 p-3 text-sm font-black text-blue-900">Contact customer with ETA before arrival</p>}
      <FieldWorkflowGuide />
      {action.kind === "arrive"
        ? <button type="button" disabled={saving} onClick={() => onArrive(job)} className="block min-h-12 w-full rounded-xl bg-forest px-4 py-3 text-center font-black text-white disabled:opacity-50">{saving ? "Saving..." : action.label}</button>
        : action.kind === "travel"
          ? <button type="button" disabled={saving} onClick={() => onStartTravel(job)} className="block min-h-12 w-full rounded-xl bg-forest px-4 py-3 text-center font-black text-white disabled:opacity-50">{saving ? "Saving..." : action.label}</button>
          : session.started
            ? <Link href={`/jobs/${job.jobId}`} className="block min-h-12 rounded-xl bg-forest px-4 py-3 text-center font-black text-white">{action.label}</Link>
            : permissions.employeeCanStartJobs && action.kind === "start"
              ? <button type="button" disabled={saving} onClick={() => onStart(job)} className="block min-h-12 w-full rounded-xl bg-forest px-4 py-3 text-center font-black text-white disabled:opacity-50">{saving ? "Saving..." : action.label}</button>
              : <Link href={action.href} className="block min-h-12 rounded-xl bg-forest px-4 py-3 text-center font-black text-white">{action.label}</Link>}
      <QuickCurrentJobActions job={job} canUpload={permissions.employeeCanUploadFiles} />
    </div>
  </section>;
}

function CurrentJobInfo({ job }: { job: Job }) {
  return <div className="rounded-2xl border border-black/10 bg-white p-3">
    <div className="grid gap-2 text-sm">
      <InfoLine label="Customer / job" value={job.customerName || job.jobId} />
      <InfoLine label="Address" value={[job.address, job.city].filter(Boolean).join(", ")} />
      <InfoLine label="Phone" value={job.phone} />
      <InfoLine label="Scheduled" value={formatDue(job.dueDate)} />
      {job.assignedCrew && <InfoLine label="Crew" value={job.assignedCrew} />}
      {job.jobType && <InfoLine label="Job type" value={job.jobType} />}
      {job.scopeNotes && <div>
        <p className="text-[11px] font-black uppercase tracking-wide text-black/35">Work order / description</p>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap font-semibold text-black/70">{job.scopeNotes}</p>
      </div>}
    </div>
  </div>;
}

function InfoLine({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <div className="grid grid-cols-[7rem_1fr] gap-2">
    <p className="text-[11px] font-black uppercase tracking-wide text-black/35">{label}</p>
    <p className="font-semibold text-black/70">{value}</p>
  </div>;
}

function FieldWorkflowGuide() {
  const steps = ["Before Photos", "Perform Work", "Progress Photos", "Completed Photos", "Paperwork", "Ready for Review"];
  return <div className="flex flex-wrap items-center gap-1 rounded-xl bg-sand p-2 text-[11px] font-black text-black/55">
    {steps.map((step, index) => <span key={step} className="inline-flex items-center gap-1">
      <span className="rounded-full bg-white px-2 py-1">{step}</span>
      {index < steps.length - 1 && <span aria-hidden="true">→</span>}
    </span>)}
  </div>;
}

function QuickCurrentJobActions({ job, canUpload }: { job: Job; canUpload: boolean }) {
  const actions = [
    job.phone ? { label: "Call Customer", href: `tel:${job.phone}`, icon: <PhoneIcon className="size-5" /> } : null,
    job.address || job.city ? { label: "Open Maps", href: `https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city}`)}`, icon: <MapPinIcon className="size-5" />, external: true } : null,
    { label: "Additional Issue", href: `/jobs/${job.jobId}#additional-issue`, icon: <ExclamationTriangleIcon className="size-5" /> },
    canUpload ? { label: "Add Photo", href: `/jobs/${job.jobId}#photos`, icon: <CameraIcon className="size-5" /> } : { label: "Job Workspace", href: `/jobs/${job.jobId}`, icon: <ClipboardDocumentCheckIcon className="size-5" /> },
  ].filter(Boolean).slice(0, 4) as Array<{ label: string; href: string; icon: React.ReactNode; external?: boolean }>;
  return <div className="grid grid-cols-2 gap-2">
    {actions.map((action) => action.external
      ? <a key={action.label} href={action.href} target="_blank" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-ink">{action.icon}{action.label}</a>
      : <Link key={action.label} href={action.href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-ink">{action.icon}{action.label}</Link>)}
  </div>;
}

function EmployeeSevenDaySchedule({ groups }: { groups: Array<{ date: string; jobs: Job[] }> }) {
  return <section className="card overflow-hidden">
    <div className="border-b border-black/5 p-4">
      <h2 className="text-lg font-black">My 7-day schedule</h2>
      <p className="text-sm font-semibold text-black/45">Assigned scheduled work for today and the next 6 days.</p>
    </div>
    {groups.length ? <div className="divide-y divide-black/5">
      {groups.map((group) => <div key={group.date} className="p-3">
        <p className={`mb-2 text-xs font-black uppercase tracking-wide ${group.date === new Date().toLocaleDateString("en-CA") ? "text-forest" : "text-black/45"}`}>{formatScheduleDate(group.date)}</p>
        <div className="space-y-2">
          {group.jobs.map((job) => <ScheduleAssignmentRow key={job.jobId} job={job} />)}
        </div>
      </div>)}
    </div> : <p className="p-4 text-sm font-semibold text-black/40">No assigned scheduled work in the next 7 days.</p>}
  </section>;
}

function ScheduleAssignmentRow({ job }: { job: Job }) {
  return <Link href={`/jobs/${job.jobId}`} className="block rounded-xl bg-sand p-3 active:bg-black/10">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black">{job.customerName || job.jobId}</p>
        <p className="mt-0.5 truncate text-xs font-bold text-black/50">{job.jobId}{job.jobType ? ` · ${job.jobType}` : ""}</p>
      </div>
      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-black text-black/55">All day</span>
    </div>
    <p className="mt-2 truncate text-xs font-bold text-black/45">{[job.city, shortAddress(job.address)].filter(Boolean).join(" · ") || "Address not set"}</p>
  </Link>;
}

function FieldBlockers({ blockers }: { blockers: FieldBlocker[] }) {
  return <section className="card overflow-hidden">
    <div className="border-b border-black/5 p-4">
      <h2 className="text-lg font-black">Field blockers</h2>
      <p className="text-sm font-semibold text-black/45">Only items tied to assigned work.</p>
    </div>
    <div className="divide-y divide-black/5">
      {blockers.map((blocker) => <Link key={`${blocker.job.jobId}-${blocker.label}`} href={blocker.href} className="block p-3 active:bg-sand">
        <p className="text-sm font-black text-orange-900">{blocker.label}</p>
        <p className="mt-1 text-xs font-bold text-black/50">{blocker.job.jobId} · {blocker.job.customerName} · {blocker.detail}</p>
      </Link>)}
    </div>
  </section>;
}

function RecentFieldActivity({ items }: { items: Array<{ job: Job; activity: JobActivity }> }) {
  return <section className="card overflow-hidden">
    <div className="border-b border-black/5 p-4">
      <h2 className="text-lg font-black">Recent field activity</h2>
      <p className="text-sm font-semibold text-black/45">Today&apos;s updates by this employee.</p>
    </div>
    <div className="divide-y divide-black/5">
      {items.map(({ job, activity }) => <Link key={activity.id} href={`/jobs/${job.jobId}#history`} className="block p-3">
        <p className="line-clamp-2 text-sm font-black">{activity.message}</p>
        <p className="mt-1 text-xs font-bold text-black/45">{job.jobId} · {new Date(activity.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
      </Link>)}
    </div>
  </section>;
}

function CrewFilterBar({ value, counts, onChange }: { value: CrewFilter; counts: Record<CrewFilter, number>; onChange: (value: CrewFilter) => void }) {
  const filters: Array<{ value: CrewFilter; label: string }> = [
    { value: "today", label: "Today" },
    { value: "overdue", label: "Overdue" },
    { value: "started", label: "Started" },
    { value: "parts", label: "Parts" },
    { value: "closeout", label: "Closeout" },
    { value: "all", label: "All" },
  ];
  return <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
    {filters.map((filter) => <button key={filter.value} type="button" onClick={() => onChange(filter.value)} className={`min-h-16 rounded-2xl border p-2 text-center transition active:scale-[.98] ${value === filter.value ? "border-forest bg-forest text-white" : "border-black/10 bg-white text-ink"}`}>
      <span className="block text-2xl font-black">{counts[filter.value]}</span>
      <span className={`text-[11px] font-black uppercase tracking-wide ${value === filter.value ? "text-white/70" : "text-black/45"}`}>{filter.label}</span>
    </button>)}
  </div>;
}

function MyDayCommand({ employeeName, nextJob, todayJobs, overdueJobs, startedJobs, closeoutJobs }: { employeeName: string; nextJob?: Job; todayJobs: number; overdueJobs: number; startedJobs: number; closeoutJobs: number }) {
  return <section className="card overflow-hidden">
    <div className="bg-ink p-4 text-white">
      <p className="text-xs font-black uppercase tracking-widest text-lime">My day command</p>
      <h2 className="mt-1 text-2xl font-black">{employeeName}&apos;s field day</h2>
      <p className="mt-1 text-sm text-white/55">Start work, log proof, add notes, and close out jobs from the phone.</p>
    </div>
    <div className="grid gap-3 p-4 sm:grid-cols-4">
      <DayMetric label="Today" value={todayJobs} />
      <DayMetric label="Overdue" value={overdueJobs} />
      <DayMetric label="Started" value={startedJobs} />
      <DayMetric label="Needs closeout" value={closeoutJobs} />
    </div>
    {nextJob ? <div className="border-t border-black/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-forest">Next suggested job</p>
          <h3 className="mt-1 text-xl font-black">{nextJob.customerName}</h3>
          <p className="mt-1 text-sm font-semibold text-black/50">{nextJob.jobId} · {nextJob.city || "No city"} · {formatDue(nextJob.dueDate)}</p>
        </div>
        <StatusBadge status={nextJob.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link href={`/jobs/${nextJob.jobId}`} className="min-h-11 rounded-xl bg-forest px-3 py-2 text-center text-sm font-black text-white">Open job</Link>
        <Link href={`/jobs/${nextJob.jobId}#time-log`} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm font-black text-ink">Time log</Link>
        <Link href={`/jobs/${nextJob.jobId}#photos`} className="min-h-11 rounded-xl bg-sand px-3 py-2 text-center text-sm font-black text-ink">Photos</Link>
        <a href={`https://maps.google.com/?q=${encodeURIComponent(`${nextJob.address}, ${nextJob.city}`)}`} target="_blank" className="min-h-11 rounded-xl bg-ink px-3 py-2 text-center text-sm font-black text-white">Map</a>
      </div>
    </div> : <p className="border-t border-black/5 p-5 text-center text-sm font-semibold text-black/35">No assigned active work right now.</p>}
  </section>;
}

function DayMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-sand p-4">
    <p className="text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-black/45">{label}</p>
  </div>;
}

function EmployeeHelpPanel({ employeeName, fieldNotice, reviewInstructions }: { employeeName: string; fieldNotice: string; reviewInstructions: string }) {
  const steps = [
    { title: "1. Open the job", detail: "Check the address, scope, parts, and customer phone before you leave.", icon: <MapPinIcon />, href: "#field-actions" },
    { title: "2. Prove the work", detail: "Take before, serial/VIN, damage, and after photos so the office can bill clean.", icon: <CameraIcon />, href: "#field-actions" },
    { title: "3. Send it for review", detail: reviewInstructions, icon: <ClipboardDocumentCheckIcon />, href: "#field-actions" },
  ];
  return <section className="card p-4 sm:p-5">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink"><WrenchScrewdriverIcon className="size-5" /></span>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-forest">Simple field mode</p>
        <h2 className="text-lg font-black">What {employeeName} needs to do</h2>
        <p className="text-sm text-black/50">{fieldNotice}</p>
      </div>
    </div>
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((step) => <a key={step.title} href={step.href} className="rounded-2xl border border-black/10 bg-sand p-3 active:scale-[.99]">
        <span className="mb-3 grid size-9 place-items-center rounded-xl bg-white text-forest [&>svg]:size-5">{step.icon}</span>
        <p className="font-black">{step.title}</p>
        <p className="mt-1 text-sm font-semibold text-black/50">{step.detail}</p>
      </a>)}
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <a href="/install" className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-xs font-black text-ink">Install help</a>
      <a href="/account" className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-xs font-black text-ink">My login</a>
      <a href="#field-actions" className="min-h-11 rounded-xl bg-forest px-3 py-2 text-center text-xs font-black text-white">Start work list</a>
      <a href="#all-assigned-work" className="min-h-11 rounded-xl bg-ink px-3 py-2 text-center text-xs font-black text-white">All my jobs</a>
    </div>
  </section>;
}

function FieldActionCard({ job, noteDraft, saving, permissions, customerTextTemplate, fieldNoteTemplates, reviewInstructions, factoryCostInstructions, requireBeforePhotosForReview, requireSerialTagPhotoForReview, requireDamagePhotosForReview, requireAfterPhotosForReview, requireCompletionNotesForReview, requireWorkCompleteForReview, requirePartsClosedForReview, requireFactoryCostsForReview, requireReceiptBackupForReview, fieldSupportName, fieldSupportPhone, employeeHelpInstructions, onStart, onReadyReview, onChecklist, onNote, onCompletionNotes, onFactoryCost, onNoteDraft }: { job: Job; noteDraft: string; saving: boolean; permissions: FieldPermissions; customerTextTemplate: string; fieldNoteTemplates: string[]; reviewInstructions: string; factoryCostInstructions: string; requireBeforePhotosForReview: boolean; requireSerialTagPhotoForReview: boolean; requireDamagePhotosForReview: boolean; requireAfterPhotosForReview: boolean; requireCompletionNotesForReview: boolean; requireWorkCompleteForReview: boolean; requirePartsClosedForReview: boolean; requireFactoryCostsForReview: boolean; requireReceiptBackupForReview: boolean; fieldSupportName: string; fieldSupportPhone: string; employeeHelpInstructions: string; onStart: () => void; onReadyReview: () => void; onChecklist: (itemId: string) => void; onNote: (message: string, type?: JobActivity["type"]) => void; onCompletionNotes: (notes: string) => void; onFactoryCost: (costPatch: Partial<FactoryCostTracker>) => void; onNoteDraft: (value: string) => void }) {
  const review = fieldReviewStatus(job, requireFactoryCostsForReview, requireReceiptBackupForReview, requireBeforePhotosForReview, requireSerialTagPhotoForReview, requireDamagePhotosForReview, requireAfterPhotosForReview, requireCompletionNotesForReview, requireWorkCompleteForReview, requirePartsClosedForReview);
  const missing = fieldMissingItems(review);
  const helpMessage = fieldHelpMessage(job, review);
  return <div className="rounded-2xl border border-black/10 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.priority}</p>
        <h3 className="mt-1 truncate text-xl font-black">{job.customerName}</h3>
        <p className="mt-1 text-sm font-semibold text-black/55">{job.city} · {formatDue(job.dueDate)}</p>
      </div>
      <StatusBadge status={job.status} />
    </div>
    <ProgressBar job={job} />
    <FieldDueStatus job={job} />
    <FieldJobBasics job={job} />
    <FieldScopeSummary job={job} />
    <FieldPhotoProof job={job} canUpload={permissions.employeeCanUploadFiles} />
    <FieldCloseoutStatus review={review} instructions={reviewInstructions} />
    <QuickChecklist job={job} saving={saving} onChecklist={onChecklist} />
    {permissions.employeeCanAddCompletionNotes && <QuickCompletionNotes job={job} saving={saving} onSave={onCompletionNotes} />}
    <FieldLatestUpdate job={job} />
    {permissions.employeeCanAddQuickNotes && <QuickFieldNotes job={job} noteDraft={noteDraft} templates={fieldNoteTemplates} saving={saving} onNote={onNote} onNoteDraft={onNoteDraft} />}
    {permissions.employeeCanAddFactoryCosts && <FactoryCostQuickEntry job={job} instructions={factoryCostInstructions} saving={saving} onSave={onFactoryCost} />}
    {missing.length > 0 && <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800"><ExclamationTriangleIcon className="mr-1 inline size-4" />Needs: {missing.join(", ")}</p>}
    <FieldButtons job={job} saving={saving} permissions={permissions} customerTextTemplate={customerTextTemplate} fieldSupportName={fieldSupportName} fieldSupportPhone={fieldSupportPhone} employeeHelpInstructions={employeeHelpInstructions} reviewReady={review.readyForManager} reviewScore={review.score} supportText={helpMessage} onStart={onStart} onNeedHelp={() => onNote(helpMessage, "Status")} onReadyReview={onReadyReview} />
  </div>;
}

function FieldJobCard({ job, noteDraft, saving, permissions, customerTextTemplate, fieldNoteTemplates, reviewInstructions, factoryCostInstructions, requireBeforePhotosForReview, requireSerialTagPhotoForReview, requireDamagePhotosForReview, requireAfterPhotosForReview, requireCompletionNotesForReview, requireWorkCompleteForReview, requirePartsClosedForReview, requireFactoryCostsForReview, requireReceiptBackupForReview, fieldSupportName, fieldSupportPhone, employeeHelpInstructions, onStart, onReadyReview, onChecklist, onNote, onCompletionNotes, onFactoryCost, onNoteDraft }: { job: Job; noteDraft: string; saving: boolean; permissions: FieldPermissions; customerTextTemplate: string; fieldNoteTemplates: string[]; reviewInstructions: string; factoryCostInstructions: string; requireBeforePhotosForReview: boolean; requireSerialTagPhotoForReview: boolean; requireDamagePhotosForReview: boolean; requireAfterPhotosForReview: boolean; requireCompletionNotesForReview: boolean; requireWorkCompleteForReview: boolean; requirePartsClosedForReview: boolean; requireFactoryCostsForReview: boolean; requireReceiptBackupForReview: boolean; fieldSupportName: string; fieldSupportPhone: string; employeeHelpInstructions: string; onStart: () => void; onReadyReview: () => void; onChecklist: (itemId: string) => void; onNote: (message: string, type?: JobActivity["type"]) => void; onCompletionNotes: (notes: string) => void; onFactoryCost: (costPatch: Partial<FactoryCostTracker>) => void; onNoteDraft: (value: string) => void }) {
  const review = fieldReviewStatus(job, requireFactoryCostsForReview, requireReceiptBackupForReview, requireBeforePhotosForReview, requireSerialTagPhotoForReview, requireDamagePhotosForReview, requireAfterPhotosForReview, requireCompletionNotesForReview, requireWorkCompleteForReview, requirePartsClosedForReview);
  const helpMessage = fieldHelpMessage(job, review);
  return <div className="card p-4">
    <div className="flex items-start justify-between gap-3">
      <Link href={`/jobs/${job.jobId}`} className="min-w-0 flex-1">
        <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.priority}</p>
        <h3 className="mt-1 truncate text-xl font-black">{job.customerName}</h3>
        <p className="mt-1 text-sm font-semibold text-black/55">{job.jobType} · {job.address}, {job.city}</p>
      </Link>
      <StatusBadge status={job.status} />
    </div>
    <ProgressBar job={job} />
    <FieldWorkSessionBadge job={job} />
    <FieldDueStatus job={job} />
    <FieldJobBasics job={job} />
    <FieldScopeSummary job={job} />
    <FieldPhotoProof job={job} canUpload={permissions.employeeCanUploadFiles} />
    <FieldCloseoutStatus review={review} instructions={reviewInstructions} />
    <QuickChecklist job={job} saving={saving} onChecklist={onChecklist} />
    {permissions.employeeCanAddCompletionNotes && <QuickCompletionNotes job={job} saving={saving} onSave={onCompletionNotes} />}
    <FieldLatestUpdate job={job} />
    {permissions.employeeCanAddQuickNotes && <QuickFieldNotes job={job} noteDraft={noteDraft} templates={fieldNoteTemplates} saving={saving} onNote={onNote} onNoteDraft={onNoteDraft} />}
    {permissions.employeeCanAddFactoryCosts && <FactoryCostQuickEntry job={job} instructions={factoryCostInstructions} saving={saving} onSave={onFactoryCost} />}
    <FieldButtons job={job} saving={saving} permissions={permissions} customerTextTemplate={customerTextTemplate} fieldSupportName={fieldSupportName} fieldSupportPhone={fieldSupportPhone} employeeHelpInstructions={employeeHelpInstructions} reviewReady={review.readyForManager} reviewScore={review.score} supportText={helpMessage} onStart={onStart} onNeedHelp={() => onNote(helpMessage, "Status")} onReadyReview={onReadyReview} />
  </div>;
}

function FactoryCostQuickEntry({ job, instructions, saving, onSave }: { job: Job; instructions: string; saving: boolean; onSave: (costPatch: Partial<FactoryCostTracker>) => void }) {
  const existing = { ...defaultFactoryCost(), ...(job.factoryCost || {}) };
  const [draft, setDraft] = useState({
    miles: existing.miles,
    driveTimeHours: existing.driveTimeHours,
    hourlyRate: existing.hourlyRate,
    helperHours: existing.helperHours,
    helperRate: existing.helperRate,
    perDiemDays: existing.perDiemDays,
    perDiemRate: existing.perDiemRate,
    hotelTotal: existing.hotelTotal,
    materialsTotal: existing.materialsTotal,
    otherReceiptsTotal: existing.otherReceiptsTotal,
    notes: existing.notes || "",
  });
  if (job.source !== "Factory") return null;

  const preview = getFactoryCostTotals({ ...existing, ...draft });
  return <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <div>
        <p className="text-sm font-black text-blue-950">Factory costs</p>
        <p className="text-xs font-semibold text-blue-900/65">{instructions}</p>
      </div>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-900">${preview.grandTotal.toFixed(2)}</span>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <FieldCostInput label="Miles" value={draft.miles} onChange={(value) => setDraft((old) => ({ ...old, miles: value }))} />
      <FieldCostInput label="Drive hrs" value={draft.driveTimeHours} onChange={(value) => setDraft((old) => ({ ...old, driveTimeHours: value }))} />
      <FieldCostInput label="Hourly $" value={draft.hourlyRate} onChange={(value) => setDraft((old) => ({ ...old, hourlyRate: value }))} />
      <FieldCostInput label="Helper hrs" value={draft.helperHours} onChange={(value) => setDraft((old) => ({ ...old, helperHours: value }))} />
      <FieldCostInput label="Helper $" value={draft.helperRate} onChange={(value) => setDraft((old) => ({ ...old, helperRate: value }))} />
      <FieldCostInput label="Per diem days" value={draft.perDiemDays} onChange={(value) => setDraft((old) => ({ ...old, perDiemDays: value }))} />
      <FieldCostInput label="Per diem $" value={draft.perDiemRate} onChange={(value) => setDraft((old) => ({ ...old, perDiemRate: value }))} />
      <FieldCostInput label="Hotel $" value={draft.hotelTotal} onChange={(value) => setDraft((old) => ({ ...old, hotelTotal: value }))} />
      <FieldCostInput label="Materials $" value={draft.materialsTotal} onChange={(value) => setDraft((old) => ({ ...old, materialsTotal: value }))} />
      <FieldCostInput label="Other $" value={draft.otherReceiptsTotal} onChange={(value) => setDraft((old) => ({ ...old, otherReceiptsTotal: value }))} />
      <input value={draft.notes} onChange={(event) => setDraft((old) => ({ ...old, notes: event.target.value }))} className="min-h-10 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" placeholder="Notes" />
    </div>
    <button type="button" disabled={saving} onClick={() => onSave(draft)} className="mt-2 min-h-11 w-full rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save Factory Costs"}</button>
  </div>;
}

function FieldCostInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label>
    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-blue-900/60">{label}</span>
    <input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" className="min-h-10 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" placeholder="0" />
  </label>;
}

function QuickCompletionNotes({ job, saving, onSave }: { job: Job; saving: boolean; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(job.completionNotes || "");
  const saved = Boolean(job.completionNotes?.trim());
  return <form onSubmit={(event) => { event.preventDefault(); onSave(notes); }} className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <div>
        <p className="text-sm font-black text-emerald-950">Completion notes</p>
        <p className="text-xs font-semibold text-emerald-900/65">{saved ? "Saved for manager review." : "Tell admin what was finished before Ready Review."}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-black ${saved ? "bg-white text-emerald-900" : "bg-orange-100 text-orange-900"}`}>{saved ? "Added" : "Needed"}</span>
    </div>
    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="field min-h-20 !bg-white !py-2 text-sm" placeholder="Example: Trim-out complete, serial tag photo added, cleaned up, customer aware." />
    <button type="submit" disabled={saving || !notes.trim()} className="mt-2 min-h-11 w-full rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : saved ? "Update Completion Notes" : "Save Completion Notes"}</button>
  </form>;
}

function QuickFieldNotes({ job, noteDraft, templates, saving, onNote, onNoteDraft }: { job: Job; noteDraft: string; templates: string[]; saving: boolean; onNote: (message: string, type?: JobActivity["type"]) => void; onNoteDraft: (value: string) => void }) {
  const quickTemplates = parseFieldNoteTemplates(templates);
  return <div className="mt-3 rounded-2xl border border-black/10 bg-white p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-sm font-black">Quick field note</p>
      <Link href={`/jobs/${job.jobId}#operations`} className="text-xs font-black text-forest">All notes</Link>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {quickTemplates.map((template) => <button key={template.label} type="button" disabled={saving} onClick={() => onNote(template.message, template.type)} className="min-h-10 rounded-xl bg-sand px-2 py-2 text-center text-[11px] font-black text-ink disabled:opacity-50">{template.label}</button>)}
    </div>
    <form onSubmit={(event) => { event.preventDefault(); onNote(noteDraft); }} className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
      <input value={noteDraft} onChange={(event) => onNoteDraft(event.target.value)} className="field !min-h-11 !py-2 text-sm" placeholder="Type quick note..." />
      <button type="submit" disabled={saving || !noteDraft.trim()} className="min-h-11 rounded-xl bg-forest px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
    </form>
  </div>;
}

function parseFieldNoteTemplates(templates: string[]) {
  const validTypes: JobActivity["type"][] = ["Note", "Status", "Customer", "Source", "Parts", "Calendar", "CompanyCam", "Paperwork", "Receipt", "Invoice", "Time", "Signoff"];
  return (templates.length ? templates : defaultFieldNoteTemplates).map((line) => {
    const [label = "", message = "", type = "Note"] = line.split("|").map((part) => part.trim());
    const safeType = validTypes.includes(type as JobActivity["type"]) ? type as JobActivity["type"] : "Note";
    return { label: label || "Note", message: message || label || "Field note added.", type: safeType };
  }).slice(0, 8);
}

function FieldLatestUpdate({ job }: { job: Job }) {
  const latest = (job.activityLog || [])[0];
  if (!latest) return null;
  return <div className={`mt-3 rounded-2xl border p-3 ${latest.notify && !latest.resolvedAt ? "border-orange-200 bg-orange-50" : "border-black/10 bg-sand"}`}>
    <div className="mb-1 flex items-center justify-between gap-2">
      <p className="text-sm font-black">Latest update</p>
      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-black/45">{latest.type}</span>
    </div>
    <p className="line-clamp-3 text-sm font-semibold text-black/65">{latest.message}</p>
    <p className="mt-1 text-xs font-semibold text-black/40">{latest.createdBy} · {new Date(latest.createdAt).toLocaleString()}</p>
    {latest.notify && !latest.resolvedAt && <p className="mt-2 text-xs font-black uppercase tracking-wide text-orange-800">Needs follow-up</p>}
  </div>;
}

function FieldScopeSummary({ job }: { job: Job }) {
  return <div className="mt-3 rounded-2xl bg-sand p-3">
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-black/35">Scope</p>
        <p className="mt-1 line-clamp-3 text-sm font-semibold text-black/65">{job.scopeNotes || "No scope notes added."}</p>
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-black/35">Parts / materials</p>
        <p className={`mt-1 line-clamp-3 text-sm font-semibold ${job.partsNeeded ? "text-orange-800" : "text-black/45"}`}>{job.partsNeeded || "No parts listed."}</p>
      </div>
    </div>
  </div>;
}

function FieldPhotoProof({ job, canUpload }: { job: Job; canUpload: boolean }) {
  const requirements = [
    { label: "Before", count: (job.beforePhotos || []).length, needed: true },
    { label: "Serial/VIN", count: (job.serialTagPhotos || []).length, needed: true },
    { label: "Damage", count: (job.damagePhotos || []).length, needed: false },
    { label: "After", count: (job.afterPhotos || []).length, needed: ["In Progress", "Needs Inspection", "Complete"].includes(job.status) },
  ];
  const missing = requirements.filter((item) => item.needed && item.count === 0);
  if (!missing.length && requirements.every((item) => item.count === 0)) return null;
  return <div className="mt-3 rounded-2xl border border-black/10 bg-white p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <div>
        <p className="text-sm font-black">Photo proof</p>
        <p className="text-xs font-semibold text-black/45">{missing.length ? `${missing.length} required photo set${missing.length === 1 ? "" : "s"} missing` : "Required photo proof is covered."}</p>
      </div>
      {canUpload && <Link href={`/jobs/${job.jobId}#photos`} className="rounded-xl bg-lime px-3 py-2 text-xs font-black text-ink">Add photos</Link>}
    </div>
    <div className="grid grid-cols-2 gap-2">
      {requirements.map((item) => <Link key={item.label} href={`/jobs/${job.jobId}#photos`} className={`rounded-xl p-2 text-xs font-black ${item.needed && item.count === 0 ? "bg-orange-50 text-orange-900" : "bg-sand text-black/60"}`}>
        <span className="block">{item.needed && item.count === 0 ? "Need" : "Have"} · {item.label}</span>
        <span className="mt-0.5 block font-semibold opacity-70">{item.count} uploaded</span>
      </Link>)}
    </div>
  </div>;
}

function FieldJobBasics({ job }: { job: Job }) {
  const address = [job.address, job.city].filter(Boolean).join(", ") || "No address listed";
  const source = job.source === "Dealer" ? job.dealerName || "Dealer" : job.source === "Factory" ? job.factoryWorkOrderNumber || "Factory" : "Individual";
  return <div className="mt-3 grid gap-2 rounded-2xl border border-black/10 bg-white p-3 text-sm sm:grid-cols-2">
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-black/35">Location</p>
      <p className="mt-1 font-semibold text-black/65">{address}</p>
    </div>
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-black/35">Phone</p>
      <p className="mt-1 font-semibold text-black/65">{job.phone || "No phone listed"}</p>
    </div>
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-black/35">Job type</p>
      <p className="mt-1 font-semibold text-black/65">{job.jobType || "Not listed"}</p>
    </div>
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-black/35">Source</p>
      <p className="mt-1 font-semibold text-black/65">{source}</p>
    </div>
  </div>;
}

function QuickChecklist({ job, saving, onChecklist }: { job: Job; saving: boolean; onChecklist: (itemId: string) => void }) {
  const checklist = checklistProgress(job).items;
  const incomplete = checklist.filter((item) => !item.complete).slice(0, 3);
  const recentlyDone = checklist.filter((item) => item.complete).slice(-1);
  if (!checklist.length) return null;
  return <div className="mt-3 rounded-2xl bg-sand p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-sm font-black">Quick checklist</p>
      <Link href={`/jobs/${job.jobId}`} className="text-xs font-black text-forest">Full list</Link>
    </div>
    <div className="grid gap-2">
      {incomplete.length ? incomplete.map((item) => <button key={item.id} type="button" disabled={saving} onClick={() => onChecklist(item.id)} className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 py-2 text-left text-sm font-black text-ink disabled:opacity-50">
        <span className="grid size-6 shrink-0 place-items-center rounded-md border border-black/20"><CheckCircleIcon className="size-4 text-black/20" /></span>
        <span className="line-clamp-2">{item.label}</span>
      </button>) : <p className="rounded-xl bg-white p-3 text-sm font-black text-forest">Checklist is complete.</p>}
      {recentlyDone.length > 0 && incomplete.length > 0 && <button type="button" disabled={saving} onClick={() => onChecklist(recentlyDone[0].id)} className="min-h-10 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-black text-black/45 disabled:opacity-50">Undo last done: {recentlyDone[0].label}</button>}
    </div>
  </div>;
}

function FieldCloseoutStatus({ review, instructions }: { review: ReturnType<typeof fieldReviewStatus>; instructions: string }) {
  const nextSteps = review.items.filter((item) => !item.ok).slice(0, 3);
  const remaining = review.items.filter((item) => !item.ok).length;
  const hasRequirements = review.items.length > 0;
  return <div className="mt-3 rounded-2xl border border-black/10 bg-sand p-3">
    <div className="mb-2 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-black">Before you send for review</p>
        <p className="text-xs font-semibold text-black/45">{hasRequirements ? review.readyForManager ? "Everything needed is ready." : `${remaining} remaining before Ready for Review.` : "No required closeout checks are enabled."}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-black ${review.readyForManager ? "bg-forest text-white" : "bg-orange-100 text-orange-900"}`}>{review.score}%</span>
    </div>
    {instructions && <p className="mb-2 rounded-xl border border-black/10 bg-white p-3 text-xs font-bold text-black/55">{instructions}</p>}
    {!hasRequirements ? <p className="mb-2 rounded-xl bg-white p-3 text-sm font-black text-forest">Admin has no required Ready Review checks turned on for this job.</p> : review.readyForManager ? <p className="mb-2 rounded-xl bg-white p-3 text-sm font-black text-forest">Good to go — tap Ready Review when the job is finished.</p> : <div className="mb-2 grid gap-2">
      {nextSteps.map((item) => <a key={item.label} href={item.href} className="rounded-xl bg-white p-3 text-sm font-black text-orange-900">
        Do this next: {item.label}
        <span className="mt-0.5 block text-xs font-semibold text-black/45">{item.detail}</span>
      </a>)}
    </div>}
    <div className="grid grid-cols-2 gap-2">
      {review.items.map((item) => <a key={item.label} href={item.href} className={`rounded-xl p-2 text-xs font-black ${item.ok ? "bg-white text-forest" : "bg-orange-50 text-orange-900"}`}>
        <span className="block">{item.ok ? "Ready" : "Need"} · {item.label}</span>
        <span className="mt-0.5 block truncate font-semibold opacity-70">{item.detail}</span>
      </a>)}
    </div>
  </div>;
}

function FieldButtons({ job, saving, permissions, customerTextTemplate, fieldSupportName, fieldSupportPhone, employeeHelpInstructions, reviewReady, reviewScore, supportText, onStart, onNeedHelp, onReadyReview }: { job: Job; saving: boolean; permissions: FieldPermissions; customerTextTemplate: string; fieldSupportName: string; fieldSupportPhone: string; employeeHelpInstructions: string; reviewReady: boolean; reviewScore: number; supportText: string; onStart: () => void; onNeedHelp: () => void; onReadyReview: () => void }) {
  const reviewButtonLabel = job.status === "Needs Inspection" ? "Review Sent" : reviewReady ? "Ready Review" : `Locked ${reviewScore}%`;
  const session = getWorkSession(job);
  return <div className="mt-4 space-y-2">
    {permissions.employeeCanRequestHelp && employeeHelpInstructions && <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-900">{employeeHelpInstructions}</p>}
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
    <a href={`tel:${job.phone}`} className={`min-h-12 rounded-xl px-3 py-3 text-center text-xs font-black ${job.phone ? "bg-forest text-white" : "pointer-events-none bg-black/5 text-black/25"}`}><PhoneIcon className="mx-auto mb-1 size-5" />Call</a>
    <a href={`sms:${job.phone}?&body=${encodeURIComponent(formatCustomerText(customerTextTemplate, job))}`} className={`min-h-12 rounded-xl px-3 py-3 text-center text-xs font-black ${job.phone ? "border border-black/10 bg-white text-ink" : "pointer-events-none bg-black/5 text-black/25"}`}><PhoneIcon className="mx-auto mb-1 size-5" />Text</a>
    <a href={`https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city}`)}`} target="_blank" className="min-h-12 rounded-xl bg-ink px-3 py-3 text-center text-xs font-black text-white"><MapPinIcon className="mx-auto mb-1 size-5" />Map</a>
    {permissions.employeeCanRequestHelp && <button type="button" onClick={onNeedHelp} disabled={saving} className="min-h-12 rounded-xl bg-red-100 px-3 py-3 text-center text-xs font-black text-red-900 disabled:opacity-50"><ExclamationTriangleIcon className="mx-auto mb-1 size-5" />Need Help</button>}
    {permissions.employeeCanRequestHelp && fieldSupportPhone && <a href={`tel:${fieldSupportPhone}`} className="min-h-12 rounded-xl bg-red-600 px-3 py-3 text-center text-xs font-black text-white"><PhoneIcon className="mx-auto mb-1 size-5" />{fieldSupportName || "Office"}</a>}
    {permissions.employeeCanRequestHelp && fieldSupportPhone && <a href={`sms:${fieldSupportPhone}?&body=${encodeURIComponent(supportText)}`} className="min-h-12 rounded-xl bg-red-50 px-3 py-3 text-center text-xs font-black text-red-900"><PhoneIcon className="mx-auto mb-1 size-5" />Text Office</a>}
    {permissions.employeeCanStartJobs && (session.started ? <Link href={`/jobs/${job.jobId}`} className="min-h-12 rounded-xl bg-blue-100 px-3 py-3 text-center text-xs font-black text-blue-900"><PlayIcon className="mx-auto mb-1 size-5" />Continue</Link> : <button type="button" onClick={onStart} disabled={saving} className="min-h-12 rounded-xl bg-blue-100 px-3 py-3 text-center text-xs font-black text-blue-900 disabled:opacity-50"><PlayIcon className="mx-auto mb-1 size-5" />{saving ? "Saving" : "Start"}</button>)}
    {job.googleCalendarEventUrl && <a href={job.googleCalendarEventUrl} target="_blank" className="min-h-12 rounded-xl bg-blue-50 px-3 py-3 text-center text-xs font-black text-blue-900"><CalendarDaysIcon className="mx-auto mb-1 size-5" />Calendar</a>}
    {job.companyCamProjectUrl && <a href={job.companyCamProjectUrl} target="_blank" className="min-h-12 rounded-xl bg-yellow-50 px-3 py-3 text-center text-xs font-black text-yellow-900"><CameraIcon className="mx-auto mb-1 size-5" />CompanyCam</a>}
    <Link href={`/jobs/${job.jobId}#time-log`} className="min-h-12 rounded-xl bg-sand px-3 py-3 text-center text-xs font-black text-ink"><ClockIcon className="mx-auto mb-1 size-5" />Time</Link>
    {permissions.employeeCanUploadFiles && <Link href={`/jobs/${job.jobId}#paperwork`} className="min-h-12 rounded-xl bg-purple-50 px-3 py-3 text-center text-xs font-black text-purple-900"><DocumentTextIcon className="mx-auto mb-1 size-5" />Paperwork</Link>}
    {permissions.employeeCanUploadFiles && <Link href={`/jobs/${job.jobId}#photos`} className="min-h-12 rounded-xl bg-lime px-3 py-3 text-center text-xs font-black text-ink"><CameraIcon className="mx-auto mb-1 size-5" />Photos</Link>}
    {permissions.employeeCanUploadFiles && <Link href={`/jobs/${job.jobId}#receipts`} className="min-h-12 rounded-xl bg-blue-50 px-3 py-3 text-center text-xs font-black text-blue-900"><ReceiptPercentIcon className="mx-auto mb-1 size-5" />Receipts</Link>}
    <Link href={`/jobs/${job.jobId}#additional-issue`} className="min-h-12 rounded-xl bg-orange-50 px-3 py-3 text-center text-xs font-black text-orange-900"><ExclamationTriangleIcon className="mx-auto mb-1 size-5" />Additional Issue</Link>
    {permissions.employeeCanRequestParts && <Link href={`/jobs/${job.jobId}#parts-needed`} className="min-h-12 rounded-xl bg-orange-50 px-3 py-3 text-center text-xs font-black text-orange-900"><WrenchScrewdriverIcon className="mx-auto mb-1 size-5" />Parts</Link>}
    <Link href={`/jobs/${job.jobId}#operations`} className="min-h-12 rounded-xl bg-sand px-3 py-3 text-center text-xs font-black text-ink"><ClipboardDocumentCheckIcon className="mx-auto mb-1 size-5" />Notes</Link>
    <Link href={`/jobs/${job.jobId}`} className="min-h-12 rounded-xl border border-black/10 bg-white px-3 py-3 text-center text-xs font-black text-ink"><CheckCircleIcon className="mx-auto mb-1 size-5" />Checklist</Link>
    {permissions.employeeCanSendReadyReview && <Link href={`/jobs/${job.jobId}#complete-job`} className="min-h-12 rounded-xl bg-emerald-50 px-3 py-3 text-center text-xs font-black text-emerald-900"><CheckCircleIcon className="mx-auto mb-1 size-5" />Complete</Link>}
    {permissions.employeeCanSendReadyReview && <button type="button" onClick={onReadyReview} disabled={saving || !reviewReady || job.status === "Needs Inspection"} className="min-h-12 rounded-xl bg-forest px-3 py-3 text-center text-xs font-black text-white disabled:opacity-50"><ClipboardDocumentCheckIcon className="mx-auto mb-1 size-5" />{saving ? "Saving" : reviewButtonLabel}</button>}
    {permissions.employeeCanAddSignoffs && <Link href={`/jobs/${job.jobId}#signoffs`} className="min-h-12 rounded-xl border border-black/10 bg-white px-3 py-3 text-center text-xs font-black text-ink"><DocumentTextIcon className="mx-auto mb-1 size-5" />Sign</Link>}
    {permissions.employeeCanViewPackets && <Link href={`/jobs/${job.jobId}/packet`} className="min-h-12 rounded-xl border border-black/10 bg-white px-3 py-3 text-center text-xs font-black text-ink"><ClipboardDocumentCheckIcon className="mx-auto mb-1 size-5" />Packet</Link>}
    </div>
  </div>;
}

function ProgressBar({ job }: { job: Job }) {
  const { total, complete, remaining, percent } = checklistProgress(job);
  return <div className="mt-3">
    <div className="mb-1 flex items-center justify-between text-xs font-black text-black/45"><span>Job completion: {percent}%</span><span>{complete}/{total} · {remaining} remaining</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-forest transition-all" style={{ width: `${percent}%` }} /></div>
  </div>;
}

function FieldDueStatus({ job }: { job: Job }) {
  const today = new Date().toLocaleDateString("en-CA");
  const label = !job.dueDate ? "Unscheduled" : job.dueDate < today ? "Overdue" : job.dueDate === today ? "Due today" : "Upcoming";
  const tone = label === "Overdue" ? "bg-red-100 text-red-800" : label === "Due today" ? "bg-lime text-ink" : label === "Upcoming" ? "bg-blue-100 text-blue-800" : "bg-sand text-black/55";
  return <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white p-3">
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-black/35">Schedule status</p>
      <p className="mt-1 text-sm font-semibold text-black/65">{formatDue(job.dueDate)}</p>
    </div>
    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${tone}`}>{label}</span>
  </div>;
}

function FieldWorkSessionBadge({ job }: { job: Job }) {
  const session = getWorkSession(job);
  return <div className="mt-3 rounded-2xl border border-black/10 bg-white p-3">
    <p className="text-xs font-black uppercase tracking-wide text-black/35">Work session</p>
    <p className="mt-1 text-sm font-semibold text-black/65">{session.started ? `Started ${formatShortDateTime(session.started.createdAt)}` : "Not Started"}</p>
  </div>;
}

function needsFieldCloseout(job: Job, options: FieldReviewOptions) {
  return !fieldReviewStatusFromOptions(job, options).readyForManager;
}

function fieldReviewStatusFromOptions(job: Job, options: FieldReviewOptions) {
  return fieldReviewStatus(job, options.requireFactoryCostsForReview, options.requireReceiptBackupForReview, options.requireBeforePhotosForReview, options.requireSerialTagPhotoForReview, options.requireDamagePhotosForReview, options.requireAfterPhotosForReview, options.requireCompletionNotesForReview, options.requireWorkCompleteForReview, options.requirePartsClosedForReview);
}

function fieldReviewStatus(job: Job, requireFactoryCostsForReview = true, requireReceiptBackupForReview = true, requireBeforePhotosForReview = true, requireSerialTagPhotoForReview = true, requireDamagePhotosForReview = false, requireAfterPhotosForReview = true, requireCompletionNotesForReview = true, requireWorkCompleteForReview = true, requirePartsClosedForReview = true) {
  const checklist = job.checklist || [];
  const workCompleted = checklist.some((item) => item.label === "Work completed" && item.complete) || ["Complete", "Needs Inspection", "Billed", "Paid"].includes(job.status);
  const openParts = (job.partsItems || []).some((part) => ["Needed", "Ordered", "Picked up"].includes(part.status)) || job.status === "Waiting on Parts";
  const factoryCostsReady = job.source !== "Factory" || !requireFactoryCostsForReview || hasFactoryCostWork(job.factoryCost);
  const receiptBackupReady = !requireReceiptBackupForReview || !hasReceiptDollars(job) || hasUploadedReceiptBackup(job);
  const items = [
    ...(requireBeforePhotosForReview ? [{ label: "Before photos", ok: (job.beforePhotos || []).length > 0, detail: `${(job.beforePhotos || []).length} uploaded`, href: `/jobs/${job.jobId}#photos` }] : []),
    ...(requireSerialTagPhotoForReview ? [{ label: "Serial/VIN photo", ok: (job.serialTagPhotos || []).length > 0, detail: `${(job.serialTagPhotos || []).length} uploaded`, href: `/jobs/${job.jobId}#photos` }] : []),
    ...(requireDamagePhotosForReview ? [{ label: "Damage photos", ok: (job.damagePhotos || []).length > 0, detail: `${(job.damagePhotos || []).length} uploaded`, href: `/jobs/${job.jobId}#photos` }] : []),
    ...(requireAfterPhotosForReview ? [{ label: "After photos", ok: (job.afterPhotos || []).length > 0, detail: `${(job.afterPhotos || []).length} uploaded`, href: `/jobs/${job.jobId}#photos` }] : []),
    ...(requireCompletionNotesForReview ? [{ label: "Completion notes", ok: Boolean(job.completionNotes?.trim()), detail: job.completionNotes?.trim() ? "Added" : "Missing", href: `/jobs/${job.jobId}#complete-job` }] : []),
    ...(requireWorkCompleteForReview ? [{ label: "Work completed", ok: workCompleted, detail: workCompleted ? "Checked" : "Checklist/status needed", href: `/jobs/${job.jobId}` }] : []),
    ...(requirePartsClosedForReview ? [{ label: "Parts closed", ok: !openParts, detail: openParts ? "Parts still open" : "No open parts", href: `/jobs/${job.jobId}#parts-needed` }] : []),
    ...(job.source === "Factory" && requireFactoryCostsForReview ? [{ label: "Factory costs", ok: factoryCostsReady, detail: factoryCostsReady ? "Added" : "Cost entry needed", href: `/jobs/${job.jobId}#factory-costs` }] : []),
    ...(requireReceiptBackupForReview && hasReceiptDollars(job) ? [{ label: "Receipt backup", ok: receiptBackupReady, detail: receiptBackupReady ? "Added" : "Receipt upload needed", href: `/jobs/${job.jobId}#receipts` }] : []),
  ];
  const readyCount = items.filter((item) => item.ok).length;
  const score = items.length ? Math.round((readyCount / items.length) * 100) : 100;
  return { items, readyCount, score, readyForManager: readyCount === items.length };
}

function fieldMissingItems(review: ReturnType<typeof fieldReviewStatus>) {
  return review.items.filter((item) => !item.ok).map((item) => item.label.toLowerCase()).slice(0, 4);
}

function fieldHelpMessage(job: Job, review: ReturnType<typeof fieldReviewStatus>) {
  const blocker = review.items.find((item) => !item.ok);
  return blocker
    ? `Need help on ${job.jobId}: blocked by ${blocker.label.toLowerCase()} (${blocker.detail}). Please call or review this job.`
    : `Need help on ${job.jobId}: crew needs manager direction. Please call or review this job.`;
}

type FieldBlocker = { job: Job; label: string; detail: string; href: string };

function primaryFieldAction(job: Job) {
  const travel = getTravelState(job);
  const session = getWorkSession(job);
  if (travel.active) return { kind: "arrive" as const, label: "Arrive at Job", href: `/jobs/${job.jobId}#time-log` };
  if (!travel.started && !session.started && ["New", "Scheduled"].includes(job.status)) return { kind: "travel" as const, label: "Start Travel", href: `/jobs/${job.jobId}#time-log` };
  if (session.active) return { kind: "continue" as const, label: "Continue Job", href: `/jobs/${job.jobId}` };
  if (travel.arrived && !session.started && ["New", "Scheduled"].includes(job.status)) return { kind: "start" as const, label: "Start Job", href: `/jobs/${job.jobId}` };
  if (job.status === "In Progress") return { kind: "continue" as const, label: "Continue Job", href: `/jobs/${job.jobId}` };
  if (job.status === "Waiting on Parts") return { kind: "open" as const, label: "Review Parts", href: `/jobs/${job.jobId}#parts` };
  if (["New", "Scheduled"].includes(job.status)) return { kind: "start" as const, label: "Start Job", href: `/jobs/${job.jobId}` };
  return { kind: "open" as const, label: "Open Job", href: `/jobs/${job.jobId}` };
}

function nextActionReason(job: Job) {
  const travel = getTravelState(job);
  if (travel.active) return "Travel is active. Tap Arrive at Job when you get on site.";
  if (!travel.started && !getWorkSession(job).started && ["New", "Scheduled"].includes(job.status)) return "Heading out? Start travel first, then arrive before starting work.";
  if (travel.arrived && !getWorkSession(job).started) return "Arrived on site. Start the job when work begins.";
  if (job.status === "In Progress") return "Already started. Continue the guided job workspace.";
  if (job.status === "Waiting on Parts") return "Parts are blocking the job. Review the parts section.";
  if (job.status === "Needs Inspection") return "Ready for manager review. Check closeout if anything was returned.";
  if (job.dueDate === new Date().toLocaleDateString("en-CA")) return "Due today. Open the job before heading out.";
  if (job.dueDate) return `Upcoming assignment for ${formatDue(job.dueDate)}.`;
  return "Assigned with no due date. Open the job for details.";
}

function getFieldBlockers(jobs: Job[], options: FieldReviewOptions, today: string): FieldBlocker[] {
  const blockers: FieldBlocker[] = [];
  for (const job of jobs) {
    if (job.status === "Waiting on Parts" || (job.partsItems || []).some((part) => ["Needed", "Ordered", "Picked up"].includes(part.status))) {
      blockers.push({ job, label: "Waiting on parts", detail: "Parts need review before work can move.", href: `/jobs/${job.jobId}#parts` });
    }
    const contactActivity = (job.activityLog || []).find((activity) => !activity.resolvedAt && activity.notify && /customer|contact|call|not home/i.test(activity.message));
    if (contactActivity) {
      blockers.push({ job, label: "Customer contact required", detail: contactActivity.message, href: `/jobs/${job.jobId}#notes` });
    }
    if (job.dueDate === today && ["New", "Scheduled"].includes(job.status)) {
      blockers.push({ job, label: "Today but not started", detail: "Open or start this assignment before the end of the day.", href: `/jobs/${job.jobId}` });
    }
    if (job.status === "Needs Inspection") {
      const missingCloseout = fieldReviewStatusFromOptions(job, options).items.find((item) => !item.ok);
      if (missingCloseout) blockers.push({ job, label: "Closeout item missing", detail: missingCloseout.label, href: missingCloseout.href });
    }
    const returned = (job.activityLog || []).find((activity) => !activity.resolvedAt && /return|returned|correction|fix/i.test(activity.message));
    if (returned) {
      blockers.push({ job, label: "Returned for correction", detail: returned.message, href: `/jobs/${job.jobId}#notes` });
    }
  }
  return blockers;
}

function groupSevenDayAssignments(jobs: Job[], today: string) {
  const end = addDays(today, 6);
  const upcoming = jobs
    .filter((job) => job.dueDate && job.dueDate >= today && job.dueDate <= end)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || fieldWorkSort(a, b, today));
  const groups = new Map<string, Job[]>();
  for (const job of upcoming) {
    groups.set(job.dueDate, [...(groups.get(job.dueDate) || []), job]);
  }
  return Array.from(groups, ([date, groupJobs]) => ({ date, jobs: groupJobs }));
}

function getRecentFieldActivity(jobs: Job[], employeeName: string, today: string) {
  return jobs.flatMap((job) => (job.activityLog || [])
    .filter((activity) => activity.createdBy === employeeName && activity.createdAt.startsWith(today))
    .map((activity) => ({ job, activity })))
    .sort((a, b) => b.activity.createdAt.localeCompare(a.activity.createdAt));
}

function fieldWorkSort(a: Job, b: Job, today: string) {
  return statusRank(a.status) - statusRank(b.status)
    || (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99")
    || priorityRank(a.priority) - priorityRank(b.priority)
    || a.jobId.localeCompare(b.jobId);
}

function statusRank(status: Job["status"]) {
  if (status === "In Progress") return 0;
  if (status === "Scheduled") return 1;
  if (status === "New") return 2;
  if (status === "Waiting on Parts") return 3;
  if (status === "Needs Inspection") return 4;
  return 5;
}

function priorityRank(priority: Job["priority"]) {
  if (priority === "Urgent") return 0;
  if (priority === "High") return 1;
  if (priority === "Normal") return 2;
  return 3;
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return next.toLocaleDateString("en-CA");
}

function fieldSort(a: Job, b: Job, today: string) {
  const aOverdue = a.dueDate && a.dueDate < today ? 0 : 1;
  const bOverdue = b.dueDate && b.dueDate < today ? 0 : 1;
  return aOverdue - bOverdue || (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
}

function matchesCrewFilter(job: Job, filter: CrewFilter, today: string, options: FieldReviewOptions) {
  if (filter === "all") return true;
  if (filter === "today") return job.dueDate === today;
  if (filter === "overdue") return activeStatuses.includes(job.status) && Boolean(job.dueDate) && job.dueDate < today;
  if (filter === "started") return Boolean(getWorkSession(job).started);
  if (filter === "parts") return job.status === "Waiting on Parts";
  if (filter === "closeout") return needsFieldCloseout(job, options);
  return true;
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

function formatDue(dueDate: string) {
  return dueDate ? new Date(`${dueDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Not scheduled";
}

function formatScheduleDate(dueDate: string) {
  const today = new Date().toLocaleDateString("en-CA");
  if (dueDate === today) return `Today · ${formatDue(dueDate)}`;
  return new Date(`${dueDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function shortAddress(address: string) {
  return address.split(",")[0]?.trim() || "";
}

function formatShortDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatTodayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatCustomerText(template: string, job: Job) {
  return (template || "RTS update for {customerName}: crew is on your job {jobId}.")
    .replaceAll("{customerName}", job.customerName || "your home")
    .replaceAll("{jobId}", job.jobId)
    .replaceAll("{jobType}", job.jobType || "service")
    .replaceAll("{dueDate}", job.dueDate || "today");
}

function pickFieldPermissions(settings: Partial<BusinessSettings> | null): Partial<FieldPermissions> {
  if (!settings) return {};
  const picked: Partial<FieldPermissions> = {};
  for (const key of Object.keys(defaultFieldPermissions) as Array<keyof FieldPermissions>) {
    if (typeof settings[key] === "boolean") picked[key] = settings[key];
  }
  return picked;
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="card p-4">
    <div className="mb-3 grid size-10 place-items-center rounded-xl bg-lime/70 [&>svg]:size-5">{icon}</div>
    <p className="text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-black/45">{label}</p>
  </div>;
}
