"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowPathIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import type { CalendarIntakeItem } from "@/lib/calendar-intake";
import { authFetch } from "@/lib/client-auth";

export function CalendarIntake() {
  const [items, setItems] = useState<CalendarIntakeItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await authFetch("/api/calendar-intake");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Calendar intake could not be loaded.");
      setConfigured(result.configured !== false);
      setItems(result.items || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Calendar intake could not be loaded.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function review(item: CalendarIntakeItem) {
    const proposal = {
      ...item.proposal,
      googleCalendarEventId: item.id,
      googleCalendarEventUrl: item.htmlLink || "",
      syncToCalendar: false,
    };
    window.sessionStorage.setItem("company-command-work-order-import", JSON.stringify({ proposal }));
    window.location.href = "/jobs/new?source=calendar";
  }

  const unmatched = items.filter((item) => !item.matchedJobId);
  const matched = items.filter((item) => item.matchedJobId);

  return <section className="card overflow-hidden">
    <div className="flex items-start justify-between gap-3 border-b border-black/5 bg-forest/5 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest text-white"><CalendarDaysIcon className="size-5" /></span>
        <div><h2 className="font-black">Calendar Intake</h2><p className="mt-1 text-sm font-semibold text-black/45">Turn upcoming calendar entries into reviewed RTS jobs. Nothing is created until you review and save it.</p></div>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading} className="grid size-10 shrink-0 place-items-center rounded-xl border border-black/10 bg-white" aria-label="Refresh calendar intake"><ArrowPathIcon className={`size-5 ${loading ? "animate-spin" : ""}`} /></button>
    </div>
    {!configured ? <p className="p-5 text-sm font-bold text-orange-900">Google Calendar is not configured for this app environment.</p> : error ? <p role="alert" className="p-5 text-sm font-bold text-red-700">{error}</p> : loading ? <p className="p-5 text-sm font-semibold text-black/45">Checking upcoming calendar events…</p> : <div className="divide-y divide-black/5">
      <div className="bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-orange-900">Needs Details · {unmatched.length}</div>
      {!unmatched.length ? <p className="p-5 text-sm font-semibold text-black/40">No unmatched calendar entries in the next 30 days.</p> : unmatched.map((item) => <div key={item.id} className="p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide text-forest">{formatDate(item.startDate)}{item.startTime ? ` · ${item.startTime}` : " · All day"}</p><h3 className="mt-1 truncate font-black">{item.title}</h3><p className="mt-1 truncate text-xs font-semibold text-black/45">{item.location || "No location"}</p><p className="mt-2 text-xs font-bold text-orange-900">{item.missing.length ? `Still needs: ${item.missing.join(" · ")}` : "Basic calendar details are ready for review."}</p></div>
        <button type="button" onClick={() => review(item)} className="mt-3 min-h-11 w-full rounded-xl bg-forest px-4 py-2 text-sm font-black text-white sm:mt-0 sm:w-auto">Review Job</button>
      </div>)}
      {matched.length > 0 && <details className="p-4"><summary className="cursor-pointer text-sm font-black text-black/55">Already linked · {matched.length}</summary><div className="mt-3 grid gap-2">{matched.map((item) => <Link key={item.id} href={`/jobs/${item.matchedJobId}`} className="rounded-xl border border-black/10 bg-white p-3 text-sm font-bold hover:bg-sand">{item.title} → {item.matchedJobId}</Link>)}</div></details>}
    </div>}
  </section>;
}

function formatDate(value: string) {
  if (!value) return "No date";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
