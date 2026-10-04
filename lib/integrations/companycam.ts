import type { Job } from "@/lib/types";

const API_URL = "https://api.companycam.com/v2";

type CompanyCamProject = { id: string; project_url?: string };

export type CompanyCamPhotoReference = {
  id: string;
  thumbnailUrl?: string;
  createdAt?: string;
};

export function isCompanyCamConfigured() {
  return Boolean(process.env.COMPANYCAM_ACCESS_TOKEN);
}

function headers() {
  const token = process.env.COMPANYCAM_ACCESS_TOKEN;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(process.env.COMPANYCAM_USER_EMAIL ? { "X-CompanyCam-User": process.env.COMPANYCAM_USER_EMAIL } : {}),
  };
}

function projectBody(job: Job) {
  return {
    name: `${job.jobId} — ${job.customerName}`,
    address: {
      street_address_1: job.address,
      city: job.city,
    },
    primary_contact: job.phone ? { name: job.customerName, phone_number: job.phone } : undefined,
  };
}

export async function syncCompanyCamProject(job: Job): Promise<Job> {
  const requestHeaders = headers();
  if (!requestHeaders) throw new Error("CompanyCam is not connected. Add COMPANYCAM_ACCESS_TOKEN in Vercel first.");
  const url = job.companyCamProjectId ? `${API_URL}/projects/${job.companyCamProjectId}` : `${API_URL}/projects`;
  const response = await fetch(url, {
    method: job.companyCamProjectId ? "PUT" : "POST",
    headers: requestHeaders,
    body: JSON.stringify(projectBody(job)),
  });
  if (!response.ok) throw new Error(`CompanyCam sync failed (${response.status})`);
  const project = await response.json() as CompanyCamProject;
  return {
    ...job,
    syncToCompanyCam: true,
    companyCamProjectId: project.id,
    companyCamProjectUrl: project.project_url || `https://app.companycam.com/projects/${project.id}`,
  };
}

export async function getCompanyCamPhotoCount(projectId: string) {
  return (await getCompanyCamPhotos(projectId)).length;
}

export async function getCompanyCamProjectPhotos(projectId: string, allPages = false): Promise<CompanyCamPhotoReference[]> {
  const photos = await getCompanyCamPhotos(projectId, allPages);
  return photos.flatMap((photo) => {
    if (!photo || typeof photo !== "object") return [];
    const record = photo as Record<string, unknown>;
    const id = stringValue(record.id);
    if (!id) return [];
    return [{
      id,
      thumbnailUrl: photoImage(record) || safeUrl(stringValue(record.thumbnail_url) || stringValue(record.thumbnailUrl) || stringValue(record.thumbnail)),
      createdAt: photoDate(record.captured_at ?? record.created_at ?? record.createdAt),
    }];
  });
}

async function getCompanyCamPhotos(projectId: string, allPages = false): Promise<unknown[]> {
  const requestHeaders = headers();
  if (!requestHeaders) return [];
  const photos: unknown[] = [];
  const signal = AbortSignal.timeout(10000);
  // CompanyCam lists newest captures first. The cover needs every page to find the first capture.
  // Bound large/unexpected responses rather than presenting a partial list as complete.
  for (let page = 1; page <= 50; page++) {
    const response = await fetch(`${API_URL}/projects/${encodeURIComponent(projectId)}/photos?per_page=100&page=${page}`, { headers: requestHeaders, signal, cache: "no-store" });
    if (!response.ok) throw new Error(`CompanyCam photo sync failed (${response.status})`);
    const batch: unknown = await response.json();
    if (!Array.isArray(batch)) throw new Error("CompanyCam photo response was invalid.");
    photos.push(...batch);
    if (!allPages || batch.length < 100) return photos;
  }
  throw new Error("CompanyCam photo collection exceeds the cover-photo limit.");
}

function photoDate(value: unknown) {
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function photoImage(record: Record<string, unknown>) {
  if (!Array.isArray(record.uris)) return undefined;
  for (const variant of ["web", "thumbnail", "original"]) {
    const image = record.uris.find(item => item && typeof item === "object" && item.type === variant);
    const url = image && safeUrl(stringValue(image.url));
    if (url) return url;
  }
  return undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function safeUrl(value?: string) {
  if (!value) return undefined;
  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}
