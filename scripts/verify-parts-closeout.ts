import { strict as assert } from "node:assert";
import { billingBlockers, checklistProgress, dispatchBlockers, hasOpenParts, isReadyForBilling, openParts } from "../lib/job-readiness";
import { emptyJob, makeChecklist, type Job } from "../lib/types";

function job(overrides: Partial<Job>): Job {
  return { ...emptyJob, ...overrides };
}

const legacyParts = job({ partsNeeded: "Need trim and screws" });
assert.equal(hasOpenParts(legacyParts), true);
assert.equal(billingBlockers(legacyParts).some((blocker) => /parts/i.test(blocker.label)), false);

const closedTrackedParts = job({
  partsNeeded: "Need trim and screws",
  partsItems: [
    { id: "part-1", name: "Trim", quantity: "1", status: "Installed", requestedBy: "Field", requestedAt: "2026-09-08T00:00:00.000Z" },
    { id: "part-2", name: "Screws", quantity: "1", status: "Not needed", requestedBy: "Field", requestedAt: "2026-09-08T00:00:00.000Z" },
  ],
});
assert.equal(openParts(closedTrackedParts).length, 0);
assert.equal(hasOpenParts(closedTrackedParts), false);

const openTrackedPart = job({
  partsNeeded: "Need trim and screws",
  partsItems: [{ id: "part-1", name: "Trim", quantity: "1", status: "Picked up", requestedBy: "Field", requestedAt: "2026-09-08T00:00:00.000Z" }],
});
assert.equal(hasOpenParts(openTrackedPart), true);

const billingReadyWithOpenParts = job({
  status: "Complete",
  completionNotes: "Work completed.",
  afterPhotos: ["https://example.com/after.jpg"],
  paperworkPickedUp: true,
  signoffs: [{ id: "signoff-1", type: "Completion Sign-off", signerName: "Customer", signerRole: "Customer", accepted: true, signedAt: "2026-09-08T00:00:00.000Z", typedSignature: "Customer" }],
  invoiceStatus: "Ready",
  partsItems: openTrackedPart.partsItems,
});
assert.equal(isReadyForBilling(billingReadyWithOpenParts), true);
assert.equal(billingBlockers(billingReadyWithOpenParts).some((blocker) => /parts/i.test(blocker.label)), false);
assert.equal(dispatchBlockers(openTrackedPart).some((blocker) => /parts|materials/i.test(blocker.label)), false);

const checklist = checklistProgress(job({ checklist: makeChecklist() }));
assert.deepEqual(checklist.items.slice(0, 3).map((item) => item.label), ["Work order", "Scope reviewed", "Parts picked up"]);
assert.equal(checklist.items.find((item) => item.label === "Parts picked up")?.optional, true);
assert.equal(checklist.total, makeChecklist().length - 1);

console.log("parts closeout checks passed");
