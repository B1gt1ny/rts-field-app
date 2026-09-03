import { getFactoryCostTotals, hasFactoryCostWork } from "../lib/factory-costs";
import { defaultFactoryCost, type FactoryCostTracker } from "../lib/types";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`);
}

const expanded: FactoryCostTracker = {
  ...defaultFactoryCost(),
  tripCount: "2",
  miles: "200",
  mileageRate: "0.75",
  driveTimeHours: "5",
  hourlyRate: "20",
  workHours: "8",
  workRate: "40",
  helperHours: "8",
  helperRate: "10",
  perDiemDays: "2",
  perDiemRate: "30",
  hotelTotal: "100",
  mealTotal: "45",
  materialsTotal: "125",
  otherReceiptsTotal: "20",
};

const totals = getFactoryCostTotals(expanded);
assertEqual(totals.mileage, 150, "Mileage total");
assertEqual(totals.driveTime, 100, "Drive-time total");
assertEqual(totals.work, 320, "Work-labor total");
assertEqual(totals.helper, 80, "Helper total");
assertEqual(totals.meals, 45, "Meal total");
assertEqual(totals.grandTotal, 1000, "Expanded factory total");
assertEqual(hasFactoryCostWork(expanded), true, "Expanded form is recognized as entered work");

const legacy = getFactoryCostTotals({
  mileageRate: "0.75",
  miles: "100",
  driveTimeHours: "2",
  hourlyRate: "20",
  helperHours: "",
  helperRate: "",
  perDiemDays: "",
  perDiemRate: "",
  hotelTotal: "",
  materialsTotal: "25",
  otherReceiptsTotal: "",
} as FactoryCostTracker);
assertEqual(legacy.grandTotal, 140, "Legacy factory records remain calculable");

console.log("Factory billing verification passed.");
