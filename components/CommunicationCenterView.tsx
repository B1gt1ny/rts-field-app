"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowTopRightOnSquareIcon, BellAlertIcon, CalendarDaysIcon, ChatBubbleLeftRightIcon, ClipboardDocumentListIcon, FunnelIcon, PhoneIcon } from "@heroicons/react/24/outline";
import { authFetch } from "@/lib/client-auth";
import type { Job, JobActivity } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

type CommunicationRow = {
  job: Job;
  entry: JobActivity;
};

const typeOptions: Array<JobActivity["type"] | "All"> = ["All", "Customer", "Source", "Calendar", "CompanyCam", "Paperwork", "Receipt", "Invoice", "Parts", "Time", "Signoff", "Status", "Note"];
const audienceOptions: Array<NonNullable<JobActivity["audience"]> | "All"> = ["All", "Admin", "Manager", "Employee"];
const entryTypeOptions: JobActivity["type"][] = ["Customer", "Source", "Invoice", "Parts", "Paperwork", "Calendar", "CompanyCam", "Status", "Note"];
const quickTemplates: Array<{ label: string; type: JobActivity["type"]; message: string; audience: NonNullable<JobActivity["audience"]>; notify?: boolean }> = [
  { label: "Customer called", type: "Customer", message: "Customer called. Follow-up notes:", audience: "Manager" },
  { label: "Left voicemail", type: "Customer", message: "Left customer voicemail.", audience: "Manager", notify: true },
  { label: "Text sent", type: "Customer", message: "Text sent to customer.", audience: "All" },
  { label: "Dealer/factory notified", type: "Source", message: "Dealer/factory notified.", audience: "Admin" },
  { label: "Crew update", type: "Note", message: "Crew update:", audience: "All" },
  { label: "Schedule update", type: "Calendar", message: "Schedule update:", audience: "All", notify: true },
  { label: "Billing question", type: "Invoice", message: "Billing question:", audience: "Admin", notify: true },
  { label: "Parts follow-up", type: "Parts", message: "Parts follow-up needed:", audience: "Manager", notify: true },
];

