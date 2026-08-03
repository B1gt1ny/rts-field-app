import type { FactoryCostTracker, Job } from "./types";

export function getFactoryCostTotals(cost?: FactoryCostTracker) {
  const numberValue = (value?: string) => Number(value) || 0;
  const mileage = numberValue(cost?.miles) * numberValue(cost?.mileageRate);
  const driveTime = numberValue(cost?.driveTimeHours) * numberValue(cost?.hourlyRate);
  const helper = numberValue(cost?.helperHours) * numberValue(cost?.helperRate);
  const perDiem = numberValue(cost?.perDiemDays) * numberValue(cost?.perDiemRate);
  const hotel = numberValue(cost?.hotelTotal);
  const materials = numberValue(cost?.materialsTotal);
  const otherReceipts = numberValue(cost?.otherReceiptsTotal);
  return {
    mileage,
    driveTime,
    helper,
    perDiem,
    hotel,
    materials,
    otherReceipts,
    grandTotal: mileage + driveTime + helper + perDiem + hotel + materials + otherReceipts,
  };
}

export function hasFactoryCostWork(cost?: FactoryCostTracker) {
  if (!cost) return false;
  return Boolean(
    cost.miles?.trim() ||
    cost.driveTimeHours?.trim() ||
    cost.helperHours?.trim() ||
    cost.perDiemDays?.trim() ||
    cost.hotelTotal?.trim() ||
    cost.materialsTotal?.trim() ||
    cost.otherReceiptsTotal?.trim() ||
    cost.notes?.trim(),
  );
}

export function factoryCostGrandTotal(job: Job) {
  if (job.source !== "Factory") return 0;
  return getFactoryCostTotals(job.factoryCost).grandTotal;
}
