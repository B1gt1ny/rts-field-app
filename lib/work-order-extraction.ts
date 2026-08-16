import { aiWorkOrderImportFields, type AIWorkOrderImport } from "./types";

const allowedFields = aiWorkOrderImportFields;

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
