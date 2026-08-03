"use client";

import Link from "next/link";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { useAuthUser } from "./AuthGate";
import type { UserRole } from "@/lib/auth";

export function RoleGuard({ allowed, children }: { allowed: UserRole[]; children: React.ReactNode }) {
  const user = useAuthUser();
  if (!user || allowed.includes(user.role)) return <>{children}</>;
  return <div className="mx-auto max-w-xl">
    <section className="card p-6 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-orange-100 text-orange-800"><ShieldExclamationIcon className="size-8" /></span>
      <h1 className="mt-4 text-2xl font-black">Access denied</h1>
      <p className="mt-2 text-sm text-black/50">Your current role is {user.role}. This area is for {allowed.join(" or ")} users.</p>
      <Link href={user.role === "Employee" ? "/field" : "/"} className="btn-primary mt-5">Go Back</Link>
    </section>
  </div>;
}
