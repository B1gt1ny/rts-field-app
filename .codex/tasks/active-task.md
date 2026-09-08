# Active Task: Factory service field test

## Approved scope

- Simplify the existing employee field experience around one assigned factory service job.
- Apply the confirmed factory travel rates: $0.85 per mile and $20 per drive hour.
- Normalize recorded drive time to quarter-hour billing increments.
- Preserve job data, authentication, calendar sync, CompanyCam sync, and manager approval routing.

## Files in scope

- `lib/types.ts`
- `lib/factory-costs.ts`
- `components/FieldAppView.tsx`

## Out of scope

- Database migrations, environment variables, external API setup, schema changes, commits, deployment, and billing/work/helper rate assumptions.
