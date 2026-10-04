"use client";

import { useEffect, useState } from "react";
import type { Job } from "@/lib/types";
import { authFetch, jobUpdateBody } from "@/lib/client-auth";
import { coverPhotos, currentCover, sameCover, type CoverPhoto } from "@/lib/job-cover";

export function JobCoverPhoto({ job, isAdmin, onSaved }: { job: Job; isAdmin: boolean; onSaved: (patch: Pick<Job, "coverPhoto" | "revision">) => void }) {
  const native = currentCover(job, coverPhotos(job));
  const [photo, setPhoto] = useState<CoverPhoto | null>(native || null);
  const [photos, setPhotos] = useState<CoverPhoto[]>([]);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage("");
    setPhoto(currentCover(job, coverPhotos(job)) || null);
    authFetch(`/api/jobs/${encodeURIComponent(job.jobId)}/cover`).then(async response => {
      if (!response.ok) throw new Error("Cover photo could not be loaded.");
      return response.json();
    }).then(result => {
      if (!active) return;
      setPhoto(result.photo);
      setPhotos(result.photos || []);
      if (result.providerFailed) setMessage("CompanyCam photos are unavailable right now.");
    }).catch(() => { if (active) setMessage("Cover photo could not be loaded. Your job photos are still available below."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin, job.jobId, job.workOrderFiles, job.beforePhotos, job.damagePhotos, job.serialTagPhotos, job.afterPhotos, job.companyCamProjectId]);
  useEffect(() => { setImageFailed(false); }, [photo?.url]);
  async function saveCover() {
    if (!isAdmin || saving) return;
    const reference = selected === "" ? null : photos[Number(selected)]?.reference;
    if (reference === undefined) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await authFetch(`/api/jobs/${encodeURIComponent(job.jobId)}/cover`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: jobUpdateBody(job, { coverPhoto: reference }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Cover photo could not be saved.");
      onSaved({ coverPhoto: result.coverPhoto, revision: result.revision });
      setPhoto(result.photo);
      setEditing(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Cover photo could not be saved."); }
    finally { setSaving(false); }
  }
  return <div className="min-w-0">
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-xs font-bold uppercase tracking-widest text-accent">Job cover photo</p>
      {isAdmin && <button type="button" disabled={loading || saving} onClick={() => { const index = photos.findIndex(item => sameCover(item.reference, job.coverPhoto)); setSelected(index < 0 ? "" : String(index)); setEditing(!editing); }} className="min-h-11 rounded-lg px-3 text-sm font-bold text-accent disabled:opacity-50">{editing ? "Cancel" : "Change cover"}</button>}
    </div>
    <a href="#photos" className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-xl border border-content/10 bg-sand">
      {photo && !imageFailed ? <img src={photo.url} alt={`Job cover photo for ${job.customerName}`} className="size-full object-cover" onError={() => setImageFailed(true)} /> : <span className="px-4 text-center text-sm font-semibold text-content/65">{loading ? "Loading job photo…" : imageFailed ? "Photo unavailable · Open job photos" : "No job photos yet · Open job photos"}</span>}
    </a>
    {editing && isAdmin && <div className="mt-2 space-y-2">
      <label className="block text-sm font-bold">Choose cover photo<select value={selected} disabled={saving} onChange={event => setSelected(event.target.value)} className="field mt-1 w-full"><option value="">Automatic — first available photo</option>{photos.map((item, index) => <option key={index} value={String(index)}>{index + 1}. {item.label}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString()}` : ""}</option>)}</select></label>
      {selected !== "" && photos[Number(selected)] && <img src={photos[Number(selected)].url} alt="Selected cover preview" className="max-h-40 w-full rounded-lg object-contain" />}
      <button type="button" disabled={saving || selected === "-1"} onClick={saveCover} className="btn-primary w-full">{saving ? "Saving…" : "Save cover"}</button>
    </div>}
    {message && <p role="status" className="mt-2 text-sm font-semibold text-content/65">{message}</p>}
  </div>;
}
