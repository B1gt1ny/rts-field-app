import { createHash } from "node:crypto";
import type { FileCategory } from "./types";

export const maxUploadBytes = 4 * 1024 * 1024;
const maxRequestBytes = maxUploadBytes + 256 * 1024;
export const fileCategories: FileCategory[] = ["Work Order", "Paperwork", "Receipt", "Signed Document", "Before", "Progress", "After", "Damage", "Serial / Tags", "Parts", "Other"];
const mimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/avif", "image/bmp", "image/tiff", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/csv"]);

export class UploadError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function readUploadForm(request: Request) {
  const length = Number(request.headers.get("content-length"));
  if (length > maxRequestBytes) throw new UploadError("Upload is too large. Use a file under 4 MB.", 413);
  if (!request.body) throw new UploadError("Upload body is required.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxRequestBytes) {
        await reader.cancel();
        throw new UploadError("Upload is too large. Use a file under 4 MB.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    return await new Request(request.url, { method: "POST", headers: request.headers, body: Buffer.concat(chunks) }).formData();
  } catch { throw new UploadError("Upload must contain valid form data.", 400); }
}

export function validateUpload(file: File, category: string) {
  if (!fileCategories.includes(category as FileCategory)) throw new UploadError("Select a valid file category.", 400);
  if (!file.size) throw new UploadError("The file is empty.", 400);
  if (file.size > maxUploadBytes) throw new UploadError("Upload is too large. Use a file under 4 MB.", 413);
  if (!mimeTypes.has(file.type)) throw new UploadError("Use a photo, PDF, Word, text, or CSV file.", 415);
}


export function uploadFingerprint(bytes: Uint8Array, context: { ownerId: string; jobId: string; category: string; caption: string; fileName: string; fileType: string }) {
  return createHash("sha256").update(JSON.stringify([context.ownerId, context.jobId, context.category, context.caption, context.fileName, context.fileType])).update("\0").update(bytes).digest("hex");
}
