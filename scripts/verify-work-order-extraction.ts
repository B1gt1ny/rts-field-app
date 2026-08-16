import { strict as assert } from "node:assert";
import { validateWorkOrderProposal } from "../lib/work-order-extraction";

const complete = validateWorkOrderProposal(JSON.stringify({
  customerName: "Jordan Lee",
  address: " 42 Service Lane ",
  city: "Exampletown",
  factoryWorkOrderNumber: "WO-0147-A",
  serialUnitNumber: "UNIT-9X-0042",
  scopeNotes: "Replace damaged exterior trim.",
  dueDate: "2026-08-24",
  scheduledTime: "09:30",
  returnVisitRequired: false,
}));
assert.deepEqual(complete, {
  customerName: "Jordan Lee",
  address: "42 Service Lane",
  city: "Exampletown",
  factoryWorkOrderNumber: "WO-0147-A",
  serialUnitNumber: "UNIT-9X-0042",
  scopeNotes: "Replace damaged exterior trim.",
  dueDate: "2026-08-24",
  scheduledTime: "09:30",
  returnVisitRequired: false,
});

assert.deepEqual(validateWorkOrderProposal(JSON.stringify({
  customerName: "  Morgan Cruz ",
  address: "8 Field Road",
  scopeNotes: "Inspect the entry door.",
  city: "",
  partsNeeded: "   ",
})), {
  customerName: "Morgan Cruz",
  address: "8 Field Road",
  scopeNotes: "Inspect the entry door.",
});

for (const invalid of [
  { dueDate: "08/24/2026" },
  { dueDate: "2026-02-30" },
  { scheduledTime: "9:30 AM" },
  { scheduledTime: "24:00" },
  { returnVisitRequired: "false" },
  { customerName: "Jordan Lee", status: "New" },
  { customerName: "Jordan Lee", priority: "High" },
]) assert.equal(validateWorkOrderProposal(JSON.stringify(invalid)), "invalid");

console.log("Static work-order extraction validation fixtures passed.");
