import Link from "next/link";
import { BellAlertIcon, CalendarDaysIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/lib/types";
import { buildJobReminders, formatReminderDate, reminderTone, type ReminderBucket } from "@/lib/reminders";
import { StatusBadge } from "./StatusBadge";

const buckets: ReminderBucket[] = ["Overdue", "Today", "Unscheduled", "Upcoming"];

export function RemindersView({ jobs }: { jobs: Job[] }) {
  const today = new Date().toLocaleDateString("en-CA");
  const reminders = buildJobReminders(jobs, today);
  const counts = Object.fromEntries(buckets.map((bucket) => [bucket, reminders.filter((reminder) => reminder.bucket === bucket).length])) as Record<ReminderBucket, number>;

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><BellAlertIcon className="size-7" /></span>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-widest text-forest">Manager reminders</p>
          <h1 className="text-3xl font-black">Follow-up reminders</h1>
          <p className="mt-1 text-sm text-black/50">Overdue, due-today, unscheduled, and upcoming communication follow-ups.</p>
        </div>
      </div>
      <Link href="/communication?filter=follow-up" className="btn-secondary print:hidden">Resolve / Snooze</Link>
    </div>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Overdue" value={counts.Overdue} tone="bg-red-100" />
      <Metric label="Due today" value={counts.Today} tone="bg-amber-100" />
      <Metric label="Unscheduled" value={counts.Unscheduled} tone="bg-sand" />
      <Metric label="Upcoming" value={counts.Upcoming} tone="bg-blue-100" />
    </section>

    <div className="grid gap-5">
      {buckets.map((bucket) => {
        const items = reminders.filter((reminder) => reminder.bucket === bucket);
        return <section key={bucket} className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 bg-sand p-4">
            <div>
              <h2 className="text-lg font-black">{bucket === "Today" ? "Due today" : bucket}</h2>
              <p className="text-sm font-semibold text-black/45">{items.length} reminder{items.length === 1 ? "" : "s"}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${reminderTone(bucket)}`}>{bucket}</span>
          </div>
          <div className="divide-y divide-black/5">
            {items.length ? items.slice(0, 25).map((reminder) => <Link key={reminder.id} href="/communication?filter=follow-up" className="block p-4 hover:bg-black/[.02]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-forest">{reminder.job.jobId} · {reminder.job.customerName} · {reminder.job.city}</p>
                  <h3 className="mt-1 font-black">{reminder.entry.message}</h3>
                  <p className="mt-1 text-sm font-semibold text-black/45"><CalendarDaysIcon className="mr-1 inline size-4" />{formatReminderDate(reminder.dueDate)} · {reminder.entry.type} · {reminder.entry.audience || "All"}</p>
                  <p className="mt-2 text-xs font-black text-forest">Open Communication Center to resolve, reopen, or snooze this follow-up.</p>
                </div>
                <StatusBadge status={reminder.job.status} />
              </div>
            </Link>) : <div className="p-6 text-center text-sm font-semibold text-black/35"><CheckCircleIcon className="mx-auto mb-2 size-7 text-forest" />No {bucket.toLowerCase()} reminders.</div>}
          </div>
        </section>;
      })}
    </div>
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="card p-4">
    <div className={`mb-3 grid size-10 place-items-center rounded-xl ${tone}`}><BellAlertIcon className="size-5" /></div>
    <p className="text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-black/45">{label}</p>
  </div>;
}
