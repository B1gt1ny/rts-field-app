import { roles, type AppUser, type UserRole } from "./auth";

export type MigrationDecision = {
  userId: string;
  currentRole: string;
  currentEmployeeId: string;
  proposedRole: UserRole | null;
  proposedEmployeeId: string;
  reason: string;
};

export type ApprovedMapping = { userId: string; role: UserRole; employeeId: string; employeeName: string; accessActive: boolean };

export function validateApprovedMigration(users: AppUser[], mappings: ApprovedMapping[], employees: { id: string; name: string }[]) {
  const userIds = new Set(users.map((user) => user.id));
  const knownEmployees = new Map(employees.map((employee) => [employee.id, employee.name]));
  const mappedUsers = new Set<string>();
  const mappedEmployees = new Set<string>();
  if (mappings.length !== users.length) throw new Error("Every Auth user needs an explicit migration decision.");
  for (const mapping of mappings) {
    if (!userIds.has(mapping.userId) || mappedUsers.has(mapping.userId)) throw new Error("Unknown or duplicate Auth user.");
    if (!roles.includes(mapping.role)) throw new Error("Invalid RTS role.");
    if (mapping.employeeId && (!knownEmployees.has(mapping.employeeId) || mappedEmployees.has(mapping.employeeId))) throw new Error("Unknown or duplicate employee link.");
    if (mapping.employeeName !== (mapping.employeeId ? knownEmployees.get(mapping.employeeId) : "")) throw new Error("Employee name does not match approved roster.");
    if (typeof mapping.accessActive !== "boolean") throw new Error("Explicit access status required.");
    mappedUsers.add(mapping.userId);
    if (mapping.employeeId) mappedEmployees.add(mapping.employeeId);
  }
  return mappings.map((mapping) => ({
    userId: mapping.userId,
    before: users.find((user) => user.id === mapping.userId)?.app_metadata || {},
    after: {
      ...(users.find((user) => user.id === mapping.userId)?.app_metadata || {}),
      rtsRole: mapping.role,
      rtsEmployeeId: mapping.employeeId,
      rtsEmployeeName: mapping.employeeName,
      rtsAccessActive: mapping.accessActive,
    },
  }));
}

// This is a review plan, never an automatic write. Client-editable legacy fields
// cannot be promoted into trusted authorization without independent confirmation.
export function planAuthMigration(users: AppUser[]): MigrationDecision[] {
  return users.map((user) => {
    const currentRole = String(user.user_metadata?.role || "");
    const currentEmployeeId = String(user.user_metadata?.employeeId || "");
    const trustedRole = user.app_metadata?.rtsRole;
    const proposedRole = roles.includes(trustedRole as UserRole) ? trustedRole as UserRole : null;
    return {
      userId: user.id,
      currentRole,
      currentEmployeeId,
      proposedRole,
      proposedEmployeeId: String(user.app_metadata?.rtsEmployeeId || ""),
      reason: proposedRole ? "Already uses trusted RTS metadata" : "Requires independent role and employee-link confirmation",
    };
  });
}
