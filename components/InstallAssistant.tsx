"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, CheckCircleIcon, ClipboardDocumentIcon, ShareIcon, SignalIcon } from "@heroicons/react/24/outline";

export function InstallAssistant() {
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setOnline(navigator.onLine);
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || Boolean(("standalone" in navigator) && (navigator as Navigator & { standalone?: boolean }).standalone));
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(() => setServiceWorkerReady(true)).catch(() => setServiceWorkerReady(false));
    }
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  const appUrl = useMemo(() => typeof window === "undefined" ? "https://rts-field-app.vercel.app" : window.location.origin, []);

  async function copyLink() {
    await navigator.clipboard.writeText(appUrl).then(() => setMessage("App link copied."), () => setMessage("Copy did not work. Long-press the link and copy it."));
  }

  async function copyCrewInstructions() {
    const text = [
      "Company Command field app",
      "",
      `Open: ${appUrl}`,
      "",
      "iPhone: open this link in Safari, tap Share, then Add to Home Screen.",
      "Android: open this link in Chrome, tap the menu, then Install app or Add to Home screen.",
      "",
      "After login, tap My Jobs or Field App. If you cannot see your jobs, ask admin to link your login to your employee name.",
    ].join("\n");
    await navigator.clipboard.writeText(text).then(() => setMessage("Crew install instructions copied."), () => setMessage("Copy did not work. Long-press the link and copy it."));
  }

  async function shareApp() {
    if (navigator.share) {
      await navigator.share({ title: "Company Command", text: "Open the RTS field app:", url: appUrl }).then(() => setMessage("Share sheet opened."), () => undefined);
      return;
    }
    await copyLink();
  }

  return <section className="card overflow-hidden">
    <div className="bg-ink p-4 text-white">
      <p className="text-xs font-black uppercase tracking-widest text-lime">Install readiness</p>
      <h2 className="mt-1 text-2xl font-black">Phone app status</h2>
      <p className="mt-1 text-sm text-white/55">Use this before handing the link to a crew member.</p>
    </div>
    <div className="grid gap-3 p-4 sm:grid-cols-3">
      <StatusTile label="Internet" value={online ? "Online" : "Offline"} ready={online} icon={<SignalIcon />} />
      <StatusTile label="Installed view" value={standalone ? "Home screen" : "Browser"} ready={standalone} icon={<CheckCircleIcon />} />
      <StatusTile label="Offline shell" value={serviceWorkerReady ? "Ready" : "Loading"} ready={serviceWorkerReady} icon={<ArrowPathIcon />} />
    </div>
    <div className="grid gap-2 border-t border-black/5 p-4 sm:grid-cols-3">
      <button type="button" onClick={copyLink} className="min-h-12 rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black text-ink"><ClipboardDocumentIcon className="mr-2 inline size-5" />Copy app link</button>
      <button type="button" onClick={copyCrewInstructions} className="min-h-12 rounded-xl border-2 border-black/10 bg-white px-4 py-3 font-black text-ink"><ClipboardDocumentIcon className="mr-2 inline size-5" />Copy instructions</button>
      <button type="button" onClick={shareApp} className="min-h-12 rounded-xl bg-forest px-4 py-3 font-black text-white"><ShareIcon className="mr-2 inline size-5" />Share to crew</button>
    </div>
    {message && <p className="mx-4 mb-4 rounded-xl border border-forest/20 bg-forest/5 p-3 text-sm font-bold text-forest">{message}</p>}
  </section>;
}

function StatusTile({ label, value, ready, icon }: { label: string; value: string; ready: boolean; icon: React.ReactNode }) {
  return <div className={`rounded-2xl p-4 ${ready ? "bg-forest/5 text-forest" : "bg-orange-50 text-orange-900"}`}>
    <div className="[&>svg]:size-5">{icon}</div>
    <p className="mt-3 text-xl font-black">{value}</p>
    <p className="mt-1 text-xs font-black uppercase tracking-wide opacity-70">{label}</p>
  </div>;
}
