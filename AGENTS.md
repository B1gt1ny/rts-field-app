# RTS Field App — Codex Instructions

## Product purpose

This is a simple, mobile-first field-service and job-management app for RTS Land Solutions.

Primary users:

- Owner/admin
- Dispatcher/manager
- Field employees

The app must remain practical for workers using phones in the field.

## Credit and context efficiency

For every task:

- Read only the files needed for the requested change.
- Do not inspect or summarize the entire repository unless required.
- Use existing components, styles, utilities, tables, and patterns.
- Make the smallest complete change that satisfies the request.
- Do not perform unrelated cleanup or broad refactoring.
- Do not install packages unless the existing stack cannot reasonably complete the task.
- Do not rewrite entire files when a focused edit is possible.
- Do not generate lengthy explanations.
- Do not create duplicate routes, components, tables, or utilities.

## Product organization

The main app should ultimately center around:

1. Dashboard
2. Jobs
3. Schedule
4. Employees / Field
5. Admin

Job-related information should normally live inside the job record instead of separate top-level pages:

- Overview
- Checklist
- Photos
- Parts
- Documents
- Notes
- Billing
- History

## Interface rules

- Design mobile-first.
- Keep one clear primary purpose per screen.
- Reduce visual clutter and duplicated information.
- Use progressive disclosure for secondary details.
- Keep primary field actions easy to reach.
- Avoid unnecessary cards, counters, colors, and repeated navigation.
- Preserve the existing branding unless explicitly instructed otherwise.
- Maintain accessibility and readable touch targets.

## Change protection

- Preserve working behavior outside the requested scope.
- Do not rename routes, database objects, APIs, environment variables, or authentication flows without explicit approval.
- Do not alter production data.
- Never expose private keys or service credentials in client code.
- Do not commit environment-variable values.
- Identify migrations and breaking changes before executing them.

## Work process

Before implementation:

1. Read this file.
2. Inspect only relevant code.
3. Provide a brief plan of no more than 8 lines.
4. State any migration, package, environment-variable, or breaking-change requirement.
5. Wait for approval when the task is marked PLAN ONLY.

During implementation:

1. Work only within the approved scope.
2. Keep changes small and reusable.
3. Do not add optional features that were not requested.

After implementation:

1. Run the relevant type check, lint, tests, and build.
2. Fix errors caused by the change.
3. Review the diff for unrelated changes.
4. Report only:
   - files changed,
   - work completed,
   - checks run,
   - unresolved issues,
   - manual setup required.
