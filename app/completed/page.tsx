import { JobsView } from "@/components/JobsView";
export default function CompletedPage() { return <JobsView title="Completed Jobs" description="Finished, billed, and paid work." preset={{ status: ["Complete", "Billed", "Paid"] }} />; }
