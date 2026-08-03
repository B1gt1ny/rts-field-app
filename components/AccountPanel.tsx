"use client";

import { useState } from "react";
import { KeyIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useAuthUser } from "./AuthGate";
import { authFetch } from "@/lib/client-auth";

export function AccountPanel() {
  const user = useAuthUser();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    setMessage("Updating password…");
    const response = await authFetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Password could not be updated.");
      return;
    }
    setPassword("");
    setConfirm("");
    setMessage("Password updated. Use the new password next time you log in.");
  }

  return <div className="mx-auto max-w-3xl space-y-5">
    <div className="flex items-start gap-3">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><UserCircleIcon className="size-7" /></span>
      <div>
        <p className="text-sm font-extrabold uppercase tracking-widest text-forest">Account</p>
        <h1 className="text-3xl font-black">My login</h1>
        <p className="mt-1 text-sm text-black/50">Manage your Company Command access from your phone.</p>
      </div>
    </div>

    {message && <p className="rounded-xl border border-forest/20 bg-forest/5 p-3 text-sm font-bold text-forest">{message}</p>}

    <section className="card p-4 sm:p-6">
      <h2 className="mb-3 text-lg font-black">Profile</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Info label="Email" value={user?.email || "Not loaded"} />
        <Info label="Role" value={user?.role || "Employee"} />
        <Info label="Linked employee" value={user?.employeeName || "Not linked"} />
      </div>
    </section>

    <section className="card p-4 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-lime"><KeyIcon className="size-5" /></span>
        <div>
          <h2 className="text-lg font-black">Change password</h2>
          <p className="text-sm text-black/45">Use at least 8 characters. A longer phrase is better.</p>
        </div>
      </div>
      <form onSubmit={changePassword} className="grid gap-3">
        <label><span className="label">New password</span><input type="password" className="field" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
        <label><span className="label">Confirm password</span><input type="password" className="field" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} required /></label>
        <button className="btn-primary">Update Password</button>
      </form>
    </section>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-sand p-3">
    <p className="text-xs font-black uppercase tracking-wide text-black/35">{label}</p>
    <p className="mt-1 font-black">{value}</p>
  </div>;
}
