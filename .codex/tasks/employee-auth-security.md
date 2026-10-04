# Employee authorization correction — release handoff

Classification: HIGH. Scope: trusted RTS role and employee link, account disable/reactivation, local fixtures, migration planning. Production accounts, data, Auth settings, and RLS are untouched.

## Current design

Supabase Auth `app_metadata` carries `rtsRole`, `rtsEmployeeId`, `rtsEmployeeName`, and `rtsAccessActive`. The server reads these only from an Auth `getUser` response on each request; legacy `user_metadata` and email allowlists are ignored for authorization. Missing trusted role or `rtsAccessActive !== true` fails closed. Admin user operations use the server-only service role key. Disabling access sets `rtsAccessActive=false` and a Supabase Auth ban; reenabling sets true and removes the ban. Employee records and historical jobs remain intact.

## Production migration proposal — NOT EXECUTED

1. Before release, take a read-only, paginated Auth user inventory from the confirmed production Supabase project. Record total account count, each account's stable Auth ID, legacy role/link, current trusted role/link, ban status, and the linked `public.employees` ID/status in a private review artifact. Do not include passwords or tokens. Do not trust legacy `user_metadata` as authority.
2. Independently confirm each proposed Admin/Manager role and employee link against RTS management's roster and the current approved administrator list. Flag duplicates, missing employee IDs, and discrepancies for human resolution. Produce a reviewed mapping keyed by stable Auth ID and a before snapshot of existing `app_metadata` and ban status. No account may be promoted based only on user-editable metadata.
3. With separate production migration approval, use the Supabase Admin API server side to update only reviewed IDs. Preserve existing `app_metadata` keys. Set `rtsRole`, `rtsEmployeeId`, `rtsEmployeeName`, and `rtsAccessActive=true` for approved active accounts; mark explicitly disabled accounts false. Verify each returned value and read back the full inventory. Keep the mapping and before snapshot private.
4. Deploy the reviewed code only after every intended production account has trusted metadata, or coordinate a maintenance window because the new code fails closed for unmigrated accounts. Check Admin, Manager, Employee, and disabled-account logins and assigned-job visibility with approved test identities. Do not test by changing real employee accounts without approval.
5. Rollback: if migration fails before deployment, restore each account's saved `app_metadata` and ban status by stable Auth ID. If code release fails after migration, roll back to the prior deployment while retaining the private snapshot and auditing any newly created accounts. Because old code still reads user metadata, do not treat rollback as a security fix; restrict access or complete a corrected deployment promptly.

## Known limits

- Production Auth inventory/count and live RLS policies have not been verified. The checked-in SQL enables RLS and grants service-role access, but is not proof of production state.
- `lib/auth-migration.ts` creates a deterministic read-only review plan and deliberately does not convert untrusted legacy metadata into trusted roles. It performs no provider writes.
- The existing bootstrap endpoint still requires its setup code and approved admin email. Its metadata write now targets `app_metadata`; review production setup-code availability before release.
