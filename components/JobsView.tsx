"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BanknotesIcon, BellAlertIcon, CalendarDaysIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { JobCard } from "./JobCard";
import { priorities, sources, statuses, type Employee, type Job, type JobSource, type JobStatus } from "@/lib/types";
import { authFetch } from "@/lib/client-auth";
import { intakeCompleteness } from "@/lib/job-readiness";
import { closedJobStatuses } from "@/lib/field-activity";

type Preset = { status?: JobStatus | JobStatus[]; source?: JobSource; today?: boolean };
type QuickFilter = "" | "overdue" | "unscheduled" | "parts" | "follow-up" | "billing" | "priority";
type SortMode = "dueDate" | "priority" | "customer" | "status";

export function JobsView({ title, description, preset = {} }: { title: string; description: string; preset?: Preset }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [crew, setCrew] = useState("");
  const [priority, setPriority] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("");
  const [sortMode, setSortMode] = useState<SortMode>("dueDate");
  const [employees, setEmployees] = useState<Employee[]>([]);
  useEffect(() => { authFetch("/api/jobs").then((r) => r.json()).then((data) => setJobs(Array.isArray(data) ? data : [])).finally(() => setLoading(false)); }, []);
  useEffect(() => { fetch("/api/employees").then((r) => r.json()).then(setEmployees).catch(() => setEmployees([])); }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInvoiceFilter(params.get("invoice") || "");
    setSearch(params.get("search") || "");
    setStatus(params.get("status") || "");
  }, []);
  const today = new Date().toLocaleDateString("en-CA");
  const filtered = useMemo(() => jobs.filter((job) => {
    const term = search.toLowerCase();
    const matchesPresetStatus = !preset.status || (Array.isArray(preset.status) ? preset.status.includes(job.status) : job.status === preset.status);
    return matchesPresetStatus && (!preset.source || job.source === preset.source) && (!preset.today || job.dueDate === today) &&
      (!status || job.status === status) && (!source || job.source === source) && (!crew || (crew === "Full Crew" ? job.fullCrew : job.assignedEmployeeIds?.includes(crew) || job.assignedCrew === employees.find((employee) => employee.id === crew)?.name)) && (!priority || job.priority === priority) &&
      (invoiceFilter !== "ready" || ["Ready", "Needs more info", "Draft", "Sent to Billing", "Sent", "On hold"].includes(job.invoiceStatus)) &&
      matchesQuickFilter(job, quickFilter, today) &&
      (!term || [job.jobId, job.customerName, job.address, job.city, job.dealerName, job.factoryWorkOrderNumber].join(" ").toLowerCase().includes(term));
  }).sort((a, b) => compareJobs(a, b, sortMode)), [jobs, search, status, source, crew, priority, preset, today, employees, invoiceFilter, quickFilter, sortMode]);
  const counts = useMemo(() => ({
    overdue: jobs.filter((job) => matchesQuickFilter(job, "overdue", today)).length,
    unscheduled: jobs.filter((job) => matchesQuickFilter(job, "unscheduled", today)).length,
    parts: jobs.filter((job) => matchesQuickFilter(job, "parts", today)).length,
    followUp: jobs.filter((job) => matchesQuickFilter(job, "follow-up", today)).length,
    billing: jobs.filter((job) => matchesQuickFilter(job, "billing", today)).length,
    priority: jobs.filter((job) => matchesQuickFilter(job, "priority", today)).length,
  }), [jobs, today]);
  const intakeNeedsAttention = useMemo(() => jobs.flatMap((job) => {
    if (closedJobStatuses.includes(job.status)) return [];
    const missing = intakeCompleteness(job).core.filter((check) => !check.ok);
    return missing.length ? [{ job, missing }] : [];
  }).sort((a, b) => b.missing.length - a.missing.length), [jobs]);
  const readyToSchedule = useMemo(() => jobs.filter((job) =>
    !closedJobStatuses.includes(job.status) && intakeCompleteness(job).core.every((check) => check.ok) && !job.dueDate
  ), [jobs]);

  function clearFilters() {
    setSearch("");
    setStatus("");
    setSource("");
    setCrew("");
    setPriority("");
    setQuickFilter("");
    setSortMode("dueDate");
  }

  return <>
    <div className="mb-5"><p className="mb-1 text-sm font-extrabold uppercase tracking-widest text-forest">Field operations</p><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm text-black/50 sm:text-base">{description}</p></div>
    <section className="card mb-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-sand p-4">
        <div>
          <h2 className="text-lg font-black">Ready to Schedule</h2>
          <p className="text-sm font-semibold text-black/45">Active jobs with complete intake and no scheduled date.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-forest">{readyToSchedule.length}</span>
      </div>
      <div className="divide-y divide-black/5">
        {readyToSchedule.length ? readyToSchedule.map((job) => <div key={job.jobId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-black">{job.customerName?.trim() || "Customer not recorded"} <span className="text-black/40">— {job.jobId}</span></p>
            <p className="mt-1 text-sm font-semibold text-black/50">{job.jobType?.trim() || "Work type not recorded"} · {job.city?.trim() || "City not recorded"}</p>
            <p className="mt-1 truncate text-xs font-semibold text-black/40">{job.address?.trim() || "Address not recorded"}{job.factoryWorkOrderNumber?.trim() ? ` · Work order ${job.factoryWorkOrderNumber}` : ""}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href={`/jobs/${job.jobId}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-black/10 px-3 py-2 text-sm font-black text-forest">Open job</Link>
            <Link href={`/jobs/${job.jobId}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-forest px-3 py-2 text-sm font-black text-white">Schedule / edit</Link>
          </div>
        </div>) : <div className="p-5 text-center text-sm font-semibold text-black/45">No active jobs are ready to schedule.</div>}
      </div>
    </section>
    <section className="card mb-5 overflow-hidden">
      <div className="bg-ink p-4 text-white">
        <p className="text-xs font-black uppercase tracking-widest text-lime">Job command filters</p>
        <h2 className="mt-1 text-2xl font-black">Find the job that needs you next</h2>
        <p className="mt-1 text-sm text-white/55">One-tap manager filters for overdue work, unscheduled jobs, parts, follow-ups, billing, and high priority work.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6">
        <QuickFilterButton label="Overdue" value="overdue" count={counts.overdue} active={quickFilter === "overdue"} onClick={setQuickFilter} icon={<ExclamationTriangleIcon />} />
        <QuickFilterButton label="Unscheduled" value="unscheduled" count={counts.unscheduled} active={quickFilter === "unscheduled"} onClick={setQuickFilter} icon={<CalendarDaysIcon />} />
        <QuickFilterButton label="Parts" value="parts" count={counts.parts} active={quickFilter === "parts"} onClick={setQuickFilter} icon={<WrenchScrewdriverIcon />} />
        <QuickFilterButton label="Follow-up" value="follow-up" count={counts.followUp} active={quickFilter === "follow-up"} onClick={setQuickFilter} icon={<BellAlertIcon />} />
        <QuickFilterButton label="Billing" value="billing" count={counts.billing} active={quickFilter === "billing"} onClick={setQuickFilter} icon={<BanknotesIcon />} />
        <QuickFilterButton label="High priority" value="priority" count={counts.priority} active={quickFilter === "priority"} onClick={setQuickFilter} icon={<ExclamationTriangleIcon />} />
      </div>
    </section>
    <section className="card mb-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-orange-50 p-4">
        <div>
          <h2 className="text-lg font-black">Intake Needs Attention</h2>
          <p className="text-sm font-semibold text-orange-900/65">Active jobs missing core information before scheduling and dispatch.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-orange-900">{intakeNeedsAttention.length}</span>
      </div>
      <div className="divide-y divide-black/5">
        {intakeNeedsAttention.length ? intakeNeedsAttention.map(({ job, missing }) => <div key={job.jobId} className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-black">{job.customerName?.trim() || "Customer not recorded"} <span className="text-black/40">— {job.jobId}</span></p>
              <p className="mt-1 text-sm font-semibold text-black/50">{job.jobType?.trim() || "Work type not recorded"}</p>
              <p className="mt-2 text-sm font-black text-orange-900">{missing.length} missing</p>
              <p className="mt-1 text-sm font-semibold text-black/55">{missing.map((check) => check.label).join(" · ")}</p>
            </div>
            <Link href={`/jobs/${job.jobId}/edit`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-forest px-4 py-2 text-sm font-black text-white">Edit job</Link>
          </div>
        </div>) : <div className="p-5 text-center text-sm font-semibold text-black/45">All active jobs have core intake information.</div>}
      </div>
    </section>
    <section className="card mb-5 p-3 sm:p-4">
      <div className="relative mb-3"><MagnifyingGlassIcon className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-black/35" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="field !pl-11" placeholder="Search customer, job ID, city..." /></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Filter value={status} onChange={setStatus} label="All statuses" options={[...statuses]} />
        <Filter value={source} onChange={setSource} label="All sources" options={[...sources]} />
        <Filter value={crew} onChange={setCrew} label="All employees" options={["Full Crew", ...employees.filter((employee) => employee.active).map((employee) => employee.id)]} optionLabels={Object.fromEntries(employees.map((employee) => [employee.id, employee.name]))} />
        <Filter value={priority} onChange={setPriority} label="All priorities" options={[...priorities]} />
        <Filter value={sortMode} onChange={(value) => setSortMode(value as SortMode)} label="Sort" options={["dueDate", "priority", "customer", "status"]} optionLabels={{ dueDate: "Sort: due date", priority: "Sort: priority", customer: "Sort: customer", status: "Sort: status" }} />
      </div>
      {(quickFilter || search || status || source || crew || priority || sortMode !== "dueDate") && <div className="mt-3 flex flex-wrap items-center gap-2">
        {quickFilter && <ActiveChip label={`Quick: ${quickFilterLabel(quickFilter)}`} onClear={() => setQuickFilter("")} />}
        {search && <ActiveChip label={`Search: ${search}`} onClear={() => setSearch("")} />}
        {status && <ActiveChip label={`Status: ${status}`} onClear={() => setStatus("")} />}
        {source && <ActiveChip label={`Source: ${source}`} onClear={() => setSource("")} />}
        {crew && <ActiveChip label={`Employee: ${crew === "Full Crew" ? "Full Crew" : employees.find((employee) => employee.id === crew)?.name || crew}`} onClear={() => setCrew("")} />}
        {priority && <ActiveChip label={`Priority: ${priority}`} onClear={() => setPriority("")} />}
        {sortMode !== "dueDate" && <ActiveChip label={`Sorted by ${sortMode}`} onClear={() => setSortMode("dueDate")} />}
      </div>}
    </section>
    <div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold text-black/45">{loading ? "Loading jobs…" : `${filtered.length} ${filtered.length === 1 ? "job" : "jobs"}`}</p><button type="button" onClick={clearFilters} className="text-sm font-black text-forest">Clear</button></div>
    {!loading && filtered.length === 0 ? <div className="card py-16 text-center"><p className="font-extrabold">No jobs match these filters</p><button onClick={clearFilters} className="mt-2 text-sm font-bold text-forest">Clear filters</button></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((job) => <JobCard key={job.jobId} job={job} />)}</div>}
  </>;
}

function QuickFilterButton({ label, value, count, active, onClick, icon }: { label: string; value: QuickFilter; count: number; active: boolean; onClick: (value: QuickFilter) => void; icon: React.ReactNode }) {
  return <button type="button" onClick={() => onClick(active ? "" : value)} className={`min-h-24 rounded-2xl border p-3 text-left transition active:scale-[.98] ${active ? "border-forest bg-forest text-white" : "border-black/10 bg-sand text-ink"}`}>
    <div className={`mb-2 grid size-9 place-items-center rounded-xl ${active ? "bg-white/15" : "bg-white text-forest"} [&>svg]:size-5`}>{icon}</div>
    <p className="text-2xl font-black">{count}</p>
    <p className={`text-xs font-black uppercase tracking-wide ${active ? "text-white/70" : "text-black/45"}`}>{label}</p>
  </button>;
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return <button type="button" onClick={onClear} className="rounded-full bg-forest/10 px-3 py-1.5 text-xs font-black text-forest">{label} ×</button>;
}

function Filter({ value, onChange, label, options, optionLabels = {} }: { value: string; onChange: (value: string) => void; label: string; options: string[]; optionLabels?: Record<string, string> }) {
  return <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="field !py-2 text-sm font-semibold"><option value="">{label}</option>{options.map((option) => <option key={option} value={option}>{optionLabels[option] || option}</option>)}</select>;
}

function matchesQuickFilter(job: Job, quickFilter: QuickFilter, today: string) {
  if (!quickFilter) return true;
  if (quickFilter === "overdue") return isOpen(job) && Boolean(job.dueDate) && job.dueDate < today;
  if (quickFilter === "unscheduled") return isOpen(job) && !job.dueDate;
  if (quickFilter === "parts") return job.status === "Waiting on Parts" || Boolean(job.partsNeeded?.trim()) || (job.partsItems || []).some((part) => ["Needed", "Ordered", "Picked up"].includes(part.status));
  if (quickFilter === "follow-up") return (job.activityLog || []).some((entry) => entry.notify && !entry.resolvedAt);
  if (quickFilter === "billing") return ["Complete", "Billed"].includes(job.status) && !["Paid", "Sent", "Sent to Billing"].includes(job.invoiceStatus || "");
  if (quickFilter === "priority") return job.priority === "High" || job.priority === "Urgent";
  return true;
}

function compareJobs(a: Job, b: Job, sortMode: SortMode) {
  if (sortMode === "customer") return a.customerName.localeCompare(b.customerName);
  if (sortMode === "status") return a.status.localeCompare(b.status) || priorityRank(b.priority) - priorityRank(a.priority);
  if (sortMode === "priority") return priorityRank(b.priority) - priorityRank(a.priority) || dueRank(a).localeCompare(dueRank(b));
  return dueRank(a).localeCompare(dueRank(b)) || priorityRank(b.priority) - priorityRank(a.priority);
}

function dueRank(job: Job) {
  return job.dueDate || "9999-99-99";
}

function priorityRank(priority: Job["priority"]) {
  return { Urgent: 4, High: 3, Normal: 2, Low: 1 }[priority] || 0;
}

function isOpen(job: Job) {
  return !["Complete", "Billed", "Paid"].includes(job.status);
}

function quickFilterLabel(value: QuickFilter) {
  return value === "follow-up" ? "Follow-up" : value === "priority" ? "High priority" : value ? value[0].toUpperCase() + value.slice(1) : "";
}
