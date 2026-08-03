import { getFactoryCostTotals } from "./factory-costs";
import type { Job } from "./types";

export function hasReceiptDollars(job: Job) {
  const receiptTotal = (job.receipts || []).reduce((sum, receipt) => sum + (Number(receipt.amount) || 0), 0);
  const factoryCosts = getFactoryCostTotals(job.factoryCost);
  return receiptTotal > 0 || factoryCosts.hotel > 0 || factoryCosts.materials > 0 || factoryCosts.otherReceipts > 0;
}

export function hasUploadedReceiptBackup(job: Job) {
  return Boolean(
    (job.receipts || []).some((receipt) => Boolean(receipt.file)) ||
    (job.workOrderFiles || []).some((file) => file.category === "Receipt"),
  );
}

export function isReceiptBackupMissing(job: Job) {
  return hasReceiptDollars(job) && !hasUploadedReceiptBackup(job);
}