export function CommunicationCenterView({ jobs }: { jobs: Job[] }) {
  const searchParams = useSearchParams();
  const [jobList, setJobList] = useState(jobs);
  const [selectedJobId, setSelectedJobId] = useState(jobs.find((job) => job.status !== "Paid")?.jobId || jobs[0]?.jobId || "");
  const [entryType, setEntryType] = useState<JobActivity["type"]>("Customer");
  const [entryAudience, setEntryAudience] = useState<NonNullable<JobActivity["audience"]>>("All");
  const [entryMessage, setEntryMessage] = useState("");
  const [entryNotify, setEntryNotify] = useState(false);
  const [entryDueDate, setEntryDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [type, setType] = useState<JobActivity["type"] | "All">("All");
  const [audience, setAudience] = useState<NonNullable<JobActivity["audience"]> | "All">("All");
  const [followUpOnly, setFollowUpOnly] = useState(searchParams.get("filter") === "follow-up");
  const [search, setSearch] = useState("");
  const [copiedRowKey, setCopiedRowKey] = useState("");

  const activeJobs = useMemo(() => jobList.filter((job) => !["Paid"].includes(job.status)).sort((a, b) => `${a.customerName} ${a.jobId}`.localeCompare(`${b.customerName} ${b.jobId}`)), [jobList]);
  const jobOptions = activeJobs.length ? activeJobs : jobList;
  const selectedJob = jobList.find((job) => job.jobId === selectedJobId) || jobOptions[0];
  const rows = useMemo(() => jobList.flatMap((job) => (job.activityLog || []).map((entry) => ({ job, entry }))).sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt)), [jobList]);
  const filtered = rows.filter(({ job, entry }) => {
    const term = search.trim().toLowerCase();
    return (type === "All" || entry.type === type) &&
      (audience === "All" || (entry.audience || "All") === audience) &&
      (!followUpOnly || Boolean(entry.notify && !entry.resolvedAt)) &&
      (!term || [job.jobId, job.customerName, job.city, job.source, entry.message, entry.createdBy, entry.type, entry.audience].join(" ").toLowerCase().includes(term));
  });

  const today = new Date().toLocaleDateString("en-CA");
  const openFollowUpRows = rows.filter((row) => row.entry.notify && !row.entry.resolvedAt);
  const followUps = openFollowUpRows.length;
  const overdueFollowUps = openFollowUpRows.filter((row) => row.entry.followUpDueDate && row.entry.followUpDueDate < today).length;
  const dueTodayFollowUps = openFollowUpRows.filter((row) => row.entry.followUpDueDate === today).length;
  const upcomingFollowUps = openFollowUpRows.filter((row) => row.entry.followUpDueDate && row.entry.followUpDueDate > today).length;
  const resolvedFollowUps = rows.filter((row) => row.entry.resolvedAt).length;
  const customerTouches = rows.filter((row) => row.entry.type === "Customer" || /called|text|voicemail|contacted/i.test(row.entry.message)).length;
  const sourceTouches = rows.filter((row) => row.entry.type === "Source" || /dealer|factory|source/i.test(row.entry.message)).length;
  const crewUpdates = rows.filter((row) => row.entry.audience === "Employee" || row.entry.audience === "All" || /crew|field|arrived|started|complete/i.test(row.entry.message)).length;

  function applyTemplate(template: typeof quickTemplates[number]) {
    setEntryType(template.type);
    setEntryAudience(template.audience);
    setEntryMessage(template.message);
    setEntryNotify(Boolean(template.notify));
    setEntryDueDate(template.notify ? today : "");
    setFormMessage("");
  }

  async function saveCommunication(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedJob || !entryMessage.trim()) return;
    setSaving(true);
    setFormMessage("");
    const entry: JobActivity = {
      id: `activity-${Date.now()}`,
      type: entryType,
      message: entryMessage.trim(),
      createdAt: new Date().toISOString(),
      createdBy: "Manager",
      audience: entryAudience,
      notify: entryNotify,
      followUpDueDate: entryNotify ? entryDueDate || today : undefined,
    };
    const nextActivity = [entry, ...(selectedJob.activityLog || [])].slice(0, 50);
    try {
      const response = await authFetch(`/api/jobs/${selectedJob.jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityLog: nextActivity } satisfies Partial<Job>),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || "Communication could not be saved.");
      setJobList((old) => old.map((job) => job.jobId === selectedJob.jobId ? { ...job, ...saved } : job));
      setEntryMessage("");
      setEntryNotify(false);
      setEntryDueDate("");
      setFormMessage("Communication saved.");
    } catch (caught) {
      setFormMessage(caught instanceof Error ? caught.message : "Communication could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function setFollowUpResolved(row: CommunicationRow, resolved: boolean) {
    const nextActivity = (row.job.activityLog || []).map((entry) => entry.id === row.entry.id ? {
      ...entry,
      notify: resolved ? false : true,
      resolvedAt: resolved ? new Date().toISOString() : undefined,
      resolvedBy: resolved ? "Manager" : undefined,
      followUpDueDate: resolved ? entry.followUpDueDate : entry.followUpDueDate || today,
    } : entry);
    setFormMessage("");
    try {
      const response = await authFetch(`/api/jobs/${row.job.jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityLog: nextActivity } satisfies Partial<Job>),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || "Follow-up could not be updated.");
      setJobList((old) => old.map((job) => job.jobId === row.job.jobId ? { ...job, ...saved } : job));
      setFormMessage(resolved ? "Follow-up resolved." : "Follow-up reopened.");
    } catch (caught) {
      setFormMessage(caught instanceof Error ? caught.message : "Follow-up could not be updated.");
    }
  }

  async function setFollowUpDueDate(row: CommunicationRow, dueDate: string) {
    const nextActivity = (row.job.activityLog || []).map((entry) => entry.id === row.entry.id ? {
      ...entry,
      notify: true,
      resolvedAt: undefined,
      resolvedBy: undefined,
      followUpDueDate: dueDate,
    } : entry);
    setFormMessage("");
    try {
      const response = await authFetch(`/api/jobs/${row.job.jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityLog: nextActivity } satisfies Partial<Job>),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || "Follow-up date could not be updated.");
      setJobList((old) => old.map((job) => job.jobId === row.job.jobId ? { ...job, ...saved } : job));
      setFormMessage(dueDate ? `Follow-up moved to ${formatReminderDate(dueDate)}.` : "Follow-up marked unscheduled.");
    } catch (caught) {
      setFormMessage(caught instanceof Error ? caught.message : "Follow-up date could not be updated.");
    }
  }

  async function copyCommunicationBrief(row: CommunicationRow) {
    const key = `${row.job.jobId}-${row.entry.id}`;
    try {
      await navigator.clipboard.writeText(buildCommunicationBrief(row));
      setCopiedRowKey(key);
      setFormMessage("Communication brief copied.");
      window.setTimeout(() => setCopiedRowKey(""), 2200);
    } catch {
      setFormMessage("Copy did not work on this device. Open the job and select the text manually.");
    }
  }

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><ChatBubbleLeftRightIcon className="size-7" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-lime">Communication command</p>
            <h1 className="text-3xl font-black">Messages & follow-ups</h1>
            <p className="mt-1 text-sm text-white/55">Customer calls, dealer/factory notices, crew notes, billing questions, and follow-up reminders in one feed.</p>
          </div>
        </div>
        <a href="/api/reports/export?type=communications" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime px-4 py-3 font-black text-ink print:hidden"><ClipboardDocumentListIcon className="size-5" />Export CSV</a>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <HeroMetric label="Open follow-ups" value={followUps} />
        <HeroMetric label="Overdue" value={overdueFollowUps} />
        <HeroMetric label="Due today" value={dueTodayFollowUps} />
        <HeroMetric label="Customer touches" value={customerTouches} />
        <HeroMetric label="Source touches" value={sourceTouches} />
        <HeroMetric label="Crew updates" value={crewUpdates} />
      </div>
    </section>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <CommandLane label="Follow-up command" value={followUps} detail="Only open flagged items" icon={<BellAlertIcon />} onClick={() => { setFollowUpOnly(true); setType("All"); setAudience("All"); }} />
      <CommandLane label="Customer contact" value={customerTouches} detail="Calls, texts, voicemails" icon={<PhoneIcon />} onClick={() => { setFollowUpOnly(false); setType("Customer"); setAudience("All"); }} />
      <CommandLane label="Dealer/factory" value={sourceTouches} detail="Source notifications" icon={<ClipboardDocumentListIcon />} onClick={() => { setFollowUpOnly(false); setType("Source"); setAudience("All"); }} />
      <CommandLane label="Schedule notes" value={rows.filter((row) => row.entry.type === "Calendar").length} detail="Calendar/schedule updates" icon={<CalendarDaysIcon />} onClick={() => { setFollowUpOnly(false); setType("Calendar"); setAudience("All"); }} />
    </section>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
      <Metric label="Upcoming" value={upcomingFollowUps} tone="bg-blue-100" icon={<BellAlertIcon />} />
      <Metric label="Resolved" value={resolvedFollowUps} tone="bg-emerald-100" icon={<ClipboardDocumentListIcon />} />
      <Metric label="Admin notes" value={rows.filter((row) => row.entry.audience === "Admin").length} tone="bg-sand" icon={<ClipboardDocumentListIcon />} />
      <Metric label="Employee-visible" value={rows.filter((row) => row.entry.audience === "Employee" || row.entry.audience === "All").length} tone="bg-lime" icon={<ChatBubbleLeftRightIcon />} />
    </section>

    <section className="card p-4 sm:p-5 print:hidden">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink"><ChatBubbleLeftRightIcon className="size-5" /></span>
        <div>
          <h2 className="text-lg font-black">Add communication</h2>
          <p className="text-sm text-black/50">Log a customer call, source update, billing question, or field note without opening the job first.</p>
        </div>
      </div>
      <form onSubmit={saveCommunication} className="grid gap-3">
        <div className="grid gap-2 lg:grid-cols-[1fr_.35fr_.35fr_.3fr]">
          <label><span className="label">Job</span><select value={selectedJob?.jobId || ""} onChange={(event) => setSelectedJobId(event.target.value)} className="field">
            {jobOptions.map((job) => <option key={job.jobId} value={job.jobId}>{job.jobId} · {job.customerName} · {job.city}</option>)}
          </select></label>
          <label><span className="label">Type</span><select value={entryType} onChange={(event) => setEntryType(event.target.value as JobActivity["type"])} className="field">
            {entryTypeOptions.map((option) => <option key={option}>{option}</option>)}
          </select></label>
          <label><span className="label">Audience</span><select value={entryAudience} onChange={(event) => setEntryAudience(event.target.value as NonNullable<JobActivity["audience"]>)} className="field">
            {audienceOptions.filter((option) => option !== "All").map((option) => <option key={option}>{option}</option>)}
            <option>All</option>
          </select></label>
          <label><span className="label">Reminder date</span><input type="date" value={entryDueDate} onChange={(event) => setEntryDueDate(event.target.value)} className="field" disabled={!entryNotify} /></label>
        </div>
        <textarea value={entryMessage} onChange={(event) => setEntryMessage(event.target.value)} className="field min-h-28 resize-y" placeholder="Example: Customer called asking for ETA. Ronnie to call back after crew checks parts." />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-black/10 bg-sand px-3 py-2 text-sm font-black"><input type="checkbox" checked={entryNotify} onChange={(event) => { setEntryNotify(event.target.checked); if (event.target.checked && !entryDueDate) setEntryDueDate(today); }} className="size-4 accent-forest" /> Flag for follow-up</label>
          <button disabled={saving || !selectedJob || !entryMessage.trim()} className="min-h-12 rounded-xl bg-forest px-5 py-3 font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save Communication"}</button>
        </div>
      </form>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {quickTemplates.map((template) => <button key={template.label} type="button" onClick={() => applyTemplate(template)} className="min-h-11 rounded-xl border border-black/10 bg-sand px-3 py-2 text-xs font-black text-ink">{template.label}</button>)}
      </div>
      {formMessage && <p className={`mt-3 rounded-xl p-3 text-sm font-bold ${formMessage.includes("could not") ? "bg-red-50 text-red-700" : "bg-forest/5 text-forest"}`}>{formMessage}</p>}
    </section>

    <section className="card p-3 sm:p-4 print:hidden">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-black/45"><FunnelIcon className="size-5" />Filter communication</div>
      <div className="grid gap-2 lg:grid-cols-[1fr_.35fr_.35fr_auto]">
        <input value={search} onChange={(event) => setSearch(event.target.value)} className="field !min-h-11 !py-2 text-sm" placeholder="Search job, customer, city, note, employee..." />
        <select value={type} onChange={(event) => setType(event.target.value as JobActivity["type"] | "All")} className="field !min-h-11 !py-2 text-sm font-bold">
          {typeOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
        <select value={audience} onChange={(event) => setAudience(event.target.value as NonNullable<JobActivity["audience"]> | "All")} className="field !min-h-11 !py-2 text-sm font-bold">
          {audienceOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-black/10 bg-sand px-3 py-2 text-sm font-black">
          <input type="checkbox" checked={followUpOnly} onChange={(event) => setFollowUpOnly(event.target.checked)} className="size-4 accent-forest" />
          Follow-up only
        </label>
      </div>
    </section>

    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-sand p-4">
        <div>
          <h2 className="text-lg font-black">Communication log</h2>
          <p className="text-sm font-semibold text-black/45">{filtered.length} of {rows.length} updates shown</p>
        </div>
        <Link href="/jobs" className="text-sm font-black text-forest print:hidden">All jobs</Link>
      </div>
      <div className="divide-y divide-black/5">
        {filtered.length ? filtered.slice(0, 80).map((row) => {
          const { job, entry } = row;
          return <div key={`${job.jobId}-${entry.id}`} className="p-4 hover:bg-black/[.02]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/jobs/${job.jobId}#operations`} className="text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.customerName} · {job.city}</Link>
                {entry.notify && !entry.resolvedAt && <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-orange-800">Follow-up</span>}
                {entry.notify && !entry.resolvedAt && entry.followUpDueDate && <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${reminderTone(entry.followUpDueDate, today)}`}>{reminderLabel(entry.followUpDueDate, today)}</span>}
                {entry.resolvedAt && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-800">Resolved</span>}
              </div>
              <h3 className="mt-1 font-black">{entry.message}</h3>
              <p className="mt-1 text-xs font-semibold text-black/45">{entry.type} · {entry.createdBy} · {new Date(entry.createdAt).toLocaleString()} · Audience: {entry.audience || "All"}</p>
              {entry.notify && !entry.resolvedAt && entry.followUpDueDate && <p className="mt-1 text-xs font-semibold text-orange-700">Reminder: {formatReminderDate(entry.followUpDueDate)}</p>}
              {entry.resolvedAt && <p className="mt-1 text-xs font-semibold text-emerald-700">Resolved by {entry.resolvedBy || "Manager"} · {new Date(entry.resolvedAt).toLocaleString()}</p>}
            </div>
            <StatusBadge status={job.status} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 print:hidden">
            <a href={`tel:${job.phone}`} className={`min-h-10 rounded-xl px-3 py-2 text-xs font-black ${job.phone ? "bg-forest text-white" : "pointer-events-none bg-black/5 text-black/25"}`}>Call</a>
            <a href={`sms:${job.phone}?&body=${encodeURIComponent(buildCustomerText(job))}`} className={`min-h-10 rounded-xl px-3 py-2 text-xs font-black ${job.phone ? "border border-black/10 bg-white text-ink" : "pointer-events-none bg-black/5 text-black/25"}`}>Text</a>
            <Link href={`/jobs/${job.jobId}#operations`} className="min-h-10 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-black text-ink">Open Job</Link>
            <Link href={`/jobs/${job.jobId}#scheduling`} className="min-h-10 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-black text-ink">Schedule</Link>
            <Link href={`/jobs/${job.jobId}/packet`} className="min-h-10 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-black text-ink">Packet</Link>
            <a href={`https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city}`)}`} target="_blank" className="min-h-10 rounded-xl bg-ink px-3 py-2 text-xs font-black text-white">Map <ArrowTopRightOnSquareIcon className="inline size-3" /></a>
            <button type="button" onClick={() => copyCommunicationBrief(row)} className="min-h-10 rounded-xl border border-black/10 bg-lime px-3 py-2 text-xs font-black text-ink">{copiedRowKey === `${job.jobId}-${entry.id}` ? "Copied" : "Copy Brief"}</button>
            {entry.notify && !entry.resolvedAt && <button type="button" onClick={() => setFollowUpResolved(row, true)} className="min-h-10 rounded-xl bg-forest px-3 py-2 text-xs font-black text-white">Resolve Follow-up</button>}
            {entry.resolvedAt && <button type="button" onClick={() => setFollowUpResolved(row, false)} className="min-h-10 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-black text-ink">Reopen</button>}
          </div>
          {entry.notify && !entry.resolvedAt && <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-sand p-2 sm:grid-cols-4 print:hidden">
            <button type="button" onClick={() => setFollowUpDueDate(row, today)} className="min-h-10 rounded-xl bg-white px-3 py-2 text-xs font-black text-ink">Due today</button>
            <button type="button" onClick={() => setFollowUpDueDate(row, addDays(today, 1))} className="min-h-10 rounded-xl bg-white px-3 py-2 text-xs font-black text-ink">Tomorrow</button>
            <button type="button" onClick={() => setFollowUpDueDate(row, addDays(today, 7))} className="min-h-10 rounded-xl bg-white px-3 py-2 text-xs font-black text-ink">Next week</button>
            <button type="button" onClick={() => setFollowUpDueDate(row, "")} className="min-h-10 rounded-xl bg-white px-3 py-2 text-xs font-black text-ink">No date</button>
          </div>}
        </div>;
        }) : <p className="p-8 text-center text-sm font-semibold text-black/35">No communication entries match this filter.</p>}
      </div>
    </section>
  </div>;
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/10 p-4">
    <p className="text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-white/55">{label}</p>
  </div>;
}

function CommandLane({ label, value, detail, icon, onClick }: { label: string; value: number; detail: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="card p-4 text-left active:scale-[.99]">
    <div className="mb-3 grid size-10 place-items-center rounded-xl bg-lime text-ink [&>svg]:size-5">{icon}</div>
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="font-black">{label}</h2>
        <p className="mt-1 text-xs font-semibold text-black/45">{detail}</p>
      </div>
      <p className="text-3xl font-black">{value}</p>
    </div>
  </button>;
}

function Metric({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: React.ReactNode }) {
  return <div className="card p-4">
    <div className={`mb-3 grid size-10 place-items-center rounded-xl ${tone} [&>svg]:size-5`}>{icon}</div>
    <p className="text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-black/45">{label}</p>
  </div>;
}

function reminderLabel(value: string, today: string) {
  if (value < today) return "Overdue";
  if (value === today) return "Due today";
  return "Upcoming";
}

function reminderTone(value: string, today: string) {
  if (value < today) return "bg-red-100 text-red-800";
  if (value === today) return "bg-amber-100 text-amber-800";
  return "bg-blue-100 text-blue-800";
}

function formatReminderDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function buildCustomerText(job: Job) {
  return `Company update for ${job.customerName}: your ${job.jobType || "service"} job is scheduled for ${job.dueDate || "TBD"}. Address: ${job.address}, ${job.city}. Reply here if anything changes.`;
}

function buildCommunicationBrief({ job, entry }: CommunicationRow) {
  return [
    `Communication follow-up — ${job.jobId}`,
    `${job.customerName} · ${job.phone || "No phone"}`,
    `${job.address}, ${job.city}`,
    `Status: ${job.status} · Priority: ${job.priority} · Source: ${job.source}`,
    `Entry: ${entry.type} · Audience: ${entry.audience || "All"}`,
    `Created: ${new Date(entry.createdAt).toLocaleString()} by ${entry.createdBy}`,
    entry.followUpDueDate ? `Follow-up due: ${formatReminderDate(entry.followUpDueDate)}` : "Follow-up due: Not set",
    "",
    entry.message,
  ].join("\n");
}

function addDays(today: string, days: number) {
  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA");
}
