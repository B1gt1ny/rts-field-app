# RTS Field App

A mobile-first field operations app for mobile home contractors. Built with Next.js, TypeScript, Tailwind CSS, Supabase-backed storage in production, and local JSON fallback for development.

> Deployment note: restored to the pre-field-PIN version on September 16, 2026.

## Features

- Dashboard with at-a-glance workload metrics and admin missing receipt-backup counter
- Today Command mobile view combining today’s jobs, reminders, parts attention, field closeout, and daily field actions
- Documents Hub for work orders, paperwork readiness, missing receipt-backup review, receipt files, category filters, recent file cabinet, and document manifest export
- Documents Hub supports direct filtered links such as missing receipt-backup review from the dashboard
- Command Feed for urgent work, waiting parts, missing paperwork, inspection review, follow-up flags, and billing attention
- Communication center with quick-entry job notes, copyable communication briefs, reminder dates, follow-up resolution/snooze controls, customer/source touches, and billing questions
- Tasks page with category filters for follow-ups, urgent jobs, parts, paperwork, photos, billing, missing receipt backup, and scheduling gaps
- Job-level time and trip log for arrivals, work starts, pauses, departures, mileage, and crew notes
- Factory job cost tracker for mileage, drive time, hourly/helper labor, per diem, hotel receipts, materials receipts, other receipts, and grand totals
- Job-level customer/source sign-offs for work authorization, completion approval, customer approval, and inspections
- Home-page monthly field calendar for quick scheduling reference
- Home-page follow-up reminder widget for overdue, due-today, and unscheduled communication follow-ups
- Schedule Board with today, tomorrow, upcoming week, and unscheduled active jobs
- Dedicated Reminders page for overdue, due-today, unscheduled, and upcoming follow-ups
- Reports page with manager snapshot including missing receipt backup, printable daily dispatch, parts run, billing review, sign-off review, inspection context, document manifest, and CSV exports
- Reports billing review rows flag missing uploaded receipt backup and open directly to Receipts when needed
- Communication CSV export for job notes, follow-up reminder dates, resolution history, audiences, and update history
- Installable phone-app basics with manifest, icon, and install instructions
- Install readiness helper with app-link copy/share buttons, copyable crew install instructions, and a lightweight offline shell
- Jobs by date, source, status, employee, and priority
- Customer profile directory grouped from job history with call, text, map, and latest-job actions
- Search and multi-filter job list
- Add and edit job workflows
- Phone-safe add/edit job draft autosave with restore/discard recovery
- Import work orders from uploaded photos/files or pasted work-order text with detected-field preview, review scoring, duplicate-search hints, and copyable import summaries
- Phone-safe work-order import draft autosave with restore/discard recovery
- Job details with tap-to-complete checklist and progress
- Job-level photo proof checklist for before, damage, serial/VIN, and after photos
- Printable customer/job profiles with saved original work-order files
- Printable closeout packet for each job with readiness, scope, paperwork, receipts, sign-offs, photos, and billing backup
- Share/copy/text job handoff actions from the job detail page
- Job-level communication handoff cards for customer updates, dealer/factory/individual source updates, manager handoffs, and logged notification status
- Offline field draft notes saved to the phone browser before pushing to job activity
- Structured parts tracker with needed, ordered, picked-up, installed, and not-needed statuses
- Job-level CompanyCam panel to create/open the matching photo project
- Job-level scheduling in RTS with a read-only ICS subscription for Google Calendar
- Flexible employee assignments (one person, multiple people, or full crew)
- Employee add, rename, deactivate, and daily dispatch assignment board
- Settings page for connected apps, platform readiness, integration next steps, admin control map, employee rollout checklist, company details, editable employee field/help instructions, editable customer text template, field support contact, saved employee field permissions, general options, and crew merchandise requests
- Admin-editable factory cost defaults for mileage, hourly, helper, and per diem rates
- Account page for password changes from the phone
- Admin user access with Admin, Manager, and Employee roles
- Employee field-app view at `/field` with linked employee login support, admin-editable field/review instructions and quick note buttons, due-date status chips, customer call/text shortcuts, customer/location basics, scope/parts summaries, paperwork shortcut, photo-proof guidance, latest job update cards, admin-controlled inline completion notes, Need Help/Call/Text Office support actions, receipt upload shortcut, plain-language closeout next steps, readiness cards, locked Ready Review percent labels, and one-tap Ready for Manager Review
- Employee closeout lane, action list, and Needs pill follow the same admin Ready Review requirement settings
- Employee Ready Review shows 100% ready with a clear message when admin has no required checks enabled
- Employee Need Help notes and Text Office messages include the first Ready Review blocker when available
- Employee job cards show quick Google Calendar and CompanyCam buttons when real job links already exist
- Employee field-app factory cost entry for miles, drive time, hotel, materials, other receipts, and notes, controlled by admin permissions
- Admin-editable factory cost instructions shown directly on employee factory cost cards
- Admin option to show or hide completed, billed, and paid jobs in the employee field app
- Admin options to require before, serial/VIN, after, and optional damage photo proof before employees can send Ready Review
- Admin option to require completion notes before employees can send Ready Review
- Admin options to require work-completed status and closed parts before employees can send Ready Review
- Admin option to require factory cost entries before employees can send factory jobs to Ready Review
- Admin option to require uploaded receipt backup before Ready Review when jobs include receipt or factory receipt dollars
- Admin/manager billing queue for ready-to-invoice jobs
- Factory cost grand totals shown in billing handoffs, closeout packets, billing board, and billing CSV exports
- Factory cost breakdowns for mileage, labor, per diem, hotel, materials, and other receipts in billing review and printed closeout packets
- Billing board warning when receipt or factory receipt dollars are entered without uploaded receipt backup
- Closeout packet warning when receipt or factory receipt dollars are entered without uploaded receipt backup
- Job-detail billing warning when entered receipt dollars are missing uploaded receipt backup
- Billing CSV export includes whether uploaded receipt backup is missing
- Closeout quality checks for billing readiness
- Manager inspection queue for Needs Inspection jobs with approve-complete and send-back actions
- Billing handoff buttons for Ready for Invoice, Needs More Info, Sent to Billing, Invoice Sent, On Hold, Paid, and copyable billing summaries
- CSV exports for all jobs, customer summary, daily dispatch, parts run, billing review, and document manifest
- Time log CSV export for manager review, payroll support, mileage, and billing questions
- Sign-offs CSV export for completion approval records and billing backup
- Online/offline field status indicator in the app header
- Admin cleanup preview for obvious test/demo/smoke records
- Server-rendered job data pages enforce login/role checks before rendering
- Supabase Storage file cabinet for work orders, paperwork, signed documents, and receipt files with role-aware file-open checks
- Admin integration readiness board for Supabase, auth, storage, CompanyCam, AI extraction, Invoice Simple, communication, Google Sheets, and AppSheet planning
- 10 realistic mock jobs
- Local JSON persistence through API routes

