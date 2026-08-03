"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUturnLeftIcon, CheckCircleIcon, ClipboardDocumentCheckIcon, ExclamationTriangleIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { billingBlockers, closeoutChecks, dispatchBlockers, dispatchChecks, dispatchReadinessScore, isReadyForDispatch, readinessScore } from "@/lib/job-readiness";
import type { Job, JobActivity } from "@/lib/types";
import { PriorityBadge, StatusBadge } from "./StatusBadge";
import { authFetch } from "@/lib/client-auth";

const activeStatuses = ["New", "Scheduled", "In Progress", "Waiting on Parts", "Needs Inspection"];

export function ReadyCheckView({ jobs: initialJobs }: { jobs: Job[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [savingJobId, setSavingJobId] = useState("");
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({});
  const today = new Date().toLocaleDateString("en-CA");
  const activeJobs = jobs
    .filter((job) => activeStatuses.includes(job.status))
    .sort((a, b) => dispatchReadinessScore(a) - dispatchReadinessScore(b) || (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"));
  const inspectionJobs = useMemo(() => jobs.filter((job) => job.status === "Needs Inspection").sort((a, b) => readinessScore(a) - readinessScore(b) || (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99")), [jobs]);
  const ready = activeJobs.filter(isReadyForDispatch);
  const blocked = activeJobs.filter((job) => !isReadyForDispatch(job));
  const urgentBlocked = blocked.filter((job) => job.priority === "Urgent" || job.priority === "High");

  async function updateInspectionJob(job: Job, patch: Partial<Job>) {
    setSavingJobId(job.jobId);
    try {
      const response = await authFetch(`/api/jobs/${job.jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const saved = await response.json();
      if (response.ok) setJobs((old) => old.map((item) => item.jobId === job.jobId ? { ...item, ...saved } : item));
    } finally {
      setSavingJobId("");
    }
  }

  async function approveComplete(job: Job) {
    const blockers = billingBlockers(job);
    const checklist = (job.checklist || []).map((item) => {
      const closeoutLabels = ["Work completed", "After photos taken", "Completion notes added", "Dealer/factory notified"];
      return closeoutLabels.includes(item.label) ? { ...item, complete: true } : item;
    });
    await updateInspectionJob(job, {
      status: "Complete",
      invoiceStatus: blockers.length ? job.invoiceStatus : "Ready",
      checklist,
      activityLog: [activity("Manager approved inspection and marked job complete.", "Status", "Admin"), ...(job.activityLog || [])].slice(0, 50),
    });
  }

  async function sendBack(job: Job) {
    const note = (returnNotes[job.jobId] || "Needs field corrections before manager approval.").trim();
    await updateInspectionJob(job, {
      status: "In Progress",
      activityLog: [activity(`Manager sent job back to field: ${note}`, "Status", "All", true, today), ...(job.activityLog || [])].slice(0, 50),
    });
    setReturnNotes((old) => ({ ...old, [job.jobId]: "" }));
  }

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><ClipboardDocumentCheckIcon className="size-7" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-lime">Manager prep</p>
          <h1 className="text-3xl font-black">Ready Check</h1>
          <p className="mt-1 text-sm text-white/55">See what can be sent to the field and what needs fixed before dispatch.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Active jobs" value={activeJobs.length} />
        <Metric label="Ready" value={ready.length} />
        <Metric label="Inspection" value={inspectionJobs.length} />
        <Metric label="Urgent blocked" value={urgentBlocked.length} />
      </div>
    </section>

    <section className="card overflow-hidden">
      <div className="bg-ink p-4 text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-lime">Manager inspection queue</p>
            <h2 className="mt-1 text-2xl font-black">Jobs ready for approval</h2>
            <p className="mt-1 text-sm text-white/55">Crew moved these to Needs Inspection. Approve complete or send back with a clear reason.</p>
          </div>
          <Link href="/jobs?status=Needs%20Inspection" className="min-h-11 rounded-xl bg-lime px-4 py-2 text-center text-sm font-black text-ink">Open list</Link>
        </div>
      </div>
      <div className="grid gap-3 p-3 lg:grid-cols-2">
        {inspectionJobs.length ? inspectionJobs.map((job) => <InspectionJobCard key={job.jobId} job={job} saving={savingJobId === job.jobId} returnNote={returnNotes[job.jobId] || ""} onReturnNote={(value) => setReturnNotes((old) => ({ ...old, [job.jobId]: value }))} onApprove={() => approveComplete(job)} onSendBack={() => sendBack(job)} />) : <p className="p-8 text-center text-sm font-semibold text-black/35 lg:col-span-2">No jobs are waiting on manager inspection.</p>}
      </div>
    </section>

    <section className="grid gap-3 lg:grid-cols-[1.35fr_.65fr]">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 bg-sand p-4">
          <div>
            <h2 className="text-lg font-black">Fix before dispatch</h2>
            <p className="text-sm font-semibold text-black/45">Lowest readiness jobs are shown first.</p>
          </div>
          <Link href="/dispatch" className="text-sm font-black text-forest">Dispatch handoff</Link>
        </div>
        <div className="divide-y divide-black/5">
          {blocked.length ? blocked.map((job) => <ReadyJobRow key={job.jobId} job={job} />) : <p className="p-8 text-center text-sm font-semibold text-black/35">All active jobs are field-ready.</p>}
        </div>
      </div>

      <div className="space-y-3">
        <section className="card overflow-hidden">
          <div className="bg-sand p-4">
            <h2 className="font-black">Ready to send</h2>
            <p className="text-sm font-semibold text-black/45">These have the basic dispatch pieces in place.</p>
          </div>
          <div className="divide-y divide-black/5">
            {ready.length ? ready.slice(0, 8).map((job) => <Link key={job.jobId} href={`/jobs/${job.jobId}`} className="flex items-center justify-between gap-3 p-4 hover:bg-black/[.02]">
              <div>
                <p className="font-black">{job.customerName}</p>
                <p className="text-xs font-semibold text-black/45">{job.jobId} · {job.city || "No city"} · {job.dueDate || "No date"}</p>
              </div>
              <CheckCircleIcon className="size-6 shrink-0 text-forest" />
            </Link>) : <p className="p-6 text-center text-sm font-semibold text-black/35">No fully ready jobs yet.</p>}
          </div>
        </section>
        <section className="card p-4">
          <div className="mb-3 grid size-10 place-items-center rounded-xl bg-orange-100 text-orange-900"><ExclamationTriangleIcon className="size-5" /></div>
          <h2 className="font-black">What this checks</h2>
          <p className="mt-1 text-sm font-semibold text-black/50">Schedule, assignment, scope, paperwork/work order, parts blockers, and customer contact/address.</p>
        </section>
      </div>
    </section>
  </div>;
}

function InspectionJobCard({ job, saving, returnNote, onReturnNote, onApprove, onSendBack }: { job: Job; saving: boolean; returnNote: string; onReturnNote: (value: string) => void; onApprove: () => void; onSendBack: () => void }) {
  const score = readinessScore(job);
  const checks = closeoutChecks(job);
  const blockers = billingBlockers(job);
  return <div className="rounded-2xl border border-black/10 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.city || "No city"} · {job.assignedCrew || "Unassigned"}</p>
        <h3 className="mt-1 truncate text-xl font-black">{job.customerName}</h3>
        <p className="mt-1 text-sm font-semibold text-black/50">{job.jobType || "Job"} · {job.dueDate || "No date"}</p>
      </div>
      <StatusBadge status={job.status} />
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2">
      <InspectionMetric label="Ready" value={`${score}%`} />
      <InspectionMetric label="Blockers" value={blockers.length} />
      <InspectionMetric label="Photos" value={(job.afterPhotos || []).length} />
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {checks.slice(0, 6).map((check) => <div key={check.label} className={`rounded-xl p-3 ${check.ok ? "bg-forest/5" : "bg-orange-50"}`}>
        <p className={`text-[11px] font-black uppercase tracking-wide ${check.ok ? "text-forest" : "text-orange-800"}`}>{check.ok ? "Ready" : "Review"}</p>
        <p className="font-black">{check.label}</p>
        <p className="text-xs font-semibold text-black/45">{check.detail}</p>
      </div>)}
    </div>
    {blockers.length > 0 && <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">Billing blockers: {blockers.map((blocker) => blocker.label).join(", ")}</p>}
    <label className="mt-3 block"><span className="label">Send-back note</span><textarea className="field min-h-20 resize-y" value={returnNote} onChange={(event) => onReturnNote(event.target.value)} placeholder="Example: Need after photo of back side, customer signature missing, parts still open..." /></label>
    <div className="mt-3 grid gap-2 sm:grid-cols-4">
      <Link href={`/jobs/${job.jobId}`} className="min-h-11 rounded-xl bg-sand px-3 py-2 text-center text-sm font-black text-ink">Profile</Link>
      <Link href={`/jobs/${job.jobId}/packet`} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm font-black text-ink">Packet</Link>
      <button type="button" disabled={saving} onClick={onSendBack} className="min-h-11 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-black text-orange-900 disabled:opacity-50"><ArrowUturnLeftIcon className="mr-1 inline size-4" />Send Back</button>
      <button type="button" disabled={saving || blockers.length > 0} onClick={onApprove} className="min-h-11 rounded-xl bg-forest px-3 py-2 text-sm font-black text-white disabled:opacity-50"><CheckCircleIcon className="mr-1 inline size-4" />Approve</button>
    </div>
  </div>;
}

function InspectionMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-sand p-3 text-center">
    <p className="text-2xl font-black">{value}</p>
    <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-black/35">{label}</p>
  </div>;
}

function activity(message: string, type: JobActivity["type"], audience: JobActivity["audience"], notify = false, followUpDueDate?: string): JobActivity {
  return {
    id: `activity-${Date.now()}`,
    type,
    message,
    createdAt: new Date().toISOString(),
    createdBy: "Manager",
    audience,
    notify,
    followUpDueDate,
  };
}

function ReadyJobRow({ job }: { job: Job }) {
  const score = dispatchReadinessScore(job);
  const blockers = dispatchBlockers(job);
  const checks = dispatchChecks(job);
  return <div className="p-4 hover:bg-black/[.02]">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-black uppercase tracking-wide text-forest">{job.jobId} · {job.customerName} · {job.city || "No city"}</p>
        <h3 className="mt-1 font-black">{score}% ready for dispatch</h3>
        <p className="mt-1 text-sm font-semibold text-black/50">{blockers.map((blocker) => blocker.label).join(", ")}</p>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${score < 50 ? "bg-orange-100 text-orange-900" : "bg-blue-100 text-blue-900"}`}>{score}%</span>
    </div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-forest" style={{ width: `${score}%` }} /></div>
    <div className="mt-3 flex flex-wrap gap-2">
      <StatusBadge status={job.status} />
      <PriorityBadge priority={job.priority} />
      <span className="rounded-full bg-sand px-3 py-1 text-xs font-black text-black/55">{job.dueDate || "No date"}</span>
      <span className="rounded-full bg-sand px-3 py-1 text-xs font-black text-black/55">{job.assignedCrew || "Unassigned"}</span>
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {checks.map((check) => <div key={check.label} className={`rounded-2xl border p-3 ${check.ok ? "border-forest/10 bg-forest/5" : "border-orange-200 bg-orange-50"}`}>
        <p className="flex items-center gap-2 text-sm font-black">{check.ok ? <CheckCircleIcon className="size-5 text-forest" /> : <WrenchScrewdriverIcon className="size-5 text-orange-700" />}{check.label}</p>
        <p className="mt-1 text-xs font-semibold text-black/45">{check.detail}</p>
      </div>)}
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Link href={`/jobs/${job.jobId}/edit`} className="min-h-11 rounded-xl bg-forest px-3 py-2 text-center text-sm font-black text-white">Fix job</Link>
      <Link href={`/jobs/${job.jobId}`} className="min-h-11 rounded-xl bg-sand px-3 py-2 text-center text-sm font-black text-ink">Profile</Link>
      <Link href="/dispatch" className="min-h-11 rounded-xl bg-ink px-3 py-2 text-center text-sm font-black text-white">Handoff</Link>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-white/55">{label}</p></div>;
}
