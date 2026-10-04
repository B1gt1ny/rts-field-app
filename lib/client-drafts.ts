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
