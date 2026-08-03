import { createClient } from "@supabase/supabase-js";

export type UserRole = "Admin" | "Manager" | "Employee";
export type AppUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

export const roles: UserRole[] = ["Admin", "Manager", "Employee"];

export function isAuthConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isDatabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function getRequestUser(request: Request) {
  const db = authClient();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || getCookie(request, "cc-access-token");
  if (!db || !token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export function getUserRole(user: AppUser | null): UserRole {
  if (!user) return "Employee";
  const metadataRole = String(user.user_metadata?.role || user.app_metadata?.role || "");
  if (roles.includes(metadataRole as UserRole)) return metadataRole as UserRole;

  const email = String(user.email || "").toLowerCase();
  const admins = splitEmails(process.env.ADMIN_EMAILS || "b1g_t1ny@yahoo.com");
  const managers = splitEmails(process.env.MANAGER_EMAILS || "Texastrimout@gmail.com");
  if (admins.includes(email)) return "Admin";
  if (managers.includes(email)) return "Manager";
  return "Employee";
}

export function getUserEmployee(user: AppUser | null) {
  if (!user) return { employeeId: "", employeeName: "" };
  return {
    employeeId: String(user.user_metadata?.employeeId || user.app_metadata?.employeeId || ""),
    employeeName: String(user.user_metadata?.employeeName || user.app_metadata?.employeeName || ""),
  };
}

export function canEmployeeAccessJob(user: AppUser | null, job: { assignedCrew?: string; assignedEmployeeIds?: string[]; fullCrew?: boolean }) {
  if (getUserRole(user) !== "Employee") return true;
  if (job.fullCrew) return true;
  const { employeeId, employeeName } = getUserEmployee(user);
  if (employeeId && job.assignedEmployeeIds?.includes(employeeId)) return true;
  if (employeeName && job.assignedCrew?.toLowerCase().includes(employeeName.toLowerCase())) return true;
  return false;
}

export function employeeSafeJobPatch(input: Record<string, unknown>) {
  const allowed = new Set([
    "checklist",
    "activityLog",
    "paperworkPickedUp",
    "paperworkPickedUpBy",
    "paperworkPickupDate",
    "paperworkItems",
    "receipts",
    "partsItems",
    "timeEntries",
    "signoffs",
    "workOrderFiles",
    "beforePhotos",
    "damagePhotos",
    "serialTagPhotos",
    "afterPhotos",
    "completionNotes",
    "status",
    "partsNeeded",
  ]);
  return Object.fromEntries(Object.entries(input).filter(([key]) => allowed.has(key)));
}

export async function requireRole(request: Request, allowed: UserRole[]) {
  if (!isDatabaseConfigured()) return { ok: true, role: "Admin" as UserRole, user: null, authDisabled: true };
  const user = await getRequestUser(request);
  if (!user) return { ok: false, status: 401, error: "Login is required." };
  const role = getUserRole(user);
  if (!allowed.includes(role)) return { ok: false, status: 403, error: "You do not have permission for this action." };
  return { ok: true, role, user, authDisabled: false };
}

export function splitEmails(value: string) {
  return value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function getCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}
