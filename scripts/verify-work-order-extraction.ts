import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import * as extraction from "../lib/work-order-extraction";
import { aiWorkOrderImportFields } from "../lib/types";
import { buildWorkOrderExtractionDocument, buildWorkOrderExtractionSchema, getWorkOrderResponseText, isWorkOrderExtractionFileType, validateWorkOrderProposal, workOrderExtractionFileTypes } from "../lib/work-order-extraction";

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

// Documented raw API shape, reconstructed using synthetic text. The actual
// production payload was not retained; logs confirmed HTTP success and no
// top-level output_text. No paid provider requests are made by these fixtures.
const responseFor = (content: unknown[]) => ({ status: "completed", output: [
  { type: "reasoning", summary: [] },
  { type: "message", role: "assistant", status: "completed", content },
] });
const rawResponse = responseFor([{ type: "output_text", text: JSON.stringify({ customerName: "Verification Fixture", scopeNotes: "Inspect synthetic fixture only." }), annotations: [] }]);
const before = JSON.stringify(rawResponse);
const proposal = { customerName: "Verification Fixture", scopeNotes: "Inspect synthetic fixture only." };
assert.deepEqual(validateWorkOrderProposal(getWorkOrderResponseText(rawResponse)), proposal);
assert.deepEqual(validateWorkOrderProposal(getWorkOrderResponseText(rawResponse)), proposal, "Repeated parsing returns one unchanged proposal");
assert.equal(JSON.stringify(rawResponse), before, "Parsing has no mutation or job creation side effects");
assert.deepEqual(validateWorkOrderProposal(getWorkOrderResponseText(responseFor([
  { type: "output_text", text: '{"customerName":', annotations: [] },
  { type: "output_text", text: '"Verification Fixture"}', annotations: [] },
]))), { customerName: "Verification Fixture" });
for (const missing of [undefined, null, {}, { status: "completed", output: [] }, { ...rawResponse, status: "incomplete" }, responseFor([]), responseFor([{ type: "refusal", refusal: "Cannot extract" }]), responseFor([{ type: "output_text", text: 123 }])]) {
  assert.equal(getWorkOrderResponseText(missing), undefined);
  assert.equal(validateWorkOrderProposal(getWorkOrderResponseText(missing)), null);
}
for (const text of ["not JSON", '{"customerName":"Fixture","status":"Paid"}', '[{"customerName":"Fixture"}]']) {
  assert.equal(validateWorkOrderProposal(getWorkOrderResponseText(responseFor([{ type: "output_text", text, annotations: [] }]))), "invalid");
}
assert.equal(validateWorkOrderProposal(getWorkOrderResponseText(responseFor([{ type: "output_text", text: "{}", annotations: [] }]))), null);
assert.equal(validateWorkOrderProposal(getWorkOrderResponseText({ status: "completed", output: [...rawResponse.output, ...rawResponse.output] })), "invalid", "Duplicate complete JSON proposals must not become a job");

// Execute the real route with isolated mocks: no real provider, credentials,
// storage or database. Reject any unplanned dependency or network operation.
async function verifyRoute() {
  const localRequire = createRequire(`${process.cwd()}/package.json`);
  const ts = localRequire("typescript") as typeof import("typescript");
  const compiled = ts.transpileModule(readFileSync("app/api/work-order-extract/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  let providerResponse: unknown = rawResponse;
  let providerCalls = 0;
  let storageReads = 0;
  let authorized = true;
  const module = { exports: {} as { POST: (request: Request) => Promise<Response> } };
  runInNewContext(compiled, {
    exports: module.exports,
    require: (name: string) => {
      if (name === "next/server") return { NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } };
      if (name === "@/lib/auth") return { requireRole: async () => authorized ? { ok: true, user: { id: "fixture-admin" } } : { ok: false, status: 403, error: "Denied" } };
      if (name === "@/lib/work-order-extraction") return extraction;
      if (name === "@supabase/supabase-js") return { createClient: () => ({ storage: { from: () => ({ download: async () => { storageReads++; return { data: new Blob(["synthetic fixture"]), error: null }; } }) } }) };
      throw new Error(`Unplanned route dependency: ${name}`);
    },
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "synthetic", OPENAI_API_KEY: "synthetic" } },
    Buffer, AbortSignal,
    console: { warn: () => {} },
    fetch: async (url: string) => { assert.equal(url, "https://api.openai.com/v1/responses"); providerCalls++; return Response.json(providerResponse); },
  });
  const request = (consentToOpenAI: unknown = true) => new Request("https://fixture.invalid/api/work-order-extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consentToOpenAI, file: { storagePath: "draft/fixture-admin/work-order/fixture.pdf", fileName: "fixture.pdf", fileType: "application/pdf" } }) });
  for (const consent of [null, false, "true", 1, {}]) {
    assert.equal((await module.exports.POST(request(consent))).status, 400);
  }
  assert.equal((await module.exports.POST(new Request("https://fixture.invalid/api/work-order-extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: {} }) }))).status, 400);
  assert.equal(storageReads, 0, "Missing or non-boolean consent must not download a file");
  assert.equal(providerCalls, 0, "Missing or non-boolean consent must never call OpenAI");
  for (let repeat = 0; repeat < 2; repeat++) {
    const result = await module.exports.POST(request());
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { proposal }, "Route returns one review proposal, not a job");
  }
  assert.equal(providerCalls, 2, "Exactly one provider request per submitted extraction; no retries");
  for (const [payload, status] of [[responseFor([]), 422], [responseFor([{ type: "output_text", text: "bad JSON" }]), 502]] as const) {
    providerResponse = payload;
    const result = await module.exports.POST(request());
    assert.equal(result.status, status);
    assert.equal("proposal" in await result.json(), false);
  }
  authorized = false;
  const callsBeforeDenial = providerCalls;
  assert.equal((await module.exports.POST(request())).status, 403);
  assert.equal(providerCalls, callsBeforeDenial);
  assert.equal(storageReads, providerCalls, "Only storage download exists; no persistence/job write API is available");
  console.log("Static extraction, raw Responses parsing, and mocked real-route fixtures passed; zero live requests/writes.");
}
verifyRoute().catch((error) => { console.error(error); process.exitCode = 1; });
