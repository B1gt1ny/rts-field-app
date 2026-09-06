import { strict as assert } from "node:assert";
import { aiWorkOrderImportFields } from "../lib/types";
import { buildWorkOrderExtractionDocument, buildWorkOrderExtractionSchema, isWorkOrderExtractionFileType, validateWorkOrderProposal, workOrderExtractionFileTypes } from "../lib/work-order-extraction";

assert.deepEqual(workOrderExtractionFileTypes, ["application/pdf", "image/jpeg", "image/png", "image/webp"]);
assert.equal(isWorkOrderExtractionFileType("application/pdf"), true);
assert.equal(isWorkOrderExtractionFileType("image/jpeg"), true);
assert.equal(isWorkOrderExtractionFileType("image/png"), true);
assert.equal(isWorkOrderExtractionFileType("image/webp"), true);
assert.equal(isWorkOrderExtractionFileType("text/plain"), false);

assert.deepEqual(buildWorkOrderExtractionDocument("application/pdf", "work-order.pdf", "JVBERi0x"), {
  type: "input_file",
  filename: "work-order.pdf",
  file_data: "data:application/pdf;base64,JVBERi0x",
  detail: "high",
});

assert.deepEqual(buildWorkOrderExtractionDocument("image/jpeg", "work-order.jpg", "/9j/4AAQ"), {
  type: "input_image",
  image_url: "data:image/jpeg;base64,/9j/4AAQ",
  detail: "high",
});

assert.deepEqual(buildWorkOrderExtractionDocument("image/png", "work-order.png", "iVBORw0KGgo"), {
  type: "input_image",
  image_url: "data:image/png;base64,iVBORw0KGgo",
  detail: "high",
});

assert.deepEqual(buildWorkOrderExtractionDocument("image/webp", "work-order.webp", "UklGRg"), {
  type: "input_image",
  image_url: "data:image/webp;base64,UklGRg",
  detail: "high",
});

const schema = buildWorkOrderExtractionSchema();
assert.deepEqual(schema.required, aiWorkOrderImportFields);
assert.deepEqual(schema.properties.customerName, { type: ["string", "null"] });
assert.deepEqual(schema.properties.returnVisitRequired, { type: ["boolean", "null"] });

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
  phone: null,
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
