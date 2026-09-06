import { aiWorkOrderImportFields, type AIWorkOrderImport } from "./types";

const allowedFields = aiWorkOrderImportFields;
export const workOrderExtractionFileTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type WorkOrderExtractionFileType = typeof workOrderExtractionFileTypes[number];
export type WorkOrderExtractionDocument =
  | { type: "input_file"; filename: string; file_data: string; detail: "high" }
  | { type: "input_image"; image_url: string; detail: "high" };
export type WorkOrderExtractionSchema = {
  type: "object";
  additionalProperties: false;
  properties: Record<string, { type: ("string" | "boolean" | "null")[] }>;
  required: string[];
};

export function isWorkOrderExtractionFileType(value: string): value is WorkOrderExtractionFileType {
  return workOrderExtractionFileTypes.includes(value as WorkOrderExtractionFileType);
}

export function buildWorkOrderExtractionDocument(fileType: WorkOrderExtractionFileType, fileName: string, base64Data: string): WorkOrderExtractionDocument {
  const dataUrl = "data:" + fileType + ";base64," + base64Data;
  return fileType === "application/pdf"
    ? { type: "input_file", filename: fileName, file_data: dataUrl, detail: "high" }
    : { type: "input_image", image_url: dataUrl, detail: "high" };
}


export function buildWorkOrderExtractionSchema(): WorkOrderExtractionSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(allowedFields.map((field) => [
      field,
      { type: field === "returnVisitRequired" ? ["boolean", "null"] : ["string", "null"] },
    ])),
    required: [...allowedFields],
  };
}

export function validateWorkOrderProposal(output: string | undefined): AIWorkOrderImport | null | "invalid" {
  let parsed: unknown;
  try { parsed = JSON.parse(output || "{}"); } catch { return "invalid"; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "invalid";
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.some(([field]) => !allowedFields.includes(field as typeof allowedFields[number]))) return "invalid";
  const proposalEntries: [string, string | boolean][] = [];
  for (const [field, value] of entries) {
    if (value === undefined || value === null || value === "") continue;
    if (field === "returnVisitRequired") {
      if (typeof value !== "boolean") return "invalid";
      proposalEntries.push([field, value]);
      continue;
    }
    if (typeof value !== "string") return "invalid";
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (field === "dueDate" && !isValidDate(trimmed)) return "invalid";
    if (field === "scheduledTime" && !isValidTime(trimmed)) return "invalid";
    proposalEntries.push([field, trimmed]);
  }
  const proposal = Object.fromEntries(proposalEntries) as AIWorkOrderImport;
  return Object.keys(proposal).length ? proposal : null;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
