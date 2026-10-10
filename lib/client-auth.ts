import type { Job } from "./types";
import type { UserRole } from "./auth";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  employeeName?: string;
};

// Navigation only; trusted roles and access are still enforced by the server.
export function roleHomePath(role?: UserRole) {
  if (role === "Admin") return "/";
  if (role === "Manager") return "/today-command";
  return "/field";
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  return fetch(input, { ...init, headers, credentials: "include" });
}

export function jobUpdateBody(job: Pick<Job, "revision">, patch: Partial<Job>, expectedUserId: string | undefined) {
  if (!expectedUserId) throw new Error("Sign back into the account that opened this job before saving.");
  return JSON.stringify({ ...patch, expectedRevision: job.revision || null, expectedUserId });
}
