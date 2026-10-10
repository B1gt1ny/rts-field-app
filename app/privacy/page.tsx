import { PublicInformationPage } from "@/components/PublicInformationPage";

export default function PrivacyPage() {
  return <PublicInformationPage title="Privacy policy">
    <p>RTS Field App supports RTS job intake, scheduling, field documentation, Manager review and billing preparation. Downloading or opening the app does not grant access to RTS jobs. Job information is available only to authorized accounts according to their role and assignment.</p>
    <h2 className="text-xl font-bold">Information used by the app</h2>
    <p>The app handles account and employee details; customer contact and service-address information; work orders and unit identifiers; job photos, documents and receipts; labor, travel and mileage; completion and review records; and activity history. Drafts and pending uploads may be stored locally on the device for recovery. Use a trusted device and sign out when finished.</p>
    <h2 className="text-xl font-bold">How information is used and shared</h2>
    <p>RTS uses this information to assign and perform work, document service, review completion and prepare billing. Supabase provides authentication, database and private file storage. Vercel hosts the application.</p>
    <p>If you choose optional AI extraction, the selected work-order file and its contents are sent to OpenAI to suggest job fields after your permission. You can enter the job manually. Review suggested fields before saving. Optional CompanyCam integration shares relevant job and photo information when enabled and used.</p>
    <h2 className="text-xl font-bold">Support, corrections and deletion requests</h2>
    <p>Contact RTS using the email below for support, corrections, or an account/data-deletion request. Include your account email and the request; do not email passwords, access tokens or unnecessary customer documents. RTS will verify the requester before making changes.</p>
    <p>Removing account access and deleting data are different actions. Some job, billing or service records may need to be retained for legitimate business or legal reasons. RTS will explain applicable retention when reviewing a request.</p>
  </PublicInformationPage>;
}
