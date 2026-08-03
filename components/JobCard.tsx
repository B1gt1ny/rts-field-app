import Link from "next/link";
import { BanknotesIcon, BellAlertIcon, CalendarDaysIcon, MapPinIcon, WrenchScrewdriverIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/lib/types";
import { PriorityBadge, StatusBadge } from "./StatusBadge";

export function JobCard({ job }: { job: Job }) {
  const date = job.dueDate ? new Date(`${job.dueDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No date";
  const flags = cardFlags(job);
  return <Link href={`/jobs/${job.jobId}`} className="card block p-4 transition hover:-translate-y-0.5 hover:border-forest/20 hover:shadow-lg">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div><div className="mb-1 flex items-center gap-2"><span className="text-xs font-extrabold tracking-wide text-forest">{job.jobId}</span><span className="text-black/20">•</span><span className="text-xs font-bold text-black/45">{job.source}</span></div><h3 className="text-lg font-extrabold leading-tight">{job.customerName}</h3></div>
      <StatusBadge status={job.status} />
    </div>
    <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-black/55">{job.jobType} — {job.scopeNotes}</p>
    {flags.length > 0 && <div className="mb-3 flex flex-wrap gap-2">
      {flags.map((flag) => <span key={flag.label} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${flag.className}`}>{flag.icon}{flag.label}</span>)}
    </div>}
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-black/5 pt-3 text-xs font-semibold text-black/50">
      <span className="flex items-center gap-1.5"><MapPinIcon className="size-4 text-forest" />{job.city}</span>
      <span className="flex items-center gap-1.5"><CalendarDaysIcon className="size-4 text-forest" />{date}</span>
      <span className="flex items-center gap-1.5"><UserGroupIcon className="size-4 text-forest" />{job.assignedCrew || "Unassigned"}</span>
      <PriorityBadge priority={job.priority} />
    </div>
  </Link>;
}

function cardFlags(job: Job) {
  const openParts = job.status === "Waiting on Parts" || Boolean(job.partsNeeded?.trim()) || (job.partsItems || []).some((part) => ["Needed", "Ordered", "Picked up"].includes(part.status));
  const followUps = (job.activityLog || []).filter((entry) => entry.notify && !entry.resolvedAt).length;
  const billing = ["Complete", "Billed"].includes(job.status) && !["Paid", "Sent", "Sent to Billing"].includes(job.invoiceStatus || "");
  const flags: Array<{ label: string; icon: React.ReactNode; className: string }> = [];
  if (openParts) flags.push({ label: "Parts", icon: <WrenchScrewdriverIcon className="size-3.5" />, className: "bg-orange-100 text-orange-900" });
  if (followUps) flags.push({ label: `${followUps} follow-up`, icon: <BellAlertIcon className="size-3.5" />, className: "bg-red-100 text-red-900" });
  if (billing) flags.push({ label: "Billing", icon: <BanknotesIcon className="size-3.5" />, className: "bg-blue-100 text-blue-900" });
  return flags;
}
