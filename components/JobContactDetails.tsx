import { MapPinIcon, PhoneIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/lib/types";
import { jobContact } from "@/lib/job-cover";

export function JobContactDetails({ job }: { job: Pick<Job, "phone" | "address" | "city"> }) {
  const contact = jobContact(job);
  return <div className="mt-2 flex min-w-0 flex-col gap-1 text-sm font-semibold">
    {contact.phoneHref ? <a href={contact.phoneHref} className="inline-flex min-h-11 items-center gap-2 text-accent underline underline-offset-4"><PhoneIcon className="size-5 shrink-0" /><span className="break-words">{contact.phone}</span></a> : <p className="text-content/65">Phone not provided</p>}
    {contact.mapHref ? <a href={contact.mapHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-accent underline underline-offset-4"><MapPinIcon className="size-5 shrink-0" /><span className="min-w-0 break-words">{contact.address}</span></a> : <p className="text-content/65">Address not provided</p>}
  </div>;
}
