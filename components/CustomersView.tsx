import Link from "next/link";
import { BanknotesIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon, MapPinIcon, PhoneIcon, UserCircleIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

type CustomerGroup = {
  key: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  jobs: Job[];
};

export function CustomersView({ jobs }: { jobs: Job[] }) {
  const customers = groupCustomers(jobs);
  const riskyCustomers = customers.filter((customer) => customerRisk(customer).score > 0).length;
  const openParts = jobs.filter((job) => hasOpenParts(job)).length;
  const openFollowUps = jobs.reduce((total, job) => total + openFollowUpCount(job), 0);
  const invoiceAttention = jobs.filter((job) => needsInvoiceAttention(job)).length;
  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex items-start gap-3">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><UserCircleIcon className="size-7" /></span>
      <div>
        <p className="text-sm font-extrabold uppercase tracking-widest text-forest">Customer profiles</p>
        <h1 className="text-3xl font-black">Customers</h1>
        <p className="mt-1 text-sm text-black/50">Grouped customer history from job records. Open the latest job for full paperwork, photos, parts, and billing details.</p>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <Metric label="Customers" value={customers.length} />
      <Metric label="Jobs" value={jobs.length} />
      <Metric label="Repeat jobs" value={customers.filter((customer) => customer.jobs.length > 1).length} />
      <Metric label="Need attention" value={riskyCustomers} tone={riskyCustomers ? "orange" : "green"} />
      <Metric label="Open parts" value={openParts} tone={openParts ? "orange" : "green"} />
      <Metric label="Follow-ups" value={openFollowUps + invoiceAttention} tone={openFollowUps + invoiceAttention ? "orange" : "green"} />
    </div>

    <section className="card overflow-hidden">
      <div className="bg-ink p-4 text-white">
        <p className="text-xs font-black uppercase tracking-widest text-lime">Customer command</p>
        <h2 className="mt-1 text-2xl font-black">Who needs attention?</h2>
        <p className="mt-1 text-sm text-white/55">Phone-first customer list for repeat jobs, open parts, follow-ups, and billing risk.</p>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {customers.filter((customer) => customerRisk(customer).score > 0).slice(0, 6).map((customer) => <AttentionCustomer key={customer.key} customer={customer} />)}
        {!customers.some((customer) => customerRisk(customer).score > 0) && <p className="rounded-2xl bg-sand p-4 text-sm font-bold text-black/45 md:col-span-2 xl:col-span-3">No customers need special attention right now.</p>}
      </div>
    </section>

    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {customers.length ? customers.map((customer) => <CustomerCard key={customer.key} customer={customer} />) : <div className="card p-8 text-center md:col-span-2 xl:col-span-3"><p className="font-black">No customers found.</p></div>}
    </section>
  </div>;
}

function CustomerCard({ customer }: { customer: CustomerGroup }) {
  const latest = customer.jobs[0];
  const activeCount = customer.jobs.filter((job) => !["Complete", "Billed", "Paid"].includes(job.status)).length;
  const risk = customerRisk(customer);
  const followUps = customer.jobs.reduce((total, job) => total + openFollowUpCount(job), 0);
  const partsCount = customer.jobs.filter((job) => hasOpenParts(job)).length;
  return <div className="card p-4">
    <Link href={`/jobs/${latest.jobId}`} className="block">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide text-forest">{customer.jobs.length} {customer.jobs.length === 1 ? "job" : "jobs"} · {activeCount} active</p>
        {risk.score > 0 && <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-orange-800">{risk.score} flags</span>}
      </div>
      <h2 className="mt-1 text-xl font-black">{customer.name}</h2>
      <p className="mt-1 text-sm font-semibold text-black/50">{customer.address}, {customer.city}</p>
      <div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={latest.status} /><span className="rounded-full bg-sand px-3 py-1 text-xs font-black text-black/45">Latest: {latest.jobId}</span></div>
    </Link>
    {(risk.reasons.length > 0 || followUps > 0 || partsCount > 0) && <div className="mt-4 grid grid-cols-3 gap-2">
      <MiniFlag label="Parts" value={partsCount} icon={<WrenchScrewdriverIcon />} hot={partsCount > 0} />
      <MiniFlag label="Follow-up" value={followUps} icon={<ExclamationTriangleIcon />} hot={followUps > 0} />
      <MiniFlag label="Billing" value={customer.jobs.filter((job) => needsInvoiceAttention(job)).length} icon={<BanknotesIcon />} hot={customer.jobs.some((job) => needsInvoiceAttention(job))} />
    </div>}
    <div className="mt-4 grid grid-cols-3 gap-2">
      <a href={`tel:${customer.phone}`} className={`min-h-11 rounded-xl px-2 py-2 text-center text-xs font-black ${customer.phone ? "bg-forest text-white" : "pointer-events-none bg-black/5 text-black/25"}`}><PhoneIcon className="mx-auto mb-0.5 size-4" />Call</a>
      <a href={`sms:${customer.phone}`} className={`min-h-11 rounded-xl px-2 py-2 text-center text-xs font-black ${customer.phone ? "bg-lime text-ink" : "pointer-events-none bg-black/5 text-black/25"}`}>Text</a>
      <a href={`https://maps.google.com/?q=${encodeURIComponent(`${customer.address}, ${customer.city}`)}`} target="_blank" className="min-h-11 rounded-xl bg-ink px-2 py-2 text-center text-xs font-black text-white"><MapPinIcon className="mx-auto mb-0.5 size-4" />Map</a>
    </div>
    <div className="mt-2 grid grid-cols-3 gap-2">
      <Link href={`/jobs/${latest.jobId}`} className="min-h-11 rounded-xl border border-black/10 bg-white px-2 py-2 text-center text-xs font-black text-ink">Profile</Link>
      <Link href={`/jobs/${latest.jobId}#paperwork`} className="min-h-11 rounded-xl border border-black/10 bg-white px-2 py-2 text-center text-xs font-black text-ink"><ClipboardDocumentListIcon className="mx-auto mb-0.5 size-4" />Files</Link>
      <Link href={`/jobs/${latest.jobId}#billing-handoff`} className="min-h-11 rounded-xl border border-black/10 bg-white px-2 py-2 text-center text-xs font-black text-ink"><BanknotesIcon className="mx-auto mb-0.5 size-4" />Billing</Link>
    </div>
    {customer.jobs.length > 1 && <div className="mt-4 rounded-xl bg-sand p-3">
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-black/35">Recent history</p>
      <div className="space-y-1">{customer.jobs.slice(0, 3).map((job) => <Link key={job.jobId} href={`/jobs/${job.jobId}`} className="flex justify-between gap-2 text-xs font-bold text-black/55"><span>{job.jobId}</span><span>{job.status}</span></Link>)}</div>
    </div>}
  </div>;
}

function AttentionCustomer({ customer }: { customer: CustomerGroup }) {
  const latest = customer.jobs[0];
  const risk = customerRisk(customer);
  return <Link href={`/jobs/${latest.jobId}`} className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-orange-800">{risk.score} attention flag{risk.score === 1 ? "" : "s"}</p>
        <h3 className="mt-1 text-lg font-black">{customer.name}</h3>
        <p className="mt-1 text-xs font-semibold text-black/45">{customer.jobs.length} job{customer.jobs.length === 1 ? "" : "s"} · latest {latest.jobId}</p>
      </div>
      <ExclamationTriangleIcon className="size-6 shrink-0 text-orange-700" />
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {risk.reasons.slice(0, 3).map((reason) => <span key={reason} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-orange-900">{reason}</span>)}
    </div>
  </Link>;
}

function MiniFlag({ label, value, icon, hot }: { label: string; value: number; icon: React.ReactNode; hot: boolean }) {
  return <div className={`rounded-xl p-3 ${hot ? "bg-orange-50 text-orange-900" : "bg-sand text-black/40"}`}>
    <div className="[&>svg]:size-5">{icon}</div>
    <p className="mt-1 text-xl font-black">{value}</p>
    <p className="text-[10px] font-black uppercase tracking-wide">{label}</p>
  </div>;
}

function customerRisk(customer: CustomerGroup) {
  const reasons: string[] = [];
  const waiting = customer.jobs.filter((job) => job.status === "Waiting on Parts" || hasOpenParts(job)).length;
  const followUps = customer.jobs.reduce((total, job) => total + openFollowUpCount(job), 0);
  const billing = customer.jobs.filter((job) => needsInvoiceAttention(job)).length;
  const urgent = customer.jobs.filter((job) => job.priority === "Urgent" || job.priority === "High").length;
  const stale = customer.jobs.filter((job) => isPastDue(job) && !["Complete", "Billed", "Paid"].includes(job.status)).length;
  if (waiting) reasons.push(`${waiting} parts`);
  if (followUps) reasons.push(`${followUps} follow-up`);
  if (billing) reasons.push(`${billing} billing`);
  if (urgent) reasons.push(`${urgent} priority`);
  if (stale) reasons.push(`${stale} past due`);
  return { score: waiting + followUps + billing + urgent + stale, reasons };
}

function hasOpenParts(job: Job) {
  return job.status === "Waiting on Parts" || Boolean(job.partsNeeded?.trim()) || (job.partsItems || []).some((part) => ["Needed", "Ordered", "Picked up"].includes(part.status));
}

function openFollowUpCount(job: Job) {
  return (job.activityLog || []).filter((entry) => entry.notify && !entry.resolvedAt).length;
}

function needsInvoiceAttention(job: Job) {
  return ["Complete", "Billed"].includes(job.status) && !["Paid", "Sent", "Sent to Billing"].includes(job.invoiceStatus || "");
}

function isPastDue(job: Job) {
  if (!job.dueDate) return false;
  return job.dueDate < new Date().toLocaleDateString("en-CA");
}

function groupCustomers(jobs: Job[]) {
  const map = new Map<string, CustomerGroup>();
  for (const job of [...jobs].sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || ""))) {
    const key = normalizeKey(job.phone || `${job.customerName}-${job.address}-${job.city}`);
    const current = map.get(key);
    if (current) current.jobs.push(job);
    else map.set(key, {
      key,
      name: job.customerName || "Unknown customer",
      phone: job.phone,
      address: job.address,
      city: job.city,
      jobs: [job],
    });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/\D/g, "") || value.toLowerCase().replace(/\s+/g, "-");
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "green" | "orange" }) {
  const toneClass = tone === "green" ? "bg-forest/5" : tone === "orange" ? "bg-orange-50" : "";
  return <div className={`card p-4 ${toneClass}`}>
    <p className="text-3xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold text-black/45">{label}</p>
  </div>;
}
