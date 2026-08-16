"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpTrayIcon, ClipboardDocumentListIcon, DocumentTextIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { type AIWorkOrderImport, type Job, type WorkOrderFile } from "@/lib/types";
import { authFetch } from "@/lib/client-auth";

type ImportDraft = Pick<Job, "source" | "dealerName" | "factoryWorkOrderNumber" | "customerName" | "phone" | "address" | "city" | "homeSize" | "jobType" | "priority" | "status" | "dueDate" | "scopeNotes" | "partsNeeded">;

const defaultDraft: ImportDraft = {
  source: "Dealer",
  dealerName: "",
  factoryWorkOrderNumber: "",
  customerName: "",
  phone: "",
  address: "",
  city: "",
  homeSize: "",
  jobType: "",
  priority: "Normal",
  status: "New",
  dueDate: new Date().toLocaleDateString("en-CA"),
  scopeNotes: "",
  partsNeeded: "",
};

export function WorkOrderImport() {
  const router = useRouter();
  const [file, setFile] = useState<WorkOrderFile | null>(null);
  const [workOrderText, setWorkOrderText] = useState("");
  const [draft, setDraft] = useState<ImportDraft>(defaultDraft);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [savedDraft, setSavedDraft] = useState<{ draft: ImportDraft; file: WorkOrderFile | null; savedAt: string } | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [extractionReady, setExtractionReady] = useState(false);
  const importDraftKey = "company-command-import-draft";
  const supportedFileTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

  const parsedPreview = useMemo(() => parseWorkOrderText(workOrderText), [workOrderText]);
  const review = useMemo(() => reviewDraft(draft, Boolean(file || workOrderText.trim())), [draft, file, workOrderText]);

  useEffect(() => {
    fetch("/api/settings/status")
      .then((response) => response.json())
      .then((status) => setExtractionReady(Boolean(status.integrations?.openAiExtraction)))
      .catch(() => setExtractionReady(false));
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(importDraftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as typeof savedDraft;
        if (parsed?.draft) setSavedDraft(parsed);
      }
    } catch {
      setSavedDraft(null);
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!draftLoaded || !draftDirty) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(importDraftKey, JSON.stringify({ draft, file, savedAt: new Date().toISOString() }));
        setDraftStatus("Import draft saved on this phone.");
      } catch {
        setDraftStatus("Import draft could not be saved on this phone.");
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft, draftDirty, draftLoaded, file]);

  function updateDraft(updater: (old: ImportDraft) => ImportDraft) {
    setDraftDirty(true);
    setDraft(updater);
  }

  function updateWorkOrderText(value: string) {
    setDraftDirty(true);
    setWorkOrderText(value);
  }

  function restoreDraft() {
    if (!savedDraft) return;
    setDraft(savedDraft.draft);
    setFile(savedDraft.file || null);
    setSavedDraft(null);
    setDraftDirty(true);
    setDraftStatus("Import draft restored. Review it, then create the profile.");
  }

  function discardDraft() {
    window.localStorage.removeItem(importDraftKey);
    setSavedDraft(null);
    setDraftDirty(false);
    setDraftStatus("Import draft discarded from this phone.");
  }

  async function onFileSelected(selected: File | undefined) {
    if (!selected) return;
    setError("");
    if (!supportedFileTypes.has(selected.type)) { setError("Upload a PDF, JPG, PNG, or WEBP work-order file."); return; }
    const uploaded = await uploadFile(selected, "draft", "Work Order");
    if (!uploaded.storagePath) { setError("Private storage is required to extract this work order. Enter the job manually or try the upload again after storage is available."); return; }
    setDraftDirty(true);
    setFile({ ...uploaded, category: "Work Order" });
  }

  function applyParsed() {
    updateDraft((old) => ({ ...old, ...parsedPreview }));
    setDraftStatus("Detected text fields applied. Review before creating the customer profile.");
  }

  function setSourcePreset(source: ImportDraft["source"]) {
    updateDraft((old) => ({
      ...old,
      source,
      dealerName: source === "Dealer" ? old.dealerName : "",
      factoryWorkOrderNumber: source === "Factory" ? old.factoryWorkOrderNumber : "",
    }));
  }

  async function copyImportSummary() {
    await navigator.clipboard?.writeText(buildImportSummary(draft, review.score, file, workOrderText));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  function continueToJobForm(proposal: AIWorkOrderImport) {
    window.sessionStorage.setItem("company-command-work-order-import", JSON.stringify({ proposal, file }));
    window.localStorage.removeItem(importDraftKey);
    setDraftDirty(false);
    router.push("/jobs/new");
  }

  async function extractWorkOrder() {
    if (!file) { setError("Upload a work-order PDF or image before extracting."); return; }
    setExtracting(true); setError("");
    try {
      const response = await authFetch("/api/work-order-extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The work order could not be extracted.");
      continueToJobForm(result.proposal as AIWorkOrderImport);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The work order could not be extracted."); }
    finally { setExtracting(false); }
  }

  function continueManually(event: React.FormEvent) {
    event.preventDefault();
    continueToJobForm(toAIWorkOrderImport(draft));
  }

  return <form onSubmit={continueManually} className="mx-auto max-w-5xl space-y-5">
    <section className="card p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime text-ink"><ArrowUpTrayIcon className="size-6" /></span>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-widest text-forest">Work order import</p>
          <h1 className="text-3xl font-black">Create customer profile from paperwork</h1>
          <p className="mt-1 text-sm text-black/50">Upload a work-order PDF or image, review the proposed values, then apply them to the Job Form.</p>
        </div>
      </div>
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-black/15 bg-sand p-4 text-center">
        <DocumentTextIcon className="mb-2 size-8 text-forest" />
        <span className="font-black">{file ? file.fileName : "Tap to upload work order"}</span>
        <span className="mt-1 text-xs font-semibold text-black/45">PDF, JPG, PNG, or WEBP. Files stay private until you choose Extract.</span>
        <input type="file" className="hidden" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => onFileSelected(event.target.files?.[0])} />
      </label>
      {file && <div className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-black/55">Saved with profile: {file.fileName} · {(file.fileSize / 1024).toFixed(1)} KB</div>}
      <button type="button" onClick={extractWorkOrder} disabled={!file || extracting || !extractionReady} className="btn-primary mt-3 w-full disabled:opacity-50">{extracting ? "Extracting…" : "Extract to preview"}</button>
      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <label className="label">Work order text</label>
          <span className="text-xs font-black uppercase tracking-wide text-black/35">{workOrderText.trim().split(/\s+/).filter(Boolean).length} words</span>
        </div>
        <textarea className="field min-h-36 resize-y" value={workOrderText} onChange={(event) => updateWorkOrderText(event.target.value)} placeholder="Paste copied work-order text here if the upload is a photo or PDF. Later this is where OCR/AI extraction can plug in." />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={applyParsed} disabled={!workOrderText.trim()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black disabled:opacity-50"><SparklesIcon className="size-5" /> Auto-fill from text</button>
          <button type="button" onClick={copyImportSummary} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black"><ClipboardDocumentListIcon className="size-5" /> {copied ? "Summary Copied" : "Copy Import Summary"}</button>
        </div>
      </div>
      <DetectedFieldsPanel parsed={parsedPreview} onApply={applyParsed} />
      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-black">AI extraction status</h2>
            <p className="mt-1 text-sm text-black/50">True photo/PDF extraction is ready to plug in after an OpenAI API key is connected. For now, pasted text parsing and file storage are working.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${extractionReady ? "bg-forest text-white" : "bg-orange-100 text-orange-800"}`}>{extractionReady ? "Key connected" : "Key needed"}</span>
        </div>
      </div>
    </section>

    {(savedDraft || draftStatus) && <section className="card border-forest/20 bg-forest/5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-black text-forest">Import draft protection</h2>
          <p className="mt-1 text-sm font-semibold text-black/55">{savedDraft ? `A saved import draft from ${formatDraftTime(savedDraft.savedAt)} is available on this phone.` : draftStatus || "Import autosave is ready."}</p>
        </div>
        {savedDraft && <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={restoreDraft} className="min-h-11 rounded-xl bg-forest px-4 py-2 font-black text-white">Restore Draft</button>
          <button type="button" onClick={discardDraft} className="min-h-11 rounded-xl border border-black/10 bg-white px-4 py-2 font-black text-ink">Discard</button>
        </div>}
      </div>
    </section>}

    <div className="grid gap-5 lg:grid-cols-[1fr_.65fr]">
    <section className="card p-4 sm:p-6">
      <h2 className="mb-1 text-lg font-black">Detected customer profile</h2>
      <p className="mb-5 text-sm text-black/45">Review and edit before saving. This becomes the job/customer record.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Source" value={draft.source} options={["Dealer", "Factory", "Individual"]} onChange={(value) => updateDraft((old) => ({ ...old, source: value as ImportDraft["source"] }))} />
        <div className="sm:col-span-2 grid grid-cols-3 gap-2">
          {(["Dealer", "Factory", "Individual"] as ImportDraft["source"][]).map((source) => <button key={source} type="button" onClick={() => setSourcePreset(source)} className={`min-h-11 rounded-xl px-3 py-2 text-sm font-black ${draft.source === source ? "bg-forest text-white" : "bg-sand text-ink"}`}>{source}</button>)}
        </div>
        {draft.source === "Dealer" && <Input label="Dealer name" value={draft.dealerName} onChange={(value) => updateDraft((old) => ({ ...old, dealerName: value }))} />}
        {draft.source === "Factory" && <Input label="Factory work order #" value={draft.factoryWorkOrderNumber} onChange={(value) => updateDraft((old) => ({ ...old, factoryWorkOrderNumber: value }))} />}
        <Input label="Customer name" value={draft.customerName} onChange={(value) => updateDraft((old) => ({ ...old, customerName: value }))} required />
        <Input label="Phone" value={draft.phone} onChange={(value) => updateDraft((old) => ({ ...old, phone: value }))} />
        <Input label="Street address" value={draft.address} onChange={(value) => updateDraft((old) => ({ ...old, address: value }))} required wide />
        <Input label="City" value={draft.city} onChange={(value) => updateDraft((old) => ({ ...old, city: value }))} required />
        <Input label="Home size" value={draft.homeSize} onChange={(value) => updateDraft((old) => ({ ...old, homeSize: value }))} />
        <Input label="Job type" value={draft.jobType} onChange={(value) => updateDraft((old) => ({ ...old, jobType: value }))} />
        <Input label="Due date" type="date" value={draft.dueDate} onChange={(value) => updateDraft((old) => ({ ...old, dueDate: value }))} />
        <Select label="Priority" value={draft.priority} options={["Low", "Normal", "High", "Urgent"]} onChange={(value) => updateDraft((old) => ({ ...old, priority: value as ImportDraft["priority"] }))} />
        <Textarea label="Scope / work requested" value={draft.scopeNotes} onChange={(value) => updateDraft((old) => ({ ...old, scopeNotes: value }))} wide />
        <Textarea label="Parts needed" value={draft.partsNeeded} onChange={(value) => updateDraft((old) => ({ ...old, partsNeeded: value }))} wide />
      </div>
    </section>

    <aside className="card h-fit p-4 sm:p-6">
      <h2 className="text-lg font-black">Import review</h2>
      <p className="mt-1 text-sm text-black/45">Green means the profile is field-ready. Orange means review before dispatch.</p>
      <div className="mt-4 space-y-2">
        {review.items.map((item) => <div key={item.label} className={`rounded-xl p-3 ${item.ok ? "bg-forest/5" : "bg-orange-50"}`}>
          <p className={`text-xs font-black uppercase tracking-wide ${item.ok ? "text-forest" : "text-orange-800"}`}>{item.ok ? "Ready" : "Review"}</p>
          <p className="font-black">{item.label}</p>
          <p className="text-xs font-semibold text-black/45">{item.detail}</p>
        </div>)}
      </div>
      <div className="mt-4 rounded-xl bg-sand p-3">
        <p className="text-xs font-black uppercase tracking-wide text-black/35">Import score</p>
        <p className="mt-1 text-3xl font-black">{review.score}%</p>
        <p className="text-xs font-semibold text-black/45">{review.readyCount} of {review.items.length} checks ready</p>
      </div>
      <div className="mt-4 rounded-xl border border-black/10 bg-white p-3">
        <p className="text-xs font-black uppercase tracking-wide text-black/35">Duplicate check hints</p>
        <p className="mt-1 text-sm font-semibold text-black/55">Before saving, check existing jobs for the same phone, address, factory work order, or customer name. The new profile will still be editable after creation.</p>
        <a href={`/jobs?search=${encodeURIComponent(draft.phone || draft.address || draft.customerName)}`} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-sand px-3 py-2 text-xs font-black text-forest">Search existing jobs</a>
      </div>
    </aside>
    </div>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
    <div className="sticky bottom-20 z-10 rounded-2xl border border-black/10 bg-white/95 p-3 shadow-xl backdrop-blur lg:bottom-4">
      <button className="btn-primary w-full">Continue to Job Form</button>
    </div>
  </form>;
}

function parseWorkOrderText(text: string): Partial<ImportDraft> {
  const normalized = text.replace(/\r/g, "\n");
  const phone = normalized.match(/(?:phone|cell|mobile|tel)?\s*[:#-]?\s*(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i)?.[1] || "";
  const factoryWorkOrderNumber = findField(normalized, ["factory work order", "work order", "work order number", "order number", "wo", "w/o", "po", "po number", "claim"]);
  const dealerName = findField(normalized, ["dealer", "dealer name", "retailer", "sales center"]);
  const customerName = findField(normalized, ["customer", "customer name", "homeowner", "home owner", "owner", "name"]);
  const address = findField(normalized, ["address", "street", "site address", "service address", "install address", "location"]);
  const city = findField(normalized, ["city", "town"]);
  const homeSize = findField(normalized, ["home size", "size", "model", "unit size", "home model"]);
  const jobType = findField(normalized, ["job type", "type", "trade", "category", "service type", "work type"]);
  const dueDateText = findField(normalized, ["due date", "scheduled", "schedule date", "date", "needed by", "requested date"]);
  const scopeNotes = findMultiline(normalized, ["scope", "description", "work requested", "request", "notes", "problem", "issue"]);
  const partsNeeded = findMultiline(normalized, ["parts", "materials needed", "materials"]);
  const source = factoryWorkOrderNumber ? "Factory" : dealerName ? "Dealer" : "Individual";
  return clean({
    source,
    dealerName,
    factoryWorkOrderNumber,
    customerName,
    phone,
    address,
    city,
    homeSize,
    jobType,
    dueDate: parseDate(dueDateText),
    scopeNotes,
    partsNeeded,
  });
}

function findField(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(`\\b${label}\\b\\s*[:#-]?\\s*([^\\n]+)`, "i"));
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function findMultiline(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*[:#-]\\s*([\\s\\S]{1,500})(?:\\n\\s*(?:customer|phone|address|city|dealer|factory|parts|materials|due date|invoice)\\s*[:#-]|$)`, "i"));
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function parseDate(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString("en-CA");
  const match = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!match) return "";
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function clean(input: Partial<ImportDraft>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => Boolean(value))) as Partial<ImportDraft>;
}

function toAIWorkOrderImport(draft: ImportDraft): AIWorkOrderImport {
  return {
    customerName: draft.customerName,
    phone: draft.phone,
    address: draft.address,
    city: draft.city,
    jobType: draft.jobType,
    scopeNotes: draft.scopeNotes,
    factoryWorkOrderNumber: draft.factoryWorkOrderNumber,
    dueDate: draft.dueDate,
    partsNeeded: draft.partsNeeded,
    homeSize: draft.homeSize,
  };
}

function DetectedFieldsPanel({ parsed, onApply }: { parsed: Partial<ImportDraft>; onApply: () => void }) {
  const rows = [
    ["Source", parsed.source],
    ["Dealer", parsed.dealerName],
    ["Factory WO", parsed.factoryWorkOrderNumber],
    ["Customer", parsed.customerName],
    ["Phone", parsed.phone],
    ["Address", parsed.address],
    ["City", parsed.city],
    ["Home size", parsed.homeSize],
    ["Job type", parsed.jobType],
    ["Due date", parsed.dueDate],
    ["Scope", parsed.scopeNotes ? "Detected" : ""],
    ["Parts", parsed.partsNeeded ? "Detected" : ""],
  ].filter(([, value]) => Boolean(value));

  return <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-black">Detected text fields</h2>
        <p className="mt-1 text-sm font-semibold text-black/45">This is rule-based text detection, not AI. Review before saving.</p>
      </div>
      <span className="rounded-full bg-sand px-3 py-1 text-xs font-black text-black/45">{rows.length} found</span>
    </div>
    {rows.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {rows.map(([label, value]) => <div key={label} className="rounded-xl bg-sand p-3">
        <p className="text-xs font-black uppercase tracking-wide text-black/35">{label}</p>
        <p className="mt-1 truncate font-black">{value}</p>
      </div>)}
    </div> : <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">No fields detected yet. Paste work-order text or fill the customer profile manually.</p>}
    <button type="button" onClick={onApply} disabled={!rows.length} className="mt-3 min-h-11 w-full rounded-xl bg-forest px-4 py-2 font-black text-white disabled:opacity-50">Apply detected fields</button>
  </div>;
}

function reviewDraft(draft: ImportDraft, hasPaperwork: boolean) {
  const items = [
    { label: "Customer name", ok: Boolean(draft.customerName.trim()), detail: draft.customerName || "Required before saving" },
    { label: "Service address", ok: Boolean(draft.address.trim() && draft.city.trim()), detail: [draft.address, draft.city].filter(Boolean).join(", ") || "Street and city required" },
    { label: "Phone number", ok: Boolean(draft.phone.trim()), detail: draft.phone || "Helpful for field crew call/text buttons" },
    { label: "Source info", ok: draft.source === "Individual" || Boolean(draft.dealerName.trim() || draft.factoryWorkOrderNumber.trim()), detail: draft.source === "Individual" ? "Direct customer job" : draft.dealerName || draft.factoryWorkOrderNumber || "Dealer name or factory WO recommended" },
    { label: "Schedule date", ok: Boolean(draft.dueDate.trim()), detail: draft.dueDate || "Add a due date before dispatch" },
    { label: "Job type", ok: Boolean(draft.jobType.trim()), detail: draft.jobType || "Helps crew understand the work category" },
    { label: "Scope notes", ok: Boolean(draft.scopeNotes.trim()), detail: draft.scopeNotes ? "Work requested captured" : "Add scope so crew knows what to do" },
    { label: "Original paperwork", ok: hasPaperwork, detail: hasPaperwork ? "File/text will save to profile" : "Upload or paste work order before dispatch if possible" },
  ];
  const readyCount = items.filter((item) => item.ok).length;
  return { items, readyCount, score: Math.round((readyCount / items.length) * 100) };
}

function buildImportSummary(draft: ImportDraft, score: number, file: WorkOrderFile | null, workOrderText: string) {
  return [
    "Company Command import review",
    `Import score: ${score}%`,
    `Source: ${draft.source}`,
    `Dealer: ${draft.dealerName || "N/A"}`,
    `Factory WO: ${draft.factoryWorkOrderNumber || "N/A"}`,
    `Customer: ${draft.customerName || "Missing"}`,
    `Phone: ${draft.phone || "Missing"}`,
    `Address: ${[draft.address, draft.city].filter(Boolean).join(", ") || "Missing"}`,
    `Home size: ${draft.homeSize || "Unknown"}`,
    `Job type: ${draft.jobType || "Work order"}`,
    `Due date: ${draft.dueDate || "Not scheduled"}`,
    `Priority: ${draft.priority}`,
    `File: ${file?.fileName || "No file uploaded"}`,
    `Text captured: ${workOrderText.trim() ? "Yes" : "No"}`,
    "",
    "Scope:",
    draft.scopeNotes || "Missing",
    "",
    "Parts:",
    draft.partsNeeded || "None listed",
  ].join("\n");
}

function Input({ label, value, onChange, type = "text", required, wide }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; wide?: boolean }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="label">{label}</span><input className="field" type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label><span className="label">{label}</span><select className="field" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function Textarea({ label, value, onChange, wide }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="label">{label}</span><textarea className="field min-h-28 resize-y" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

async function uploadFile(file: File, jobId: string, category: string): Promise<WorkOrderFile> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("jobId", jobId);
  formData.append("category", category);
  const response = await authFetch("/api/files/upload", { method: "POST", body: formData });
  if (response.ok) return response.json();
  return fallbackFile(file, category);
}

function fallbackFile(file: File, category: string) {
  return new Promise<WorkOrderFile>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `file-${Date.now()}`,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      dataUrl: String(reader.result || ""),
      category: category as WorkOrderFile["category"],
      uploadedAt: new Date().toISOString(),
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatDraftTime(value: string) {
  if (!value) return "earlier";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "earlier";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
