import type { Job } from "./types";

export type CoverPhoto = { reference: NonNullable<Job["coverPhoto"]>; url: string; label: string; createdAt?: string };
type ProviderPhoto = { id: string; thumbnailUrl?: string; createdAt?: string };

export function jobContact(job: Pick<Job, "phone" | "address" | "city">) {
  const phone = job.phone?.trim() || "";
  const address = [job.address?.trim(), job.city?.trim()].filter(Boolean).join(", ");
  const digits = phone.replace(/[^\d+]/g, "");
  return { phone, address, phoneHref: /\d/.test(digits) ? `tel:${digits}` : undefined, mapHref: address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : undefined };
}

export function coverPhotos(job: Job, provider: ProviderPhoto[] = []): CoverPhoto[] {
  const photos: CoverPhoto[] = [];
  const seen = new Set<string>();
  for (const file of job.workOrderFiles || []) {
    if (!file.fileType?.startsWith("image/")) continue;
    const url = file.storagePath ? `/api/files/view?path=${encodeURIComponent(file.storagePath)}` : file.storageUrl || file.dataUrl;
    if (!safeImage(url)) continue;
    seen.add(file.storageUrl || file.dataUrl);
    photos.push({ reference: { source: "file", id: file.id }, url, label: file.fileName || "Job photo", createdAt: file.uploadedAt });
  }
  for (const bucket of ["beforePhotos", "damagePhotos", "serialTagPhotos", "afterPhotos"] as const) {
    for (const url of job[bucket] || []) {
      if (!safeImage(url) || seen.has(url)) continue;
      seen.add(url);
      photos.push({ reference: { source: "legacy", id: url }, url, label: "Job photo" });
    }
  }
  if (job.companyCamProjectId) for (const photo of provider) {
    if (!photo.thumbnailUrl || !safeImage(photo.thumbnailUrl)) continue;
    photos.push({ reference: { source: "companycam", id: photo.id, projectId: job.companyCamProjectId }, url: photo.thumbnailUrl, label: "CompanyCam photo", createdAt: photo.createdAt });
  }
  return photos.sort((a, b) => timestamp(a.createdAt) - timestamp(b.createdAt));
}

function timestamp(value?: string) { const time = value ? Date.parse(value) : NaN; return Number.isFinite(time) ? time : Infinity; }
function safeImage(value?: string): value is string {
  if (!value) return false;
  if (/^\/api\/files\/view\?path=/.test(value) || /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(value)) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
export function sameCover(a: Job["coverPhoto"], b: Job["coverPhoto"]) {
  return (!a && !b) || Boolean(a && b && a.source === b.source && a.id === b.id && a.projectId === b.projectId);
}
export function currentCover(job: Job, photos: CoverPhoto[]) {
  return photos.find(photo => sameCover(photo.reference, job.coverPhoto)) || photos[0];
}
