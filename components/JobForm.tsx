"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { emptyJob, priorities, sources, statuses, type BusinessSettings, type Employee, type Job } from "@/lib/types";
import { authFetch } from "@/lib/client-auth";

const defaultOptions: { jobTypeOptions: string[]; statusOptions: string[]; priorityOptions: string[]; checklistOptions: string[] } = {
  jobTypeOptions: ["Trim out", "Service", "Warranty", "Setup", "Skirting", "Repair"],
  statusOptions: [...statuses],
  priorityOptions: [...priorities],
  checklistOptions: [],
};

export function JobForm({ initialJob }: { initialJob?: Job }) {
  const router = useRouter();
  const [job, setJob] = useState<Job>(initialJob || emptyJob);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [savedDraft, setSavedDraft] = useState<{ job: Job; savedAt: string } | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [options, setOptions] = useState(defaultOptions);
  const draftKey = initialJob ? `company-command-job-draft-${initialJob.jobId}` : "company-command-job-draft-new";
  useEffect(() => { fetch("/api/employees").then((response) => response.json()).then(setEmployees).catch(() => setError("Employees could not be loaded.")); }, []);
  useEffect(() => {
    fetch("/api/settings").then((response) => response.json()).then((settings: BusinessSettings) => setOptions({
      jobTypeOptions: settings.jobTypeOptions?.length ? settings.jobTypeOptions : defaultOptions.jobTypeOptions,
      statusOptions: settings.statusOptions?.length ? settings.statusOptions : defaultOptions.statusOptions,
      priorityOptions: settings.priorityOptions?.length ? settings.priorityOptions : defaultOptions.priorityOptions,
      checklistOptions: settings.checklistOptions?.length ? settings.checklistOptions : defaultOptions.checklistOptions,
    })).catch(() => setOptions(defaultOptions));
  }, []);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { job?: Job; savedAt?: string };
        if (parsed.job) setSavedDraft({ job: parsed.job, savedAt: parsed.savedAt || "" });
      }
    } catch {
      setSavedDraft(null);
    } finally {
      setDraftLoaded(true);
    }
  }, [draftKey]);
  useEffect(() => {
    if (!draftLoaded || !draftDirty) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ job, savedAt: new Date().toISOString() }));
        setDraftStatus("Draft saved on this phone.");
      } catch {
        setDraftStatus("Draft could not be saved on this phone.");
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftDirty, draftKey, draftLoaded, job]);
  function updateJob(updater: (old: Job) => Job) {
    setDraftDirty(true);
    setJob(updater);
  }
  const set = <K extends keyof Job>(key: K, value: Job[K]) => updateJob((old) => ({ ...old, [key]: value }));
  function restoreDraft() {
    if (!savedDraft) return;
    setJob(savedDraft.job);
    setSavedDraft(null);
    setDraftDirty(true);
    setDraftStatus("Draft restored. Review it, then save the job.");
  }
  function discardDraft() {
    window.localStorage.removeItem(draftKey);
    setSavedDraft(null);
    setDraftDirty(false);
    setDraftStatus("Draft discarded from this phone.");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const selected = employees.filter((employee) => job.assignedEmployeeIds?.includes(employee.id));
      const assignment = job.fullCrew ? "Full Crew" : selected.length ? selected.map((employee) => employee.name).join(", ") : "Unassigned";
      const payload = { ...job, assignedCrew: assignment, checklist: initialJob ? job.checklist : makeChecklistFromLabels(options.checklistOptions, job.checklist) };
      const response = await authFetch(initialJob ? `/api/jobs/${initialJob.jobId}` : "/api/jobs", { method: initialJob ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || "The job could not be saved.");
      window.localStorage.removeItem(draftKey);
      setDraftDirty(false);
      router.push(`/jobs/${saved.jobId}`);
    } catch (caught) {
      setError(`${caught instanceof Error ? caught.message : "The job could not be saved."} Your phone draft is still saved here so you do not have to re-enter the job.`);
    } finally {
      setSaving(false);
    }
  }
  async function removeJob() {
    if (!initialJob || !window.confirm(`Delete ${initialJob.customerName}'s job? This cannot be undone.`)) return;
    setDeleting(true); setError("");
    try {
      const response = await authFetch(`/api/jobs/${initialJob.jobId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The job could not be deleted.");
      router.push("/jobs");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The job could not be deleted.");
      setDeleting(false);
    }
  }
  return <form onSubmit={submit} className="space-y-5">
    <FormSection title="Job basics" description="Source, schedule, and assignment">
      <Select label="Source" value={job.source} options={[...sources]} onChange={(v) => set("source", v as Job["source"])} />
      {job.source === "Dealer" && <Input label="Dealer name" value={job.dealerName} onChange={(v) => set("dealerName", v)} required />}
      {job.source === "Factory" && <Input label="Factory work order #" value={job.factoryWorkOrderNumber} onChange={(v) => set("factoryWorkOrderNumber", v)} required />}
      <Select label="Job type" value={job.jobType} options={uniqueOptions(options.jobTypeOptions, job.jobType)} onChange={(v) => set("jobType", v)} />
      <Input label="Due date" type="date" value={job.dueDate} onChange={(v) => set("dueDate", v)} required />
      <Select label="Priority" value={job.priority} options={uniqueOptions(options.priorityOptions, job.priority)} onChange={(v) => set("priority", v as Job["priority"])} />
      <Select label="Status" value={job.status} options={uniqueOptions(options.statusOptions, job.status)} onChange={(v) => set("status", v as Job["status"])} />
      <EmployeePicker employees={employees} selectedIds={job.assignedEmployeeIds || []} fullCrew={Boolean(job.fullCrew)} legacyAssignment={initialJob && !initialJob.assignedEmployeeIds?.length ? initialJob.assignedCrew : ""} onChange={(ids, fullCrew) => updateJob((old) => ({ ...old, assignedEmployeeIds: ids, fullCrew }))} />
      <Input label="Home size" value={job.homeSize} onChange={(v) => set("homeSize", v)} />
    </FormSection>
    <FormSection title="Customer & location" description="Contact information for the assigned employees">
      <Input label="Customer name" value={job.customerName} onChange={(v) => set("customerName", v)} required />
      <Input label="Phone" type="tel" value={job.phone} onChange={(v) => set("phone", v)} />
      <Input label="Street address" value={job.address} onChange={(v) => set("address", v)} required wide />
      <Input label="City" value={job.city} onChange={(v) => set("city", v)} required />
    </FormSection>
    <FormSection title="Work details" description="Give the assigned employees everything they need">
      <Textarea label="Scope notes" value={job.scopeNotes} onChange={(v) => set("scopeNotes", v)} wide />
      <Textarea label="Parts needed" value={job.partsNeeded} onChange={(v) => set("partsNeeded", v)} wide />
      <Textarea label="Completion notes" value={job.completionNotes} onChange={(v) => set("completionNotes", v)} wide />
      <Select label="Invoice status" value={job.invoiceStatus} options={["Not started", "Needs more info", "Draft", "Ready", "Sent to Billing", "Sent", "On hold", "Paid"]} onChange={(v) => set("invoiceStatus", v)} />
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 sm:col-span-2">
        <input type="checkbox" className="size-5 accent-forest" checked={Boolean(job.syncToCalendar)} onChange={(e) => set("syncToCalendar", e.target.checked)} />
        <span><span className="block font-bold">Add this job to my Google Calendar</span><span className="block text-xs text-black/45">Off by default. Only enable it for your own real jobs.</span></span>
      </label>
    </FormSection>
    {(savedDraft || draftStatus) && <section className="card border-forest/20 bg-forest/5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-black text-forest">Phone draft protection</h2>
          <p className="mt-1 text-sm font-semibold text-black/55">{savedDraft ? `A saved draft from ${formatDraftTime(savedDraft.savedAt)} is available on this phone.` : draftStatus || "Draft autosave is ready."}</p>
        </div>
        {savedDraft && <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={restoreDraft} className="min-h-11 rounded-xl bg-forest px-4 py-2 font-black text-white">Restore Draft</button>
          <button type="button" onClick={discardDraft} className="min-h-11 rounded-xl border border-black/10 bg-white px-4 py-2 font-black text-ink">Discard</button>
        </div>}
      </div>
    </section>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
    <div className="sticky bottom-20 z-10 flex gap-2 rounded-2xl border border-black/10 bg-white/95 p-3 shadow-xl backdrop-blur lg:bottom-4"><button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button><button disabled={saving || deleting} className="btn-primary flex-[2]">{saving ? "Saving…" : initialJob ? "Save changes" : "Create job"}</button></div>
    {initialJob && <section className="card border-red-200 p-4 sm:p-6"><h2 className="text-lg font-black text-red-700">Delete job</h2><p className="mt-1 text-sm text-black/55">Permanently remove this customer job from the app.</p><button type="button" disabled={saving || deleting} onClick={removeJob} className="mt-4 min-h-12 w-full rounded-xl border-2 border-red-600 bg-white px-4 py-3 font-black text-red-700 disabled:opacity-50">{deleting ? "Deleting…" : "Delete Job"}</button></section>}
  </form>;
}

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="card p-4 sm:p-6"><div className="mb-5"><h2 className="text-lg font-black">{title}</h2><p className="text-sm text-black/45">{description}</p></div><div className="grid gap-4 sm:grid-cols-2">{children}</div></section>; }
function Input({ label, value, onChange, type = "text", required, wide }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; wide?: boolean }) { return <label className={wide ? "sm:col-span-2" : ""}><span className="label">{label}</span><input className="field" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} /></label>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) { return <label><span className="label">{label}</span><select className="field" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function Textarea({ label, value, onChange, wide }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean }) { return <label className={wide ? "sm:col-span-2" : ""}><span className="label">{label}</span><textarea className="field min-h-28 resize-y" value={value} onChange={(e) => onChange(e.target.value)} /></label>; }

function EmployeePicker({ employees, selectedIds, fullCrew, legacyAssignment, onChange }: { employees: Employee[]; selectedIds: string[]; fullCrew: boolean; legacyAssignment?: string; onChange: (ids: string[], fullCrew: boolean) => void }) {
  const active = employees.filter((employee) => employee.active);
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id], false);
  return <div className="sm:col-span-2"><span className="label">Assigned employees</span><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    <button type="button" onClick={() => onChange(active.map((employee) => employee.id), true)} className={`min-h-12 rounded-xl border-2 px-3 py-2 text-sm font-black ${fullCrew ? "border-forest bg-forest text-white" : "border-black/10 bg-white text-ink"}`}>Full Crew</button>
    {active.map((employee) => { const selected = fullCrew || selectedIds.includes(employee.id); return <button key={employee.id} type="button" onClick={() => toggle(employee.id)} className={`min-h-12 rounded-xl border-2 px-3 py-2 text-sm font-black ${selected ? "border-forest bg-forest/10 text-forest" : "border-black/10 bg-white text-ink"}`}>{employee.name}</button>; })}
  </div>{legacyAssignment && legacyAssignment !== "Unassigned" && !selectedIds.length && !fullCrew && <p className="mt-2 text-xs font-semibold text-orange-700">Current legacy assignment: {legacyAssignment}. Choose employees above to replace it.</p>}{!active.length && <p className="mt-2 text-sm text-black/50">No active employees yet. Add them from the Employees tab.</p>}</div>;
}

function uniqueOptions(options: string[], current: string) {
  return Array.from(new Set([current, ...options].filter(Boolean)));
}

function makeChecklistFromLabels(labels: string[], fallback: Job["checklist"]) {
  return labels.length ? labels.map((label, index) => ({ id: `item-${index + 1}`, label, complete: false })) : fallback;
}

function formatDraftTime(value: string) {
  if (!value) return "earlier";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "earlier";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
