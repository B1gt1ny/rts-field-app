import { notFound } from "next/navigation";
import { JobDetail } from "@/components/JobDetail";
import { getJob } from "@/lib/jobs";
import { canServerViewJob } from "@/lib/server-auth";
export const dynamic = "force-dynamic";
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const job = await getJob(id); if (!job) notFound(); if (!(await canServerViewJob(job))) notFound(); return <JobDetail initialJob={job} />; }
