import { strict as assert } from "node:assert";
import { billingBoardState, paymentFollowUpForBilling, billingBlockers, managerApprovalBlockers, checklistProgress, closeoutChecks, dispatchBlockers, hasOpenParts, isReadyForBilling, openParts } from "../lib/job-readiness";
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

// A handoff to the office is not evidence of an invoice sent to the customer.
const withBilling = { ...billingReadyWithOpenParts, invoiceStatus: "Sent to Billing", invoiceDate: "2026-10-01", paymentDueDate: "2026-10-02" };
assert.equal(billingBoardState(withBilling), "With billing");
assert.equal(paymentFollowUpForBilling(withBilling), null);
const invoiceSent = { ...withBilling, invoiceStatus: "Sent" };
assert.equal(billingBoardState(invoiceSent), "Invoice sent");
assert.equal(paymentFollowUpForBilling(invoiceSent, new Date("2026-10-10T00:00:00").getTime())?.pastDue, true);
assert.equal(billingBoardState({ ...withBilling, status: "Billed" }), "Invoice sent");
assert.equal(billingBoardState({ ...withBilling, status: "Paid" }), "Paid / Complete");
assert.equal(billingBoardState({ ...withBilling, invoiceStatus: "Paid" }), "Paid / Complete");
assert.equal(billingBoardState({ ...billingReadyWithOpenParts, completionNotes: "" }), "Not Ready");
assert.equal(isReadyForBilling({ ...billingReadyWithOpenParts, completionNotes: "" }), false);
assert.equal(billingBoardState(billingReadyWithOpenParts), "Ready to Invoice");

const checklist = checklistProgress(job({ checklist: makeChecklist() }));
assert.deepEqual(checklist.items.slice(0, 3).map((item) => item.label), ["Work order", "Scope reviewed", "Parts picked up"]);
assert.equal(checklist.items.find((item) => item.label === "Parts picked up")?.optional, true);
assert.equal(checklist.total, makeChecklist().length - 1);

const awaitingReview = { ...billingReadyWithOpenParts, status: "Needs Inspection" as const };
assert.equal(billingBlockers(awaitingReview).some((item) => item.label === "Job complete"), true);
assert.equal(managerApprovalBlockers(awaitingReview).length, 0);
assert.equal(isReadyForBilling(awaitingReview), false);
for (const missing of [{ completionNotes: "" }, { paperworkPickedUp: false }, { signoffs: [] }]) {
  assert.ok(managerApprovalBlockers({ ...awaitingReview, ...missing }).length > 0);
}
assert.ok(managerApprovalBlockers({ ...awaitingReview, timeEntries: [{ id: "work", type: "Work started", createdAt: "2026-10-10T08:00:00Z", employeeName: "Fixture", notes: "" }] }).some((item) => item.label === "Work session"));
function notificationLogged(message: string, type: NonNullable<Job["activityLog"]>[number]["type"] = "Note") {
  const candidate = job({ checklist: makeChecklist(), activityLog: [{ id: "contact-proof", type, message, createdAt: "2026-10-10T08:00:00Z", createdBy: "Fixture" }] });
  const closeout = closeoutChecks(candidate).find((item) => item.label === "Customer/source notified")?.ok;
  const checklist = checklistProgress(candidate).items.find((item) => item.label === "Customer/source notified")?.complete;
  assert.equal(checklist, closeout);
  return closeout;
}
for (const message of [
  "No real customer contacted and no external message sent.",
  "Customer has not been notified; call tomorrow.",
  "Need to send text and leave voicemail.",
  "Customer contacted", // Untyped scratch notes are not notification records.
]) assert.equal(notificationLogged(message), false);
assert.equal(notificationLogged("Customer contacted", "Customer"), true);
assert.equal(notificationLogged("Dealer/factory notified", "Source"), true);
assert.equal(notificationLogged("Job marked complete. Customer/source notified.", "Status"), true);
assert.equal(notificationLogged("Job marked complete. Customer/source notified. Invoice marked ready.", "Status"), true);
assert.equal(notificationLogged("Job marked complete. Invoice marked ready.", "Status"), false);
console.log("parts closeout, billing handoff, manager approval and explicit notification checks passed");
