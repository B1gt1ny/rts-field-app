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
## Travel-leg extension

# Goal
Implement structured travel legs as the preferred travel activity model while preserving legacy time entries and keeping rates admin-controlled.

# Scope
Add optional `travelLegs?: TravelLeg[]` with date, from, to, departure, arrival, miles, and employee attribution. Prefer structured-leg totals when travel legs contain activity; otherwise preserve legacy `timeEntries` and factory-cost behavior. Hide billing-rate fields from employees while preserving admin/billing rates.

# Prohibited Changes
Do not migrate or rewrite legacy `timeEntries`, sum both representations for one job, add a second editable travel-pricing path, perform schema/package/auth/integration/credential/environment changes, or broad billing/timekeeping refactors. Protect all pre-existing dirty/untracked work.

# Required Verification
Run typecheck, production build, `git diff --check`, review Sprint 6.3 hunks only, verify legacy/one-leg/multi-leg/incomplete/invalid legs and precedence/no-double-counting, confirm creating/saving a structured TravelLeg does not create, rewrite, or duplicate legacy timeEntries, verify employees cannot see/edit rates, confirm admin/billing rates remain applied, and stop before commit.
