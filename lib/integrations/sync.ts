import type { Job } from "@/lib/types";
import { syncCompanyCamProject } from "./companycam";
import { syncGoogleCalendarEvent } from "./google-calendar";

export async function syncJobIntegrations(job: Job) {
  const warnings: string[] = [];
  let synced = job;
  if (synced.syncToCompanyCam || synced.companyCamProjectId) {
    try { synced = await syncCompanyCamProject(synced); } catch (error) { warnings.push(error instanceof Error ? error.message : "CompanyCam sync failed"); }
  }
  try { synced = await syncGoogleCalendarEvent(synced); } catch (error) { warnings.push(error instanceof Error ? error.message : "Google Calendar sync failed"); }
  if (synced !== job) synced = { ...synced, integrationsLastSyncedAt: new Date().toISOString() };
  return { job: synced, warnings };
}
