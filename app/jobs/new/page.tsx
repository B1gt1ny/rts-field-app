import { JobForm } from "@/components/JobForm";
import { RoleGuard } from "@/components/RoleGuard";
export default function NewJobPage() { return <RoleGuard allowed={["Admin", "Manager"]}><div className="mx-auto max-w-4xl"><div className="mb-6"><p className="text-sm font-extrabold uppercase tracking-widest text-forest">Jobs</p><h1 className="text-3xl font-black">Add Job</h1><p className="mt-1 text-black/50">Create a new field work order.</p></div><JobForm /></div></RoleGuard>; }
