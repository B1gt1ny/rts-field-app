import type { FactoryCostTracker, Job } from "./types";

export function getFactoryCostTotals(cost?: FactoryCostTracker) {
  const numberValue = (value?: string) => Number(value) || 0;
  const mileage = numberValue(cost?.miles) * numberValue(cost?.mileageRate);
  const driveTime = numberValue(cost?.driveTimeHours) * numberValue(cost?.hourlyRate);
  const work = numberValue(cost?.workHours) * numberValue(cost?.workRate);
  const helper = numberValue(cost?.helperHours) * numberValue(cost?.helperRate);
  const perDiem = numberValue(cost?.perDiemDays) * numberValue(cost?.perDiemRate);
  const hotel = numberValue(cost?.hotelTotal);
  const meals = numberValue(cost?.mealTotal);
  const materials = numberValue(cost?.materialsTotal);
  const otherReceipts = numberValue(cost?.otherReceiptsTotal);
  return {
    mileage,
    driveTime,
    work,
    helper,
    perDiem,
    hotel,
    meals,
    materials,
    otherReceipts,
    grandTotal: mileage + driveTime + work + helper + perDiem + hotel + meals + materials + otherReceipts,
  };
}

export function hasFactoryCostWork(cost?: FactoryCostTracker) {
  if (!cost) return false;
  return Boolean(
    cost.tripCount?.trim() ||
    cost.miles?.trim() ||
    cost.driveTimeHours?.trim() ||
    cost.workHours?.trim() ||
    cost.helperHours?.trim() ||
    cost.perDiemDays?.trim() ||
    cost.hotelTotal?.trim() ||
    cost.mealTotal?.trim() ||
    cost.materialsTotal?.trim() ||
    cost.otherReceiptsTotal?.trim() ||
    cost.notes?.trim(),
  );
}

export function factoryCostGrandTotal(job: Job) {
  if (job.source !== "Factory") return 0;
  return getFactoryCostTotals(job.factoryCost).grandTotal;
}