## Setup

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To verify a production build:

```bash
npm run typecheck
npm run build
npm start
```

## Storage

In production, jobs, employees, admin company settings, and merchandise requests are stored in Supabase Postgres. For a new installation, review `supabase/schema.sql` and `.env.example` before setup. Do not run schema/setup scripts against an existing production project without explicit owner approval. Checked-in schema is not proof of live RLS configuration. The service-role key is server-only and must never use a `NEXT_PUBLIC_` prefix.

Without Supabase environment variables, local development falls back to `data/jobs.json`, `data/employees.json`, `data/settings.json`, and `data/merch-requests.json`. Missing settings and merchandise files start from safe built-in defaults and are created on the first save. An empty hosted jobs table stays empty; it is never seeded with mock jobs automatically. Local fixtures are for development only.

The repository boundaries in `lib/jobs.ts`, `lib/employees.ts`, and `lib/settings.ts` are the intended replacement points for SQLite, Google Sheets, AppSheet, or a fuller multi-company database model.

## File storage

The app uses Supabase Storage as the file cabinet for work orders, paperwork, signed documents, and receipt uploads. Set `SUPABASE_STORAGE_BUCKET=job-files` or leave it unset to use the default bucket name.

The upload API uses a private bucket with server-side access checks. Production storage failures return a retryable error; the browser must keep the selected file and confirm upload/save success before clearing it. Inline data URLs are permitted only in unconfigured local development. Existing inline attachments remain readable; there is no migration or removal of historical files. Bucket creation on a missing bucket remains part of the existing upload setup behavior.

Photos can continue living in CompanyCam for now. Company Command should store the job profile, work orders, receipts, paperwork, and links back to CompanyCam photo projects.

## Admin and employee versions

The app uses Supabase Auth for login and role routing. Login runs through server-side API routes and secure cookies, so the browser does not need the Supabase anon key. Authorization comes exclusively from server-controlled Supabase `app_metadata`: `rtsRole` (Admin, Manager or Employee), `rtsEmployeeId` (existing employee ID) and `rtsAccessActive` (boolean). User-editable `user_metadata` and email allow-lists do not grant application authority. The Supabase ban state also blocks access. Disabling/reactivating a login preserves employee/job history.

`/api/auth/bootstrap-admin` is for an unclaimed installation only: it requires `AUTH_SETUP_CODE`, exactly one approved `ADMIN_EMAILS` identity, and no existing Admin or matching account. It never resets an existing password. It returns 404 when setup is disabled and 409 when ownership is already claimed. Normal account recovery must use the established Auth recovery process; never enable setup to work around a login test. Never commit secrets or snapshots.

