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

export function jobUpdateBody(job: Pick<Job, "revision">, patch: Partial<Job>) {
  return JSON.stringify({ ...patch, expectedRevision: job.revision || null });
}
