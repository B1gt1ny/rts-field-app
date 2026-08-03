import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import type { Employee } from "./types";

const dataFile = path.join(process.cwd(), "data", "employees.json");

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

async function getLocalEmployees(): Promise<Employee[]> {
  return JSON.parse(await fs.readFile(dataFile, "utf8")) as Employee[];
}

export async function getEmployees(): Promise<Employee[]> {
  const db = database();
  if (!db) return getLocalEmployees();
  const { data, error } = await db.from("employees").select("id,name,active").order("name");
  if (error) throw new Error(`Unable to load employees: ${error.message}`);
  return data as Employee[];
}

export async function createEmployee(name: string): Promise<Employee> {
  const employee: Employee = { id: crypto.randomUUID(), name: name.trim(), active: true };
  const db = database();
  if (!db) {
    const employees = await getLocalEmployees();
    employees.push(employee);
    await fs.writeFile(dataFile, JSON.stringify(employees, null, 2));
    return employee;
  }
  const { error } = await db.from("employees").insert(employee);
  if (error) throw new Error(`Unable to add employee: ${error.message}`);
  return employee;
}

export async function updateEmployee(id: string, changes: Partial<Pick<Employee, "name" | "active">>): Promise<Employee | undefined> {
  const db = database();
  if (!db) {
    const employees = await getLocalEmployees();
    const index = employees.findIndex((employee) => employee.id === id);
    if (index < 0) return undefined;
    employees[index] = { ...employees[index], ...changes, name: changes.name?.trim() || employees[index].name };
    await fs.writeFile(dataFile, JSON.stringify(employees, null, 2));
    return employees[index];
  }
  const update = { ...changes, ...(changes.name ? { name: changes.name.trim() } : {}) };
  const { data, error } = await db.from("employees").update(update).eq("id", id).select("id,name,active").maybeSingle();
  if (error) throw new Error(`Unable to update employee: ${error.message}`);
  return data as Employee | undefined;
}
