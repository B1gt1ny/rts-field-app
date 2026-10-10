"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, CheckCircleIcon, ClipboardDocumentIcon, ShareIcon, SignalIcon } from "@heroicons/react/24/outline";

export function InstallAssistant() {
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [message, setMessage] = useState("");
  const [copyFallback, setCopyFallback] = useState("");

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

  const appUrl = useMemo(() => typeof window === "undefined" ? "" : window.location.origin, []);

  async function copyLink() {
    await copyText(appUrl, "App link copied.");
  }

  async function copyCrewInstructions() {
    const text = [
      "RTS Field App",
      "",
      `Open: ${appUrl}`,
      "",
      "iPhone: open this link in Safari, tap Share, then Add to Home Screen.",
      "Android: open this link in Chrome, tap the menu, then Install app or Add to Home screen.",
      "",
      "After login, tap My Work. If you cannot see your jobs, ask admin to link your login to your employee name.",
    ].join("\n");
    await copyText(text, "Crew install instructions copied.");
  }

  async function copyText(text: string, success: string) {
    setMessage("");
    setCopyFallback("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setMessage(success);
    } catch {
      setMessage("Copy did not work. Retry, or select and copy the text below.");
      setCopyFallback(text);
    }
  }

  async function shareApp() {
    setMessage("");
    setCopyFallback("");
    if (!navigator.share) { await copyLink(); return; }
    try {
      await navigator.share({ title: "RTS Field App", text: "Open the RTS Field App:", url: appUrl });
      setMessage("App shared.");
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") setMessage("Share cancelled.");
      else {
        setMessage("Share did not work. Retry, or select and copy the app link below.");
        setCopyFallback(appUrl);
      }
    }
  }

  return <section className="card overflow-hidden">
    <div className="bg-ink p-4 text-white">
      <p className="text-xs font-bold uppercase tracking-widest text-lime">Install readiness</p>
      <h2 className="mt-1 text-2xl font-bold">Phone app status</h2>
      <p className="mt-1 text-sm text-white/65">Use this before handing the link to a crew member.</p>
    </div>
    <div className="grid gap-3 p-4 sm:grid-cols-3">
      <StatusTile label="Internet" value={online ? "Online" : "Offline"} ready={online} icon={<SignalIcon />} />
      <StatusTile label="Installed view" value={standalone ? "Home screen" : "Browser"} ready={standalone} icon={<CheckCircleIcon />} />
      <StatusTile label="Offline shell" value={serviceWorkerReady ? "Ready" : "Loading"} ready={serviceWorkerReady} icon={<ArrowPathIcon />} />
    </div>
    <div className="grid gap-2 border-t border-content/5 p-4 sm:grid-cols-3">
      <button type="button" onClick={copyLink} className="min-h-12 rounded-xl border-2 border-content/10 bg-surface px-4 py-3 font-bold text-content"><ClipboardDocumentIcon className="mr-2 inline size-5" />Copy app link</button>
      <button type="button" onClick={copyCrewInstructions} className="min-h-12 rounded-xl border-2 border-content/10 bg-surface px-4 py-3 font-bold text-content"><ClipboardDocumentIcon className="mr-2 inline size-5" />Copy instructions</button>
      <button type="button" onClick={shareApp} className="min-h-12 rounded-xl bg-forest px-4 py-3 font-bold text-white"><ShareIcon className="mr-2 inline size-5" />Share to crew</button>
    </div>
    {copyFallback && <label className="mx-4 mb-4 block text-sm font-bold">Text to copy<textarea readOnly value={copyFallback} onFocus={event => event.target.select()} className="field mt-1 min-h-32" /></label>}
    {message && <p role="status" className="mx-4 mb-4 rounded-xl border border-forest/20 bg-forest/5 p-3 text-sm font-bold text-accent">{message}</p>}
  </section>;
}

function StatusTile({ label, value, ready, icon }: { label: string; value: string; ready: boolean; icon: React.ReactNode }) {
  return <div className={`rounded-2xl p-4 ${ready ? "bg-forest/5 text-accent" : "bg-orange-50 text-orange-900"}`}>
    <div className="[&>svg]:size-5">{icon}</div>
    <p className="mt-3 text-xl font-bold">{value}</p>
    <p className="mt-1 text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
  </div>;
}
