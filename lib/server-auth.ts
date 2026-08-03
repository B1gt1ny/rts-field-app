import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authClient, canEmployeeAccessJob, getUserRole, isDatabaseConfigured, type AppUser, type UserRole } from "./auth";
import type { Job } from "./types";

export async function getServerUser(): Promise<AppUser | null> {
  if (!isDatabaseConfigured()) return null;
  const db = authClient();
  const token = (await cookies()).get("cc-access-token")?.value;
  if (!db || !token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function requireServerRole(allowed: UserRole[]) {
  if (!isDatabaseConfigured()) return { user: null, role: "Admin" as UserRole, authDisabled: true };
  const user = await getServerUser();
  if (!user) redirect("/login");
  const role = getUserRole(user);
  if (!allowed.includes(role)) redirect(role === "Employee" ? "/field" : "/");
  return { user, role, authDisabled: false };
}

export async function filterServerJobsForUser(jobs: Job[]) {
  if (!isDatabaseConfigured()) return jobs;
  const user = await getServerUser();
  if (!user) redirect("/login");
  const role = getUserRole(user);
  if (role === "Employee") return jobs.filter((job) => canEmployeeAccessJob(user, job));
  return jobs;
}

export async function canServerViewJob(job: Job) {
  if (!isDatabaseConfigured()) return true;
  const user = await getServerUser();
  if (!user) redirect("/login");
  return canEmployeeAccessJob(user, job);
}
