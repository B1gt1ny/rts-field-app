import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { checklistLabels, defaultFactoryCost, jobTypeOptions, priorities, statuses, type BusinessSettings, type MerchRequest, type MerchRequestStatus } from "./types";

const settingsFile = path.join(process.cwd(), "data", "settings.json");
const merchFile = path.join(process.cwd(), "data", "merch-requests.json");
const defaultBusinessId = "rts";
const internalStatus = "Complete";
const internalSource = "Individual";

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

async function getLocalSettings(): Promise<BusinessSettings> {
  try {
    return JSON.parse(await fs.readFile(settingsFile, "utf8")) as BusinessSettings;
  } catch (error) {
    if (isMissingFile(error)) return normalizeSettings({ businessId: defaultBusinessId });
    throw error;
  }
}

async function saveLocalSettings(settings: BusinessSettings) {
  await fs.mkdir(path.dirname(settingsFile), { recursive: true });
  await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2));
}

async function getLocalMerchRequests(): Promise<MerchRequest[]> {
  try {
    return JSON.parse(await fs.readFile(merchFile, "utf8")) as MerchRequest[];
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }
}

async function saveLocalMerchRequests(requests: MerchRequest[]) {
  await fs.mkdir(path.dirname(merchFile), { recursive: true });
  await fs.writeFile(merchFile, JSON.stringify(requests, null, 2));
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function normalizeSettings(input: Partial<BusinessSettings>): BusinessSettings {
  return {
    businessId: input.businessId?.trim() || defaultBusinessId,
    appDisplayName: input.appDisplayName?.trim() || "Field Service",
    headerName: input.headerName?.trim() || "Field Service",
    brandShortName: input.brandShortName?.trim() || "FA",
    companyName: input.companyName?.trim() || "Company",
    phone: input.phone?.trim() || "",
    email: input.email?.trim() || "",
    address: input.address?.trim() || "",
    city: input.city?.trim() || "",
    defaultCalendar: input.defaultCalendar?.trim() || "Google Calendar",
    defaultState: input.defaultState?.trim() || "",
    merchandiseLink: input.merchandiseLink?.trim() || "",
    fieldSupportName: input.fieldSupportName?.trim() || "Office",
    fieldSupportPhone: input.fieldSupportPhone?.trim() || input.phone?.trim() || "",
    employeeHelpInstructions: input.employeeHelpInstructions?.trim() || "If something blocks the job, tap Need Help, add what is missing, then call or text the office before leaving.",
    employeeFieldNotice: input.employeeFieldNotice?.trim() || "Open your assigned job, check the scope, take required photos, add notes, and tap Ready Review when field work is complete.",
    managerReviewInstructions: input.managerReviewInstructions?.trim() || "Manager review checks after photos, completion notes, work completed, and open parts before billing.",
    customerTextTemplate: input.customerTextTemplate?.trim() || "Company update for {customerName}: crew is on your job {jobId}.",
    factoryCostInstructions: input.factoryCostInstructions?.trim() || "Factory jobs: enter miles, drive time, hotel, materials, and other receipt totals before sending the job for review.",
    factoryCostDefaults: { ...defaultFactoryCost(), ...(input.factoryCostDefaults || {}) },
    employeeCanRequestHelp: input.employeeCanRequestHelp ?? true,
    employeeCanStartJobs: input.employeeCanStartJobs ?? true,
    employeeCanAddQuickNotes: input.employeeCanAddQuickNotes ?? true,
    employeeCanAddCompletionNotes: input.employeeCanAddCompletionNotes ?? true,
    employeeCanUploadFiles: input.employeeCanUploadFiles ?? true,
    employeeCanRequestParts: input.employeeCanRequestParts ?? true,
    employeeCanAddFactoryCosts: input.employeeCanAddFactoryCosts ?? true,
    employeeCanSendReadyReview: input.employeeCanSendReadyReview ?? true,
    employeeCanAddSignoffs: input.employeeCanAddSignoffs ?? true,
    employeeCanViewPackets: input.employeeCanViewPackets ?? true,
    showCompletedJobsInFieldApp: input.showCompletedJobsInFieldApp ?? false,
    jobTypeOptions: cleanList(input.jobTypeOptions, [...jobTypeOptions]),
    statusOptions: cleanList(input.statusOptions, [...statuses]),
    priorityOptions: cleanList(input.priorityOptions, [...priorities]),
    checklistOptions: cleanList(input.checklistOptions, [...checklistLabels]),
    employeeFieldNoteTemplates: cleanList(input.employeeFieldNoteTemplates, defaultFieldNoteTemplates),
    requireAfterPhotosToComplete: input.requireAfterPhotosToComplete ?? true,
    requireBeforePhotosForReview: input.requireBeforePhotosForReview ?? true,
    requireSerialTagPhotoForReview: input.requireSerialTagPhotoForReview ?? true,
    requireDamagePhotosForReview: input.requireDamagePhotosForReview ?? false,
    requireAfterPhotosForReview: input.requireAfterPhotosForReview ?? true,
    requireCompletionNotesForReview: input.requireCompletionNotesForReview ?? true,
    requireWorkCompleteForReview: input.requireWorkCompleteForReview ?? true,
    requirePartsClosedForReview: input.requirePartsClosedForReview ?? true,
    requireFactoryCostsForReview: input.requireFactoryCostsForReview ?? true,
    requireReceiptBackupForReview: input.requireReceiptBackupForReview ?? true,
  };
}

const defaultFieldNoteTemplates = [
  "Arrived | Crew arrived on site. | Time",
  "Customer not home | Customer not home. Crew needs follow-up before returning. | Customer",
  "Parts missing | Parts missing or incorrect. Need manager review before work can continue. | Parts",
  "Blocked | Crew is blocked and needs manager direction before continuing. | Status",
  "Work complete | Field work complete. Ready for closeout review. | Status",
];

function cleanList(input: string[] | undefined, fallback: string[]) {
  const values = (input || []).map((item) => item.trim()).filter(Boolean);
  return values.length ? Array.from(new Set(values)) : fallback;
}

function settingsJobId(businessId: string) {
  return `__settings_${businessId}`;
}

function merchJobId(id: string) {
  return `__merch_${id}`;
}

type Database = NonNullable<ReturnType<typeof database>>;

async function getSettingsFromJobsTable(db: Database, businessId: string, fallback: BusinessSettings): Promise<BusinessSettings> {
  const { data, error } = await db.from("jobs").select("data").eq("job_id", settingsJobId(businessId)).maybeSingle();
  if (error) {
    console.warn(`Unable to load fallback settings row; using local defaults: ${error.message}`);
    return fallback;
  }
  return normalizeSettings({ ...fallback, ...(data?.data as Partial<BusinessSettings> | undefined), businessId });
}

async function saveSettingsToJobsTable(db: Database, settings: BusinessSettings): Promise<BusinessSettings> {
  const { error } = await db.from("jobs").upsert({
    job_id: settingsJobId(settings.businessId),
    status: internalStatus,
    source: internalSource,
    assigned_crew: "Admin",
    priority: "Low",
    due_date: null,
    data: settings,
    updated_at: new Date().toISOString(),
  }, { onConflict: "job_id" });
  if (error) throw new Error(`Unable to save fallback business settings: ${error.message}`);
  return settings;
}

async function getMerchRequestsFromJobsTable(db: Database, businessId: string): Promise<MerchRequest[]> {
  const { data, error } = await db.from("jobs").select("data").like("job_id", "\\_\\_merch\\_%").order("created_at", { ascending: false });
  if (error) {
    console.warn(`Unable to load fallback merch request rows; using local defaults: ${error.message}`);
    return getLocalMerchRequests();
  }
  return data.map((row) => row.data as MerchRequest).filter((request) => request.businessId === businessId);
}

async function saveMerchRequestToJobsTable(db: Database, request: MerchRequest): Promise<MerchRequest> {
  const { error } = await db.from("jobs").upsert({
    job_id: merchJobId(request.id),
    status: internalStatus,
    source: internalSource,
    assigned_crew: "Admin",
    priority: "Low",
    due_date: null,
    data: request,
    updated_at: new Date().toISOString(),
  }, { onConflict: "job_id" });
  if (error) throw new Error(`Unable to save fallback merch request: ${error.message}`);
  return request;
}

export async function getBusinessSettings(businessId = defaultBusinessId): Promise<BusinessSettings> {
  const fallback = await getLocalSettings();
  const db = database();
  if (!db) return normalizeSettings(fallback);

  const { data, error } = await db.from("business_settings").select("data").eq("business_id", businessId).maybeSingle();
  if (error) {
    console.warn(`Unable to load business settings from Supabase; using jobs-table fallback: ${error.message}`);
    return getSettingsFromJobsTable(db, businessId, fallback);
  }
  return normalizeSettings({ ...fallback, ...(data?.data as Partial<BusinessSettings> | undefined), businessId });
}

export async function saveBusinessSettings(input: Partial<BusinessSettings>): Promise<BusinessSettings> {
  const settings = normalizeSettings(input);
  const db = database();
  if (!db) {
    await saveLocalSettings(settings);
    return settings;
  }

  const { error } = await db.from("business_settings").upsert({
    business_id: settings.businessId,
    data: settings,
    updated_at: new Date().toISOString(),
  }, { onConflict: "business_id" });
  if (error) {
    console.warn(`Unable to save business settings to dedicated table; using jobs-table fallback: ${error.message}`);
    return saveSettingsToJobsTable(db, settings);
  }
  return settings;
}

export async function getMerchRequests(businessId = defaultBusinessId): Promise<MerchRequest[]> {
  const db = database();
  if (!db) return getLocalMerchRequests();

  const { data, error } = await db.from("merch_requests").select("data").eq("business_id", businessId).order("created_at", { ascending: false });
  if (error) {
    console.warn(`Unable to load merch requests from Supabase; using jobs-table fallback: ${error.message}`);
    return getMerchRequestsFromJobsTable(db, businessId);
  }
  return data.map((row) => row.data as MerchRequest);
}

export async function createMerchRequest(input: Partial<MerchRequest>): Promise<MerchRequest> {
  const request: MerchRequest = {
    id: input.id || `merch-${Date.now()}`,
    businessId: input.businessId?.trim() || defaultBusinessId,
    item: input.item?.trim() || "Shirt",
    size: input.size?.trim() || "",
    color: input.color?.trim() || "",
    quantity: input.quantity?.trim() || "1",
    requestedBy: input.requestedBy?.trim() || "",
    notes: input.notes?.trim() || "",
    status: input.status || "Requested",
    createdAt: input.createdAt || new Date().toISOString(),
  };
  const db = database();
  if (!db) {
    const requests = await getLocalMerchRequests();
    requests.unshift(request);
    await saveLocalMerchRequests(requests.slice(0, 200));
    return request;
  }

  const { error } = await db.from("merch_requests").insert({
    id: request.id,
    business_id: request.businessId,
    status: request.status,
    data: request,
  });
  if (error) {
    console.warn(`Unable to save merch request to dedicated table; using jobs-table fallback: ${error.message}`);
    return saveMerchRequestToJobsTable(db, request);
  }
  return request;
}

export async function updateMerchRequest(id: string, status: MerchRequestStatus): Promise<MerchRequest | undefined> {
  const db = database();
  if (!db) {
    const requests = await getLocalMerchRequests();
    const index = requests.findIndex((request) => request.id === id);
    if (index < 0) return undefined;
    requests[index] = { ...requests[index], status };
    await saveLocalMerchRequests(requests);
    return requests[index];
  }

  const existing = await db.from("merch_requests").select("data").eq("id", id).maybeSingle();
  if (existing.error) {
    console.warn(`Unable to load dedicated merch request; using jobs-table fallback: ${existing.error.message}`);
    const fallback = await db.from("jobs").select("data").eq("job_id", merchJobId(id)).maybeSingle();
    if (fallback.error) throw new Error(`Unable to load fallback merch request: ${fallback.error.message}`);
    if (!fallback.data?.data) return undefined;
    const updated = { ...(fallback.data.data as MerchRequest), status };
    return saveMerchRequestToJobsTable(db, updated);
  }
  if (!existing.data?.data) {
    const fallback = await db.from("jobs").select("data").eq("job_id", merchJobId(id)).maybeSingle();
    if (fallback.error) throw new Error(`Unable to load fallback merch request: ${fallback.error.message}`);
    if (!fallback.data?.data) return undefined;
    const updated = { ...(fallback.data.data as MerchRequest), status };
    return saveMerchRequestToJobsTable(db, updated);
  }
  const updated = { ...(existing.data.data as MerchRequest), status };
  const { data, error } = await db.from("merch_requests").update({
    status,
    data: updated,
    updated_at: new Date().toISOString(),
  }).eq("id", id).select("data").maybeSingle();
  if (error) throw new Error(`Unable to update merch request: ${error.message}`);
  return data?.data as MerchRequest | undefined;
}
