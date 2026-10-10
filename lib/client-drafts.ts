// Browser draft keys are account-scoped; never assign legacy drafts to a new owner.
const prefix = "rts-draft:";
export function accountDraftKey(userId: string | undefined, name: string) {
  return userId ? `${prefix}${encodeURIComponent(userId)}:${name}` : null;
}
export function clearBrowserDrafts(local: Storage, session: Storage) {
  for (const storage of [local, session]) {
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (key && (key.startsWith(prefix) || key.startsWith("company-command-job-draft-") || key.startsWith("company-command-draft-") || key === "company-command-import-draft" || key === "company-command-work-order-import" || key === "company-command-employee-id")) storage.removeItem(key);
    }
  }
}
export function removeLegacyDrafts(storage: Storage) {
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (key && (key.startsWith("company-command-job-draft-") || key.startsWith("company-command-draft-") || key === "company-command-import-draft" || key === "company-command-work-order-import")) storage.removeItem(key);
  }
}


export type PendingFieldNote = { id: string; text: string };

// Retry only an additive note against the latest revision, never a stale job snapshot.
export async function pushFieldNote(fetcher: typeof fetch, userId: string, jobId: string, note: PendingFieldNote) {
  const identity = await fetcher("/api/auth/me");
  const actor = identity.ok ? (await identity.json()).user : null;
  if (actor?.id !== userId) throw new Error("Sign back into the account that saved this draft before sending it.");
  const url = `/api/jobs/${encodeURIComponent(jobId)}`;
  const response = await fetcher(url);
  if (!response.ok) throw new Error("This job could not be opened. Your draft is still saved.");
  const latest = await response.json() as import("./types").Job;
  if (latest.activityLog?.some((entry) => entry.id === note.id)) return latest;
  const entry: import("./types").JobActivity = { id: note.id, message: `Field draft note: ${note.text}`, type: "Note", createdBy: actor.employeeName || actor.email || "Field", createdAt: new Date().toISOString() };
  const saved = await fetcher(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedUserId: userId, expectedRevision: latest.revision || null, activityLog: [entry, ...(latest.activityLog || [])] }) });
  if (!saved.ok) throw new Error(saved.status === 409 ? "This job changed while sending. Your draft is saved; try again." : "The note could not be confirmed. Your draft is saved; try again.");
  const result = await saved.json() as import("./types").Job;
  if (!result.activityLog?.some((item) => item.id === note.id)) throw new Error("The note could not be confirmed. Your draft is saved; try again.");
  return result;
}


export async function sendStoredFieldNote(storage: Storage, locks: Pick<LockManager, "request"> | undefined, key: string, pendingKey: string, snapshot: string, fetcher: typeof fetch, userId: string, jobId: string) {
  if (!locks) throw new Error("This browser cannot safely coordinate draft sending. Keep your draft and use an updated browser.");
  return locks.request(key, async () => {
    if (storage.getItem(key) !== snapshot) return { draft: storage.getItem(key) || "", job: undefined };
    let pending: PendingFieldNote | undefined;
    try { pending = JSON.parse(storage.getItem(pendingKey) || "null"); } catch { /* Invalid marker is replaced under the lock. */ }
    if (!pending || typeof pending.id !== "string" || pending.text !== snapshot.trim()) pending = { id: `field-note-${userId}-${crypto.randomUUID()}`, text: snapshot.trim() };
    storage.setItem(pendingKey, JSON.stringify(pending));
    const job = await pushFieldNote(fetcher, userId, jobId, pending);
    if (storage.getItem(key) === snapshot && storage.getItem(pendingKey) === JSON.stringify(pending)) {
      storage.removeItem(key);
      storage.removeItem(pendingKey);
    }
    return { draft: storage.getItem(key) || "", job };
  });
}
