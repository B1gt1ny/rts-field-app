import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authClient, canEmployeeAccessJob, getUserRole, hasTrustedAccess, isDatabaseConfigured, sanitizeEmployeeJob, type AppUser, type UserRole } from "./auth";
import type { Job } from "./types";

export async function getServerUser(): Promise<AppUser | null> {
  if (!isDatabaseConfigured()) return null;
  const db = authClient();
  const token = (await cookies()).get("cc-access-token")?.value;
  if (!db || !token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !hasTrustedAccess(data.user)) return null;
  return data.user;
}

export async function requireServerRole(allowed: UserRole[]) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  const role = getUserRole(user);
  if (!allowed.includes(role)) redirect(role === "Employee" ? "/field" : "/");
  return { user, role, authDisabled: false };
}

export async function filterServerJobsForUser(jobs: Job[]) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  const role = getUserRole(user);
  if (role === "Employee") return jobs.filter((job) => canEmployeeAccessJob(user, job)).map(sanitizeEmployeeJob);
  return jobs;
}

export async function canServerViewJob(job: Job) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  return canEmployeeAccessJob(user, job);
}
