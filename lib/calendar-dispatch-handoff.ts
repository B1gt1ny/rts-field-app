export type JobImportHandoff = {
  origin?: "calendar";
  returnTo?: "/dispatch";
};

export function jobSaveDestination(jobId: string, handoff: JobImportHandoff) {
  const encodedJobId = encodeURIComponent(jobId);
  if (handoff.origin === "calendar" && handoff.returnTo === "/dispatch") {
    return `/dispatch?from=calendar&job=${encodedJobId}`;
  }
  return `/jobs/${encodedJobId}`;
}
