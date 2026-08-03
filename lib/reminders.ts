import type { Job, JobActivity } from "./types";

export type ReminderBucket = "Overdue" | "Today" | "Upcoming" | "Unscheduled";

export type JobReminder = {
  id: string;
  bucket: ReminderBucket;
  job: Job;
  entry: JobActivity;
  dueDate: string;
};

export function buildJobReminders(jobs: Job[], today = new Date().toLocaleDateString("en-CA")) {
  const reminders = jobs.flatMap((job) => (job.activityLog || [])
    .filter((entry) => entry.notify && !entry.resolvedAt)
    .map((entry) => {
      const dueDate = entry.followUpDueDate || "";
      return {
        id: `${job.jobId}-${entry.id}`,
        bucket: reminderBucket(dueDate, today),
        job,
        entry,
        dueDate,
      };
    }));

  return reminders.sort((a, b) => bucketRank(a.bucket) - bucketRank(b.bucket) || (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99") || b.entry.createdAt.localeCompare(a.entry.createdAt));
}

export function reminderBucket(dueDate: string, today = new Date().toLocaleDateString("en-CA")): ReminderBucket {
  if (!dueDate) return "Unscheduled";
  if (dueDate < today) return "Overdue";
  if (dueDate === today) return "Today";
  return "Upcoming";
}

export function bucketRank(bucket: ReminderBucket) {
  if (bucket === "Overdue") return 0;
  if (bucket === "Today") return 1;
  if (bucket === "Unscheduled") return 2;
  return 3;
}

export function reminderTone(bucket: ReminderBucket) {
  if (bucket === "Overdue") return "bg-red-100 text-red-800";
  if (bucket === "Today") return "bg-amber-100 text-amber-800";
  if (bucket === "Upcoming") return "bg-blue-100 text-blue-800";
  return "bg-sand text-black/55";
}

export function formatReminderDate(value: string) {
  if (!value) return "No reminder date";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
