import { employeeLinkConflict, employeeOnboardingStatus, linkedEmployeeUser, type EmployeeAccessUser } from "../lib/employee-onboarding";
import type { Employee } from "../lib/types";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`);
}

const employee: Employee = { id: "employee-johnnie", name: "Johnnie", active: true };
const users: EmployeeAccessUser[] = [
  { id: "admin-1", email: "office@example.com", role: "Admin" },
  { id: "employee-user-1", email: "johnnie@example.com", role: "Employee", employeeId: employee.id },
];

assertEqual(linkedEmployeeUser([], employee.id), undefined, "Employee without a login remains unlinked");
assertEqual(employeeOnboardingStatus(employee, []), "Needs login", "Missing login status");
assertEqual(employeeOnboardingStatus(employee, users), "Never signed in", "First sign-in status");
assertEqual(employeeOnboardingStatus(employee, [{ ...users[1], lastSignInAt: "2026-09-03T12:00:00Z" }]), "Ready", "Ready status");
assertEqual(employeeLinkConflict(users, employee.id)?.id, "employee-user-1", "Duplicate link is detected");
assertEqual(employeeLinkConflict(users, employee.id, "employee-user-1"), undefined, "A user can keep its own link");
assertEqual(linkedEmployeeUser([{ id: "manager-1", role: "Manager", employeeId: employee.id }], employee.id)?.id, "manager-1", "Manager accounts can remain linked to their employee record");

console.log("Employee onboarding verification passed.");
