import { NextResponse } from "next/server";
import { isAuthConfigured, isDatabaseConfigured, requireRole } from "@/lib/auth";
import { isCompanyCamConfigured } from "@/lib/integrations/companycam";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireRole(request, ["Admin", "Manager"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || "job-files";
  return NextResponse.json({
    integrations: {
      companyCam: isCompanyCamConfigured(),
      openAiExtraction: Boolean(process.env.OPENAI_API_KEY),
      invoiceSimple: Boolean(process.env.INVOICE_SIMPLE_API_KEY),
      zenzap: Boolean(process.env.ZENZAP_API_KEY),
      googleSheets: Boolean(process.env.GOOGLE_SHEETS_ID),
      appSheet: Boolean(process.env.APPSHEET_APP_ID),
    },
    platform: {
      database: isDatabaseConfigured(),
      auth: isAuthConfigured(),
      storage: isDatabaseConfigured(),
      storageBucket,
      adminEmails: Boolean(process.env.ADMIN_EMAILS),
      managerEmails: Boolean(process.env.MANAGER_EMAILS),
    },
    setup: {
      companyCamUserEmail: Boolean(process.env.COMPANYCAM_USER_EMAIL),
      authSetupCode: Boolean(process.env.AUTH_SETUP_CODE),
    },
  });
}
