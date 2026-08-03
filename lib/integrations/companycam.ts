import type { Job } from "@/lib/types";

const API_URL = "https://api.companycam.com/v2";

type CompanyCamProject = { id: string; project_url?: string };

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
      state: "TX",
      country: "US",
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
  const requestHeaders = headers();
  if (!requestHeaders) return null;
  const response = await fetch(`${API_URL}/projects/${projectId}/photos?per_page=100`, { headers: requestHeaders });
  if (!response.ok) throw new Error(`CompanyCam photo sync failed (${response.status})`);
  const photos = await response.json() as unknown[];
  return photos.length;
}
