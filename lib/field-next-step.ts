import { checklistProgress, closeoutChecks, hasActiveCorrections, openParts } from "./job-readiness";
import { getTravelState, getWorkSession } from "./field-activity";
import type { Job } from "./types";

export type FieldNextStep = {
  kind: "arrive" | "travel" | "start" | "continue" | "open" | "review";
  label: string;
  href: string;
  reason: string;
  attention?: FieldAttentionKind;
};

type FieldAttentionKind = "correction" | "parts" | "photos" | "paperwork" | "signoff";

export type FieldAttentionItem = {
  kind: FieldAttentionKind;
  label: string;
  detail: string;
};

export function primaryFieldAction(job: Job): Pick<FieldNextStep, "kind" | "label" | "href"> {
  const travel = getTravelState(job);
  const session = getWorkSession(job);
  if (travel.active) return { kind: "arrive", label: "Arrive at Job", href: `/jobs/${job.jobId}#time-log` };
  if (!travel.started && !session.started && ["New", "Scheduled"].includes(job.status)) return { kind: "travel", label: "Start Travel", href: `/jobs/${job.jobId}#time-log` };
  if (session.active) return { kind: "continue", label: "Continue Job", href: `/jobs/${job.jobId}` };
  if (travel.arrived && !session.started && ["New", "Scheduled"].includes(job.status)) return { kind: "start", label: "Start Job", href: `/jobs/${job.jobId}` };
  if (job.status === "In Progress") return { kind: "continue", label: "Continue Job", href: `/jobs/${job.jobId}` };
  if (job.status === "Waiting on Parts") return { kind: "open", label: "Review Parts", href: `/jobs/${job.jobId}#parts` };
  if (["New", "Scheduled"].includes(job.status)) return { kind: "start", label: "Start Job", href: `/jobs/${job.jobId}` };
  return { kind: "open", label: "Open Job", href: `/jobs/${job.jobId}` };
}

export function fieldNextStep(job: Job): FieldNextStep {
  const action = primaryFieldAction(job);
  const travel = getTravelState(job);
  const session = getWorkSession(job);

  if (action.kind !== "open") {
    if (travel.active) return { ...action, reason: "Travel is active. Tap Arrive at Job when you get on site." };
    if (!travel.started && !session.started) return { ...action, reason: "Start travel before arriving or starting work." };
    if (travel.arrived && !session.started) return { ...action, reason: "Arrived on site. Start the job when work begins." };
    return { ...action, reason: "Continue in the guided job workspace." };
  }

  if (hasActiveCorrections(job)) return { kind: "open", label: "Resolve Correction", href: `/jobs/${job.jobId}`, reason: "A manager correction needs attention before review.", attention: "correction" };
  if (job.status === "Needs Inspection") return { kind: "review", label: "Ready for Review", href: `/jobs/${job.jobId}#complete-job`, reason: "Field work is with the office for review." };
  if (job.status === "Waiting on Parts" && openParts(job).length) return { ...action, reason: "Open parts still need review.", attention: "parts" };

  const photoStep = checklistProgress(job).items.find((item) => !item.complete && /photo/i.test(item.label));
  if (photoStep) return { kind: "open", label: "Take Required Photos", href: `/jobs/${job.jobId}#photos`, reason: `${photoStep.label} is still incomplete.`, attention: "photos" };

  const paperwork = closeoutChecks(job).find((check) => !check.ok && check.label === "Paperwork");
  if (paperwork) return { kind: "open", label: "Complete Paperwork", href: `/jobs/${job.jobId}#paperwork`, reason: paperwork.detail, attention: "paperwork" };
  const signoff = closeoutChecks(job).find((check) => !check.ok && check.label === "Completion sign-off");
  if (signoff) return { kind: "open", label: "Complete Signoff", href: `/jobs/${job.jobId}#signoffs`, reason: signoff.detail, attention: "signoff" };

  return { ...action, reason: "Open the job to continue field work." };
}

export function fieldAttentionItems(job: Job, primary = fieldNextStep(job)) {
  const photoStep = checklistProgress(job).items.find((item) => !item.complete && /photo/i.test(item.label));
  const paperwork = closeoutChecks(job).find((check) => !check.ok && check.label === "Paperwork");
  const signoff = closeoutChecks(job).find((check) => !check.ok && check.label === "Completion sign-off");
  const parts = openParts(job);
  const candidates: FieldAttentionItem[] = [
    ...(hasActiveCorrections(job) ? [{ kind: "correction" as const, label: "Correction needs attention", detail: "A manager correction remains open." }] : []),
    ...(parts.length ? [{ kind: "parts" as const, label: "Parts still open", detail: `${parts.length} still open.` }] : []),
    ...(photoStep ? [{ kind: "photos" as const, label: "Photos still needed", detail: photoStep.label }] : []),
    ...(paperwork ? [{ kind: "paperwork" as const, label: "Paperwork incomplete", detail: paperwork.detail }] : []),
    ...(signoff ? [{ kind: "signoff" as const, label: "Customer signoff needed", detail: signoff.detail }] : []),
  ];
  const items = candidates.filter((item) => item.kind !== primary.attention);
  return { items: items.slice(0, 3), remaining: Math.max(0, items.length - 3) };
}
