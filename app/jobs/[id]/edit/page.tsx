import { notFound } from "next/navigation";
import { JobForm } from "@/components/JobForm";
import { getJob } from "@/lib/jobs";
import { requireServerRole } from "@/lib/server-auth";
export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) { await requireServerRole(["Admin", "Manager"]); const { id } = await params; const job = await getJob(id); if (!job) notFound(); return <div className="mx-auto max-w-4xl"><div className="mb-6"><p className="text-sm font-extrabold uppercase tracking-widest text-forest">{job.jobId}</p><h1 className="text-3xl font-black">Edit Job</h1></div><JobForm initialJob={job} /></div>; }
