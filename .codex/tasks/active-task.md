# Active Task: Optional parts workflow

## Approved scope

- Keep parts visible and editable as optional operational tracking.
- Do not let legacy or structured parts block job review, completion, or billing.
- Do not automatically move a job to Waiting on Parts when a part is requested or updated.
- Present the opening checklist order as Work order, Scope reviewed, Parts picked up.
- Treat Parts picked up as optional so it does not lower checklist completion.
- Preserve job data, authentication, calendar sync, CompanyCam sync, manager approval routing, and billing calculations.

## Files in scope

- `lib/job-readiness.ts`
- `components/JobDetail.tsx`
- `components/JobCard.tsx`
- `components/JobsView.tsx`
- `components/CustomersView.tsx`
- `components/FieldAppView.tsx`
- `components/SettingsPanel.tsx`
- `components/TodayCommandView.tsx`
- `components/ReadyCheckView.tsx`
- `lib/settings.ts`
- `lib/types.ts`
- `app/api/reports/export/route.ts`
- `scripts/verify-parts-closeout.ts`
- `package.json`

## Out of scope

- Database migrations, environment variables, external API setup, schema changes, packages, auth changes, additional commits, and deployment.
