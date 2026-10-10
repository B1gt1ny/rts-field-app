import type { Job, WorkOrderFile, FileCategory } from './types';

export type PendingUpload = { version: 1; epoch: string; id: string; ownerId: string; jobId: string; category: FileCategory; caption: string; file: Blob; fileName: string; fileType: string; acknowledged?: WorkOrderFile };
const databaseName = 'rts-pending-uploads';
export function uploadEpoch(ownerId: string) { return localStorage.getItem(`rts-upload-epoch:${ownerId}`) || "0"; }
export function invalidateOwnerUploads(ownerId: string) { localStorage.setItem(`rts-upload-epoch:${ownerId}`, crypto.randomUUID()); }
const storeName = 'files';
export interface UploadStore {
  list(ownerId: string, jobId: string): Promise<PendingUpload[]>;
  put(record: PendingUpload): Promise<void>;
  putBatch(records: PendingUpload[]): Promise<void>;
  remove(id: string): Promise<void>;
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('This browser cannot save upload recovery. Keep your files.')); return; }
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(storeName, { keyPath: 'id' }); };
    request.onerror = () => reject(new Error('Upload recovery storage could not be opened. Keep your files.'));
    request.onblocked = () => reject(new Error('Close other app tabs to open upload recovery. Keep your files.'));
    request.onsuccess = () => resolve(request.result);
  });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = action(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(new Error('Upload recovery could not be saved. Keep your files and retry.'));
    });
  } finally { db.close(); }
}
export const browserUploadStore: UploadStore = {
  async list(ownerId, jobId) {
    if (localStorage.getItem(`rts-upload-cleanup:${ownerId}`)) throw new Error("Local photo cleanup is incomplete. Sign out and retry cleanup before sending photos.");
    const records = await transaction<PendingUpload[]>('readonly', store => store.getAll());
    const owned = records.filter(record => record.ownerId === ownerId && record.jobId === jobId);
    if (owned.some(record => record.version !== 1 || typeof record.id !== 'string' || !(record.file instanceof Blob) || !record.file.size || typeof record.fileName !== 'string' || typeof record.fileType !== 'string')) throw new Error('A saved upload could not be read. Keep your original files and contact support.');
    return owned;
  },
  async put(record) { await transaction('readwrite', store => {
    const request = store.get(record.id);
    request.onsuccess = () => {
      const existing = request.result;
      if (!existing || existing.ownerId !== record.ownerId || existing.jobId !== record.jobId || record.epoch !== uploadEpoch(record.ownerId)) { request.transaction!.abort(); return; }
      store.put(record);
    };
    return request;
  }); },
  async putBatch(records) { if (records.length) await transaction('readwrite', store => { if (records.some(record => record.epoch !== uploadEpoch(record.ownerId) || localStorage.getItem(`rts-upload-cleanup:${record.ownerId}`))) throw new Error('Account changed during photo preparation. Keep your original files.'); const requests = records.map(record => store.put(record)); return requests[requests.length - 1]; }); },
  async remove(id) { await transaction('readwrite', store => store.delete(id)); },
};
export async function clearOwnerUploads(ownerId: string) {
  // One transaction; never clear records belonging to another account.
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).openCursor();
      request.onsuccess = () => { const cursor = request.result; if (cursor) { if (cursor.value.ownerId === ownerId) cursor.delete(); cursor.continue(); } };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(new Error('Local photo cleanup is incomplete. Keep this device private until cleanup succeeds.'));
    });
    localStorage.removeItem(`rts-upload-cleanup:${ownerId}`);
  } finally { db.close(); }
}
export async function attachPendingUploads(store: UploadStore, locks: Pick<LockManager, 'request'> | undefined, fetcher: typeof fetch, ownerId: string, jobId: string, upload: (record: PendingUpload) => Promise<WorkOrderFile>) {
  if (!locks) throw new Error('This browser cannot safely coordinate photo recovery. Keep your files and use an updated browser.');
  return locks.request(`rts-upload:${encodeURIComponent(ownerId)}:${encodeURIComponent(jobId)}`, async () => {
    const identity = await fetcher('/api/auth/me');
    if (!identity.ok || (await identity.json()).user?.id !== ownerId) throw new Error('Sign into the account that saved these photos before retrying.');
    const records = await store.list(ownerId, jobId);
    for (const record of records) {
      if (!record.acknowledged) {
        record.acknowledged = await upload(record);
        await store.put(record);
      }
    }
    const response = await fetcher(`/api/jobs/${encodeURIComponent(jobId)}`);
    if (!response.ok) throw new Error('This job could not be opened. Your photos remain saved.');
    const latest = await response.json() as Job;
    const files = Array.from(new Map(records.map(record => [record.acknowledged!.id, record.acknowledged!])).values());
    const missing = files.filter(file => !(latest.workOrderFiles || []).some(saved => saved.id === file.id));
    let confirmed = latest;
    if (missing.length) {
      const patch: Partial<Job> = { workOrderFiles: [...missing, ...(latest.workOrderFiles || [])] };
      const buckets = { Before: 'beforePhotos', After: 'afterPhotos', Damage: 'damagePhotos', 'Serial / Tags': 'serialTagPhotos' } as const;
      for (const [category, bucket] of Object.entries(buckets)) {
        patch[bucket] = Array.from(new Set([...(latest[bucket] || []), ...files.filter(file => file.category === category).map(file => file.storageUrl || file.dataUrl)]));
      }
      const saved = await fetcher(`/api/jobs/${encodeURIComponent(jobId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...patch, expectedRevision: latest.revision || null, expectedUserId: ownerId }) });
      if (!saved.ok) throw new Error(saved.status === 409 ? 'This job changed. Your photos remain saved; review and retry.' : 'Photo attachment could not be confirmed. Your photos remain saved.');
      confirmed = await saved.json() as Job;
    }
    if (!files.every(file => confirmed.workOrderFiles?.some(saved => saved.id === file.id))) throw new Error('Photo attachment could not be confirmed. Your photos remain saved.');
    for (const record of records) await store.remove(record.id);
    return confirmed;
  });
}
