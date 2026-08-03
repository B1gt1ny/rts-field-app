import { JobsView } from "@/components/JobsView";

export default function IndividualPage() {
  return <JobsView title="Individual Jobs" description="Direct customer work that did not come through a dealer or factory." preset={{ source: "Individual" }} />;
}
