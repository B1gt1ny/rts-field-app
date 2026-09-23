import type { Job } from "@/lib/types";
import { syncCompanyCamProject } from "./companycam";

export async function syncJobIntegrations(job: Job) {
  const warnings: string[] = [];
  let synced = job;
  if (synced.syncToCompanyCam || synced.companyCamProjectId) {
    try { synced = await syncCompanyCamProject(synced); } catch (error) { warnings.push(error instanceof Error ? error.message : "CompanyCam sync failed"); }
  }
  // RTS -> ICS is the outbound calendar mechanism; do not write Google events.
  if (synced !== job) synced = { ...synced, integrationsLastSyncedAt: new Date().toISOString() };
  return { job: synced, warnings };
}
