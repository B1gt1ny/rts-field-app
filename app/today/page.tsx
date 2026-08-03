import { JobsView } from "@/components/JobsView";
export default function TodayPage() { return <JobsView title="Today’s Jobs" description="The work due today across all assigned employees." preset={{ today: true }} />; }
