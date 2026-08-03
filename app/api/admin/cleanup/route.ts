import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getJobs, deleteJob } from "@/lib/jobs";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

function isObviousTestJob(job: { jobId?: string; customerName?: string; address?: string }) {
  const text = [job.jobId, job.customerName, job.address].join(" ").toLowerCase();
  return /\b(test|smoke|sample|demo)\b/.test(text);
}

export async function GET(request: Request) {
  const access = await requireRole(request, ["Admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const jobs = await getJobs();
  const testJobs = jobs.filter(isObviousTestJob);
  const database = db();
  const storagePreview = database
    ? await database.storage.from("job-files").list("smoke-test", { limit: 100 }).catch(() => ({ data: [] as { name: string }[] }))
    : { data: [] as { name: string }[] };

  return NextResponse.json({
    testJobs: testJobs.map((job) => ({ jobId: job.jobId, customerName: job.customerName })),
    smokeTestFiles: storagePreview.data?.map((file) => `smoke-test/${file.name}`) || [],
    note: "Only obvious test/smoke/sample/demo records are included.",
  });
}

export async function POST(request: Request) {
  const access = await requireRole(request, ["Admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const input = await request.json() as { confirm?: string };
  if (input.confirm !== "DELETE TEST DATA") return NextResponse.json({ error: "Type DELETE TEST DATA to remove obvious test records." }, { status: 400 });

  const jobs = await getJobs();
  const testJobs = jobs.filter(isObviousTestJob);
  for (const job of testJobs) await deleteJob(job.jobId);

  const database = db();
  let deletedFiles = 0;
  if (database) {
    const listed = await database.storage.from("job-files").list("smoke-test", { limit: 100 }).catch(() => ({ data: [] as { name: string }[] }));
    const paths = listed.data?.map((file) => `smoke-test/${file.name}`) || [];
    if (paths.length) {
      const removed = await database.storage.from("job-files").remove(paths);
      if (!removed.error) deletedFiles = paths.length;
    }
  }

  return NextResponse.json({ deletedJobs: testJobs.length, deletedFiles });
}
