import Link from "next/link";
import { CalendarDaysIcon, MapPinIcon, PhoneIcon } from "@heroicons/react/24/outline";
import { getEmployees } from "@/lib/employees";
import { getJobs } from "@/lib/jobs";
import { requireServerRole } from "@/lib/server-auth";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function EmployeeAssignmentsPage() {
  await requireServerRole(["Admin", "Manager"]);
  const [jobs, employees] = await Promise.all([getJobs(), getEmployees()]);
  const activeJobs = jobs.filter((job) => !["Complete", "Billed", "Paid"].includes(job.status));
  const activeEmployees = employees.filter((employee) => employee.active);
  const today = new Date().toLocaleDateString("en-CA");
  return <><div className="mb-6 flex items-end justify-between gap-3"><div><p className="mb-1 text-sm font-extrabold uppercase tracking-widest text-forest">Team dispatch</p><h1 className="text-3xl font-black">Employee Assignments</h1><p className="mt-2 text-black/50">Daily handoff by employee. Today’s work is pinned first.</p></div><Link href="/employees" className="btn-secondary">Edit employees</Link></div><div className="grid gap-4 lg:grid-cols-2">{activeEmployees.map((employee) => {
    const assigned = activeJobs.filter((job) => job.fullCrew || job.assignedEmployeeIds?.includes(employee.id) || (!job.assignedEmployeeIds?.length && job.assignedCrew === employee.name));
    const todayJobs = assigned.filter((job) => job.dueDate === today);
    const ordered = [...todayJobs, ...assigned.filter((job) => job.dueDate !== today)];
    return <section key={employee.id} className="card overflow-hidden"><div className="flex items-center justify-between border-b border-black/5 p-4"><div><h2 className="text-lg font-black">{employee.name}</h2><p className="text-xs font-bold text-black/40">{todayJobs.length} today · {assigned.length} active</p></div><span className="grid size-10 place-items-center rounded-full bg-forest text-sm font-black text-white">{employee.name.slice(0, 2).toUpperCase()}</span></div><div className="divide-y divide-black/5">{ordered.length ? ordered.map((job) => <div key={job.jobId} className={`p-4 hover:bg-black/[.02] ${job.dueDate === today ? "bg-lime/10" : ""}`}>
      <Link href={`/jobs/${job.jobId}`} className="flex min-h-20 items-start justify-between gap-3">
        <div><p className="text-xs font-extrabold text-forest">{job.jobId}{job.fullCrew ? " · Full Crew" : ""}{job.dueDate === today ? " · TODAY" : ""}</p><p className="font-extrabold">{job.customerName}</p><p className="text-xs text-black/45">{job.city} · Due {job.dueDate ? new Date(`${job.dueDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "not scheduled"}</p></div><StatusBadge status={job.status} />
      </Link>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <a href={`tel:${job.phone}`} className={`min-h-10 rounded-lg px-2 py-2 text-center text-xs font-black ${job.phone ? "bg-forest text-white" : "pointer-events-none bg-black/5 text-black/25"}`}><PhoneIcon className="mx-auto mb-0.5 size-4" />Call</a>
        <a href={`https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city}`)}`} target="_blank" className="min-h-10 rounded-lg bg-ink px-2 py-2 text-center text-xs font-black text-white"><MapPinIcon className="mx-auto mb-0.5 size-4" />Map</a>
        <Link href={`/jobs/${job.jobId}#scheduling`} className="min-h-10 rounded-lg bg-white px-2 py-2 text-center text-xs font-black text-forest"><CalendarDaysIcon className="mx-auto mb-0.5 size-4" />Schedule</Link>
      </div>
    </div>) : <p className="p-6 text-center text-sm text-black/35">No active jobs assigned</p>}</div></section>;
  })}</div>{!activeEmployees.length && <div className="card py-16 text-center"><p className="font-extrabold">No active employees</p><Link href="/employees" className="mt-2 inline-block text-sm font-bold text-forest">Add an employee</Link></div>}</>;
}
