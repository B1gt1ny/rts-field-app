import type { UserRole } from "./auth";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  employeeName?: string;
};

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  return fetch(input, { ...init, headers, credentials: "include" });
}
