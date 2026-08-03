import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import type { Job } from "./types";

const dataFile = path.join(process.cwd(), "data", "jobs.json");

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

async function getLocalJobs(): Promise<Job[]> {
  return JSON.parse(await fs.readFile(dataFile, "utf8")) as Job[];
}

export async function getJobs(): Promise<Job[]> {
  const db = database();
  if (!db) return getLocalJobs();
  const { data, error } = await db.from("jobs").select("job_id,data").not("job_id", "like", "\\_\\_%").order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load jobs: ${error.message}`);
  if (data.length) return data.map((row) => row.data as Job);

  // Seed a newly-created hosted database with the MVP's mock jobs once.
  const initialJobs = await getLocalJobs();
  await saveJobs(initialJobs);
  return initialJobs;
}

export async function saveJobs(jobs: Job[]) {
  const db = database();
  if (!db) {
    // Local fallback; Google Sheets or AppSheet sync can replace this repository later.
    await fs.writeFile(dataFile, JSON.stringify(jobs, null, 2));
    return;
  }
  const { error } = await db.from("jobs").upsert(
    jobs.map((job) => ({
      job_id: job.jobId,
      status: job.status,
      source: job.source,
      assigned_crew: job.assignedCrew,
      priority: job.priority,
      due_date: job.dueDate || null,
      data: job,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "job_id" },
  );
  if (error) throw new Error(`Unable to save jobs: ${error.message}`);
}

export async function getJob(id: string) {
  const db = database();
  if (!db) return (await getLocalJobs()).find((job) => job.jobId === id);
  const { data, error } = await db.from("jobs").select("data").eq("job_id", id).maybeSingle();
  if (error) throw new Error(`Unable to load job: ${error.message}`);
  return data?.data as Job | undefined;
}

export async function deleteJob(id: string) {
  const db = database();
  if (!db) {
    const jobs = await getLocalJobs();
    await fs.writeFile(dataFile, JSON.stringify(jobs.filter((job) => job.jobId !== id), null, 2));
    return;
  }

  const { error } = await db.from("jobs").delete().eq("job_id", id);
  if (error) throw new Error(`Unable to delete job: ${error.message}`);
}