Roles:

- Admin: settings, users, employees, delete jobs, integrations
- Manager: jobs, scheduling, paperwork, employees, billing status
- Employee: assigned field work, job checklist, notes, file uploads, closeout readiness and Ready for Manager Review. Manager/Admin reviews and completes jobs.

Crew members can open `/field` and see jobs assigned to their linked employee record or assigned to the full crew. Admins can link a login to an employee from Settings. Field closeout can move a job to **Needs Inspection** for manager review before an admin/manager marks the job complete and ready for billing.

CompanyCam is intentionally job-by-job. It does not create projects automatically for mock/test jobs. Add `COMPANYCAM_ACCESS_TOKEN` and `COMPANYCAM_USER_EMAIL` in Vercel, then open a real job and tap **Create CompanyCam project**. Invoice Simple integration can be added later; for now, Billing Command and each job profile provide copyable invoice handoff summaries plus manual invoice/payment status buttons.

RTS is the source of truth for job scheduling. Admins can copy the private ICS subscription link from Settings into Google Calendar under Other calendars → From URL. The dashboard monthly calendar shows RTS job due dates. Google Calendar does not send changes back to RTS.

Communication is intentionally manual for now. Job profiles can prepare customer/source/manager messages, open the phone text app, copy briefs, and log that someone was notified. Future SMS, email, Zenzap, or Slack-style messaging integrations should connect at the job activity layer without automatically sending messages until business rules and user permissions are approved.

Work-order import currently stores the original uploaded file on the job, auto-fills customer/job fields from text-based files or pasted text, shows a detected-field preview, scores the import for review, and links to duplicate-search checks before creating the profile. When configured, OpenAI photo/PDF extraction reads a private upload and returns a validated proposal. The Responses API parser accepts documented output message text as well as an SDK text aggregate. Extraction does not create a job: a manager reviews/applies the proposal, then explicitly saves the new job. Do not repeat paid provider tests without approval.

The Settings page includes a safe readiness board and an admin control map. It shows whether Supabase database/auth/storage and optional integration keys are present without exposing secrets, explains Admin/Manager/Employee responsibilities, lets admin edit the instructions and customer text template employees use in the field app, controls the field support contact and employee field permissions for phone actions like Need Help, start, notes, photos, parts, sign-offs, packets, and Ready Review, and shows what is live, staged, manual, or future so admins know the next setup step from the phone.

## Current scope

Automatic outbound notifications, full multi-company billing, and advanced external sync rules are still future work. OpenAI extraction is implemented and production verified. Authentication, file uploads, role-aware screens, manual communication logging, and job-by-job integration buttons are now part of the working app.


## Operator verification and release controls

The owner-maintained **RTS production completion ledger** (`outputs/completion-ledger.md` in the Codex task workspace, outside this repository) is the authoritative verification record. Use its latest section, the exact production deployment commit, and PR checks together; older pending sections are historical. A passing build or committed change does not authorize production release.

- Production Supabase project: `jegdchdjfntyrxufuqkg`. Do not substitute an accessible duplicate project.
- Current deployed baseline at documentation update: `e33fde3` (approved `a68ee59` plus the extraction parser correction). AUD-001–008 candidates remain outside production until explicitly approved.
- CompanyCam read verification passed. Write verification remains **UNVERIFIED**, pending safe cleanup/deletion authority; a Standard account cannot provide that cleanup. Do not create an unremovable disposable project.
- RTS scheduling is authoritative; private ICS subscriptions are read-only. Protect feed tokens and never restore the deprecated Google Calendar writer.
- Drafts belong to the signed-in account on this browser. Logout clears this device's drafts, including old unowned drafts; save important work before signing out. Existing unowned drafts are discarded, never assigned to whichever user signs in next. This is local recovery, not full offline synchronization.
- Job saves use revision conflict checks. On 409, refresh and review current work before retrying; do not blindly replay stale edits. After rollout, refresh older open tabs.
- Production account/password/role, RLS, schema, environment, credential and deployment changes require their own explicit authorization. Do not record credentials in logs, reports, screenshots or source.

Run local fixtures without real accounts, customer data, provider writes or paid extraction:

```bash
npm run typecheck
npm run verify:factory-billing
npm run verify:employee-onboarding
npm run verify:work-order-extraction
npm run verify:job-save-feedback
npm run verify:privacy-export
npm run build
npm run verify:production-boundaries
```

The production-boundary fixture starts the built app against loopback Auth/PostgREST/Storage mocks. It checks role/assignment denial, disabled access, concurrency and storage failures. It never targets the production Supabase project. PR gates run these existing checks; synthetic success is not a claim that live provider writes were verified.
