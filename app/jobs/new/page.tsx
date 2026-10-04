import { JobForm } from "@/components/JobForm";
import { RoleGuard } from "@/components/RoleGuard";
export default function NewJobPage() { return <RoleGuard allowed={["Admin", "Manager"]}><div className="mx-auto max-w-4xl"><div className="mb-6"><p className="text-sm font-extrabold uppercase tracking-widest text-accent">Jobs</p><h1 className="text-3xl font-bold">Add Job</h1><p className="mt-1 text-content/65">Create a new field work order.</p></div><JobForm /></div></RoleGuard>; }
