"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BellAlertIcon, CheckCircleIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/lib/types";
import { buildJobTasks, type JobTask } from "@/lib/job-tasks";
import { PriorityBadge, StatusBadge } from "./StatusBadge";

const categories: Array<JobTask["category"] | "All"> = ["All", "Follow-up", "Urgent", "Parts", "Paperwork", "Photos", "Billing", "Schedule"];

export function TasksView({ jobs }: { jobs: Job[] }) {
  const [category, setCategory] = useState<JobTask["category"] | "All">("All");
  const tasks = useMemo(() => buildJobTasks(jobs), [jobs]);
  const filtered = category === "All" ? tasks : tasks.filter((task) => task.category === category);
  const high = tasks.filter((task) => task.priority === "High").length;
  const normal = tasks.filter((task) => task.priority === "Normal").length;

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex items-start gap-3">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><ClipboardDocumentListIcon className="size-7" /></span>
      <div>
        <p className="text-sm font-extrabold uppercase tracking-widest text-forest">Task board</p>
        <h1 className="text-3xl font-black">Follow-ups & tasks</h1>
        <p className="mt-1 text-sm text-black/50">Actionable work pulled from job follow-up flags, open parts, missing paperwork, schedule gaps, and billing blockers.</p>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-3">
      <Metric label="Open tasks" value={tasks.length} />
      <Metric label="High priority" value={high} />
      <Metric label="Normal" value={normal} />
    </div>

    <section className="card p-3 sm:p-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((item) => {
          const count = item === "All" ? tasks.length : tasks.filter((task) => task.category === item).length;
          return <button key={item} type="button" onClick={() => setCategory(item)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${category === item ? "bg-forest text-white" : "bg-sand text-black/50"}`}>{item} ({count})</button>;
        })}
      </div>
    </section>

    <section className="grid gap-3 md:grid-cols-2">
      {filtered.length ? filtered.map((task) => <TaskCard key={task.id} task={task} />) : <div className="card p-8 text-center md:col-span-2">
        <CheckCircleIcon className="mx-auto mb-3 size-10 text-forest" />
        <p className="font-black">No tasks in this filter.</p>
        <p className="mt-1 text-sm text-black/45">Quiet task board. I don’t trust it either, but we’ll take the win.</p>
      </div>}
    </section>
  </div>;
}

function TaskCard({ task }: { task: JobTask }) {
  return <Link href={task.href} className="card block p-4 transition hover:-translate-y-0.5 hover:shadow-soft">
    <div className="flex items-start gap-3">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${task.priority === "High" ? "bg-orange-100 text-orange-800" : "bg-sand text-forest"}`}><BellAlertIcon className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${task.priority === "High" ? "bg-orange-100 text-orange-800" : "bg-lime/60 text-ink"}`}>{task.priority}</span>
          <span className="rounded-full bg-sand px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-black/45">{task.category}</span>
          <StatusBadge status={task.job.status} />
          <PriorityBadge priority={task.job.priority} />
        </div>
        <h2 className="mt-2 font-black">{task.title}</h2>
        <p className="mt-1 text-sm font-semibold text-black/55">{task.detail}</p>
        <p className="mt-3 truncate text-xs font-black uppercase tracking-wide text-black/35">{task.job.jobId} · {task.job.customerName} · {task.job.city}</p>
      </div>
    </div>
  </Link>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="card p-4">
    <p className="text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-black/45">{label}</p>
  </div>;
}
