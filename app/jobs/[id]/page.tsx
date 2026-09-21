import { notFound } from "next/navigation";
import { JobDetail } from "@/components/JobDetail";
import { getJob } from "@/lib/jobs";
import { canServerViewJob, getServerUser } from "@/lib/server-auth";
import { getUserRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const job = await getJob(id); if (!job) notFound(); if (!(await canServerViewJob(job))) notFound(); const user = await getServerUser(); const initialJob = getUserRole(user) === "Employee" ? sanitizeEmployeeJob(job) : job; return <JobDetail initialJob={initialJob} />; }

function sanitizeEmployeeJob(job: NonNullable<Awaited<ReturnType<typeof getJob>>>) { return { ...job, activityLog: (job.activityLog || []).filter((entry) => !["Admin", "Manager"].includes(entry.audience || "") && entry.type !== "Invoice"), factoryCost: job.factoryCost ? { ...job.factoryCost, mileageRate: "", hourlyRate: "", helperRate: "", perDiemRate: "" } : job.factoryCost }; }
