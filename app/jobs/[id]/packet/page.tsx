import { notFound } from "next/navigation";
import { CloseoutPacket } from "@/components/CloseoutPacket";
import { getJob } from "@/lib/jobs";
import { canServerViewJob } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function JobPacketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  if (!(await canServerViewJob(job))) notFound();
  return <CloseoutPacket job={job} />;
}
