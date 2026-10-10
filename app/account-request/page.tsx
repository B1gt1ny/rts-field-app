import { PublicInformationPage } from "@/components/PublicInformationPage";
import { supportEmail } from "@/lib/public-pages";

export default function AccountRequestPage() {
  return <PublicInformationPage title="Account and data deletion requests">
    <p>Email RTS using the link below with the subject “RTS Field App account/data deletion request.” Include the email used for your RTS account and whether you want account deletion, deletion of particular personal information, or both. Do not send your password. RTS will verify your identity and review the request.</p>
    <a href={`mailto:${supportEmail}?subject=RTS%20Field%20App%20account%2Fdata%20deletion%20request`} className="btn-primary">Prepare request email</a>
    <p>Deleting an account is different from deactivating its access. Job records may contain information belonging to customers or other crew members. Records required for justified business or legal obligations may be retained; RTS will explain affected records and the basis for retention when reviewing the request. A request does not itself cancel a job, invoice or payment obligation.</p>
  </PublicInformationPage>;
}
