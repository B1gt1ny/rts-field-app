import { JobsView } from "@/components/JobsView";
export default function WaitingPage() { return <JobsView title="Waiting on Parts" description="Jobs paused until required materials arrive." preset={{ status: "Waiting on Parts" }} />; }
