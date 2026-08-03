"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Employee } from "@/lib/types";
import { authFetch } from "@/lib/client-auth";

export function EmployeesManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { load(); }, []);
  async function load() {
    try { const response = await fetch("/api/employees"); setEmployees(await response.json()); }
    catch { setError("Employees could not be loaded."); }
    finally { setLoading(false); }
  }
  async function addEmployee(event: React.FormEvent) {
    event.preventDefault(); if (!name.trim()) return; setSaving(true); setError("");
    try {
      const response = await authFetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Employee could not be added.");
      setEmployees((old) => [...old, result].sort((a, b) => a.name.localeCompare(b.name))); setName("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Employee could not be added."); }
    finally { setSaving(false); }
  }
  async function update(id: string, changes: Partial<Employee>) {
    setError("");
    const response = await authFetch(`/api/employees/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Employee could not be updated."); return; }
    setEmployees((old) => old.map((employee) => employee.id === id ? result : employee));
  }
  return <>
    <div className="mb-6 flex items-end justify-between gap-3"><div><p className="mb-1 text-sm font-extrabold uppercase tracking-widest text-forest">Team</p><h1 className="text-3xl font-black">Employees</h1><p className="mt-2 text-black/50">Add names used for daily job assignments.</p></div><Link href="/crew" className="btn-secondary">View assignments</Link></div>
    <form onSubmit={addEmployee} className="card mb-5 flex gap-2 p-4"><label className="flex-1"><span className="label">Employee name</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter a name" /></label><button disabled={saving || !name.trim()} className="btn-primary self-end">{saving ? "Adding…" : "Add employee"}</button></form>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
    <div className="space-y-3">{loading ? <p className="card p-6 text-center text-black/45">Loading employees…</p> : employees.map((employee) => <EmployeeRow key={employee.id} employee={employee} onUpdate={update} />)}</div>
  </>;
}

function EmployeeRow({ employee, onUpdate }: { employee: Employee; onUpdate: (id: string, changes: Partial<Employee>) => Promise<void> }) {
  const [name, setName] = useState(employee.name);
  const [saving, setSaving] = useState(false);
  async function saveName() { if (!name.trim() || name.trim() === employee.name) return; setSaving(true); await onUpdate(employee.id, { name }); setSaving(false); }
  return <section className={`card p-4 ${employee.active ? "" : "opacity-60"}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1"><span className="label">Name</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></label><button type="button" onClick={saveName} disabled={saving || !name.trim() || name.trim() === employee.name} className="btn-secondary">{saving ? "Saving…" : "Save name"}</button><button type="button" onClick={() => onUpdate(employee.id, { active: !employee.active })} className={`min-h-12 rounded-xl px-4 font-black ${employee.active ? "border border-red-200 text-red-700" : "bg-forest text-white"}`}>{employee.active ? "Mark inactive" : "Reactivate"}</button></div></section>;
}
