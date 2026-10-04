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
  return data.map((row) => row.data as Job);
}

export class JobConflictError extends Error {
  constructor() { super("This job changed since you opened it. Refresh the job and review your changes before saving again."); }
}

function row(job: Job) {
  return { job_id: job.jobId, status: job.status, source: job.source, assigned_crew: job.assignedCrew,
    priority: job.priority, due_date: job.dueDate || null, data: job, updated_at: new Date().toISOString() };
}

// Serialize local development writes. Hosted writes use Postgres compare-and-swap.
let localWrite: Promise<unknown> = Promise.resolve();
function locally<T>(action: () => Promise<T>): Promise<T> {
  const result = localWrite.then(action, action);
  localWrite = result.catch(() => undefined);
  return result;
}

export async function createJob(input: Job): Promise<Job> {
  const db = database();
  const create = async () => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const jobs = db ? await getJobs() : await getLocalJobs();
      const number = Math.max(0, ...jobs.map((job) => Number(job.jobId.replace(/\D/g, "")) || 0)) + 1;
      const job = { ...input, jobId: input.jobId || `RTS-${number}`, revision: crypto.randomUUID() };
      if (!db) {
        if (jobs.some((saved) => saved.jobId === job.jobId)) throw new JobConflictError();
        await fs.writeFile(dataFile, JSON.stringify([job, ...jobs], null, 2));
        return job;
      }
      const { error } = await db.from("jobs").insert(row(job));
      if (!error) return job;
      if (error.code !== "23505") throw new Error(`Unable to create job: ${error.message}`);
      if (input.jobId) throw new JobConflictError();
    }
    throw new JobConflictError();
  };
  return db ? create() : locally(create);
}

export async function saveJob(expected: Job, changes: Partial<Job>): Promise<Job> {
  const db = database();
  const next = { ...expected, ...changes, jobId: expected.jobId, revision: crypto.randomUUID() };
  if (!db) return locally(async () => {
    const jobs = await getLocalJobs();
    const index = jobs.findIndex((job) => job.jobId === expected.jobId);
    if (index < 0 || JSON.stringify(jobs[index]) !== JSON.stringify(expected)) throw new JobConflictError();
    jobs[index] = next;
    await fs.writeFile(dataFile, JSON.stringify(jobs, null, 2));
    return next;
  });
  const query = db.from("jobs").update(row(next)).eq("job_id", expected.jobId);
  const guarded = expected.revision ? query.eq("data->>revision", expected.revision) : query.is("data->>revision", null);
  const { data, error } = await guarded.select("data").maybeSingle();
  if (error) throw new Error(`Unable to save job: ${error.message}`);
  if (!data) throw new JobConflictError();
  return data.data as Job;
}

// Integration results update only their fields, never replay a pre-provider snapshot.
export async function saveJobIntegration(job: Job): Promise<Job> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await getJob(job.jobId);
    if (!current || (current.companyCamProjectId && job.companyCamProjectId && current.companyCamProjectId !== job.companyCamProjectId)) throw new JobConflictError();
    try {
      return await saveJob(current, { syncToCompanyCam: job.syncToCompanyCam,
        companyCamProjectId: job.companyCamProjectId, companyCamProjectUrl: job.companyCamProjectUrl,
        integrationsLastSyncedAt: job.integrationsLastSyncedAt });
    } catch (error) { if (!(error instanceof JobConflictError)) throw error; }
  }
  throw new JobConflictError();
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
    await locally(async () => {
      const jobs = await getLocalJobs();
      await fs.writeFile(dataFile, JSON.stringify(jobs.filter((job) => job.jobId !== id), null, 2));
    });
    return;
  }

  const { error } = await db.from("jobs").delete().eq("job_id", id);
  if (error) throw new Error(`Unable to delete job: ${error.message}`);
}
