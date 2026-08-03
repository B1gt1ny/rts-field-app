"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Login failed.");
      setLoading(false);
      return;
    }
    router.replace(result.user?.role === "Employee" ? "/field" : "/");
  }

  return <div className="grid min-h-screen place-items-center bg-sand p-4">
    <form onSubmit={login} className="card w-full max-w-md p-5 sm:p-7">
      <div className="mb-6 flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><ShieldCheckIcon className="size-7" /></span>
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-forest">Secure access</p>
          <h1 className="text-3xl font-black">Company Command</h1>
          <p className="mt-1 text-sm text-black/50">Sign in to RTS Field App.</p>
        </div>
      </div>
      <label><span className="label">Email</span><input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label className="mt-4 block"><span className="label">Password</span><input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {message && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}
      <button disabled={loading} className="btn-primary mt-5 w-full">{loading ? "Signing in…" : "Sign In"}</button>
    </form>
  </div>;
}
