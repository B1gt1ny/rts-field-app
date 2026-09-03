import type { UserRole } from "./auth";
import type { Employee } from "./types";

export type EmployeeAccessUser = { id: string; email?: string; role: UserRole; employeeId?: string; lastSignInAt?: string };
export type EmployeeOnboardingStatus = "Needs login" | "Never signed in" | "Ready";

export function linkedEmployeeUser(users: EmployeeAccessUser[], employeeId: string) {
  return users.find((user) => user.employeeId === employeeId);
}

export function employeeOnboardingStatus(employee: Employee, users: EmployeeAccessUser[]): EmployeeOnboardingStatus {
  const user = linkedEmployeeUser(users, employee.id);
  if (!user) return "Needs login";
  return user.lastSignInAt ? "Ready" : "Never signed in";
}

export function employeeLinkConflict(users: EmployeeAccessUser[], employeeId: string, ignoreUserId = "") {
  if (!employeeId) return undefined;
  return users.find((user) => user.id !== ignoreUserId && user.employeeId === employeeId);
}
