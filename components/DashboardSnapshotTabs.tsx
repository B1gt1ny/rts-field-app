"use client";

import Link from "next/link";
import { BanknotesIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

type SnapshotTab = "today" | "active" | "parts" | "review" | "billing";

export function DashboardSnapshotTabs({ dueToday, active, waitingParts, needsReview, readyBilling }: { dueToday: number; active: number; waitingParts: number; needsReview: number; readyBilling: number }) {
  const [selected, setSelected] = useState<SnapshotTab>("today");
  const tabs: Array<{ id: SnapshotTab; label: string; value: number; href: string; detail: string; icon: typeof ClockIcon; tone: string }> = [
    { id: "today", label: "Today", value: dueToday, href: "/today", detail: "Jobs scheduled for today.", icon: ClockIcon, tone: "bg-lime text-ink" },
    { id: "active", label: "Active", value: active, href: "/jobs", detail: "All open work in the app.", icon: WrenchScrewdriverIcon, tone: "bg-blue-100 text-blue-900" },
    { id: "parts", label: "Parts", value: waitingParts, href: "/waiting-on-parts", detail: "Jobs currently waiting on parts.", icon: ExclamationTriangleIcon, tone: "bg-orange-100 text-orange-900" },
    { id: "review", label: "Review", value: needsReview, href: "/ready-check", detail: "Jobs waiting for manager review.", icon: CheckCircleIcon, tone: "bg-cyan-100 text-cyan-900" },
    { id: "billing", label: "Billing", value: readyBilling, href: "/billing", detail: "Jobs ready to move into billing.", icon: BanknotesIcon, tone: "bg-emerald-100 text-emerald-900" },
  ];
  const current = tabs.find((tab) => tab.id === selected) || tabs[0];
  const Icon = current.icon;

  return <section className="card overflow-hidden">
    <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
      <h2 className="text-lg font-black">Business Snapshot</h2>
      <span className="text-xs font-black uppercase tracking-wide text-black/35">{active} active</span>
    </div>
    <div className="flex gap-2 overflow-x-auto px-4 pb-3 sm:px-5" role="tablist" aria-label="Business snapshot">
      {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={tab.id === selected} onClick={() => setSelected(tab.id)} className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-black transition ${tab.id === selected ? "bg-forest text-white" : "bg-sand text-black/55 hover:bg-black/5"}`}>{tab.label} <span className="ml-1 opacity-75">{tab.value}</span></button>)}
    </div>
    <Link href={current.href} className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-2xl bg-sand p-4 transition hover:bg-forest/10 sm:mx-5">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${current.tone}`}><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-xs font-black uppercase tracking-wide text-black/40">{current.label}</span><span className="mt-1 block text-sm font-semibold text-black/60">{current.detail}</span></span>
      <span className="text-3xl font-black text-ink">{current.value}</span>
    </Link>
  </section>;
}
