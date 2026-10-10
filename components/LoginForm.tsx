"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { roleHomePath } from "@/lib/client-auth";
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
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error || "Login failed. Please try again.");
        return;
      }
      router.replace(roleHomePath(result.user?.role));
    } catch {
      setMessage("Connection problem. Check your signal and try again.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="login-surface grid min-h-screen place-items-center p-4 sm:p-8">
    <form onSubmit={login} className="card w-full max-w-md p-6 shadow-2xl sm:p-8">
      <div className="mb-6 flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><ShieldCheckIcon className="size-7" /></span>
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-accent">Secure access</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">RTS Field App</h1>
          <p className="mt-1 text-sm text-content/65">RTS Land Solutions · Field operations</p>
        </div>
      </div>
      <label><span className="label">Email</span><input className="field" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label className="mt-4 block"><span className="label">Password</span><input className="field" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {message && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}
      <button disabled={loading} className="btn-primary mt-5 w-full">{loading ? "Signing in…" : "Sign In"}</button>
      <nav aria-label="App information" className="mt-4 flex flex-wrap justify-center gap-x-4 text-sm font-bold text-accent">
        <Link href="/privacy" className="inline-flex min-h-11 items-center">Privacy</Link>
        <Link href="/support" className="inline-flex min-h-11 items-center">Support</Link>
        <Link href="/account-request" className="inline-flex min-h-11 items-center">Account and data requests</Link>
      </nav>
    </form>
  </div>;
}
