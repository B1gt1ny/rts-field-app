import { priorities, sources, statuses } from "./types";

export type DropdownOption = { label: string; value: string };
export type DropdownOptions = Partial<Record<DropdownKey, DropdownOption[]>>;
type Definition = { label: string; values?: readonly string[]; createPath?: string };

// Fixed choices accept new labels with an explicit existing meaning. They never
// introduce new permissions, boolean values, or workflow rules.
export const dropdownDefinitions = {
  source: { label: "Source", values: sources },
  jobType: { label: "Job type" },
  priority: { label: "Priority", values: priorities },
  jobStatus: { label: "Status", values: statuses },
  calendarPlan: { label: "Calendar plan", values: ["Confirmed", "Tentative"] },
  invoiceStatus: { label: "Invoice status", values: ["Not started", "Needs more info", "Draft", "Ready", "Sent to Billing", "Sent", "On hold", "Paid"] },
  photoCategory: { label: "Photo category", values: ["Before", "Progress", "After", "Damage", "Serial / Tags", "Parts", "Paperwork", "Receipt"] },
  partStatus: { label: "Part status", values: ["Needed", "Ordered", "Picked up", "Installed", "Not needed"] },
  signoffType: { label: "Sign-off type" },
  signerRole: { label: "Signer role" },
  serviceRating: { label: "Service rating", values: ["", "1", "2", "3", "4", "5"] },
  customerSatisfied: { label: "Customer satisfied", values: ["", "yes", "no"] },
  wouldRecommend: { label: "Would recommend", values: ["", "yes", "no"] },
  paperworkStatus: { label: "Paperwork status", values: ["Needed", "Collected", "Submitted", "Not needed"] },
  receiptCategory: { label: "Receipt category" },
  audience: { label: "Audience", values: ["All", "Admin", "Manager", "Employee"] },
  userRole: { label: "Login role", values: ["Employee", "Manager", "Admin"] },
  employee: { label: "Employee", createPath: "/employees" },
  crew: { label: "Crew", createPath: "/employees" },
  job: { label: "Job", createPath: "/jobs/new" },
  merchItem: { label: "Item" },
  communicationType: { label: "Communication type" },
  sort: { label: "Sort", values: ["dueDate", "priority", "customer", "status"] },
  billingState: { label: "Billing state", values: ["Not Ready", "Ready to Invoice", "With billing", "Invoice sent", "Paid / Complete", "Invoiced"] },
} satisfies Record<string, Definition>;

export type DropdownKey = keyof typeof dropdownDefinitions;

export function dropdownDefinition(key: DropdownKey): Definition {
  return dropdownDefinitions[key];
}

export function validateDropdownOption(key: unknown, input: unknown): { key: DropdownKey; option: DropdownOption } {
  if (typeof key !== "string" || !Object.prototype.hasOwnProperty.call(dropdownDefinitions, key)) throw new Error("Unknown dropdown.");
  const definition = dropdownDefinition(key as DropdownKey);
  if (definition.createPath) throw new Error("Create this record using its form.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("A new option is required.");
  const { label, value } = input as Record<string, unknown>;
  if (typeof label !== "string" || typeof value !== "string") throw new Error("Option label and value must be text.");
  const cleaned = { label: label.trim(), value: value.trim() };
  if (!cleaned.label || cleaned.label.length > 100 || cleaned.value.length > 100 || cleaned.label === "Add new" || cleaned.value.startsWith("__rts_")) throw new Error("Enter an option of 1–100 characters.");
  if (definition.values ? !definition.values.includes(cleaned.value) : cleaned.value !== cleaned.label) throw new Error("Choose an existing meaning for this option.");
  return { key: key as DropdownKey, option: cleaned };
}

export function validateDropdownOptions(input: unknown): DropdownOptions {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Dropdown options must be an object.");
  const result: DropdownOptions = {};
  for (const [key, options] of Object.entries(input)) {
    if (!Array.isArray(options) || options.length > 100) throw new Error("A dropdown can have up to 100 added options.");
    result[key as DropdownKey] = options.map((option) => validateDropdownOption(key, option).option);
  }
  return result;
}

export function appendDropdownOption(options: DropdownOptions, key: DropdownKey, option: DropdownOption): DropdownOptions {
  const list = options[key] || [];
  const existing = list.find((item) => item.label.toLocaleLowerCase() === option.label.toLocaleLowerCase());
  if (existing) {
    if (existing.value !== option.value) throw new Error("That label already has a different meaning.");
    return options;
  }
  if (list.length >= 100) throw new Error("This dropdown already has 100 added options.");
  return { ...options, [key]: [...list, option] };
}
