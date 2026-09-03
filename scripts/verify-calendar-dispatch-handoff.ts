import { jobSaveDestination } from "../lib/calendar-dispatch-handoff";

function assertEqual(actual: string, expected: string) {
  if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`);
}

assertEqual(jobSaveDestination("RTS-411", { origin: "calendar", returnTo: "/dispatch" }), "/dispatch?from=calendar&job=RTS-411");
assertEqual(jobSaveDestination("RTS 412", { origin: "calendar", returnTo: "/dispatch" }), "/dispatch?from=calendar&job=RTS%20412");
assertEqual(jobSaveDestination("RTS-413", {}), "/jobs/RTS-413");

console.log("Calendar dispatch handoff validation fixtures passed.");
