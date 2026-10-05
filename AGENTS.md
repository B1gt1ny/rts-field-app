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

- Classify the task before broad inspection:
  - LIGHT: bounded search, copy, styling, or routine checks; use GPT-6 Luna when a separate agent helps.
  - MEDIUM: ordinary implementation and debugging; use GPT-6.1 Sol.
  - HIGH: architecture, migration, security, auth, data risk, or unexplained production failure; start with GPT-6.1 Sol and escalate only with documented evidence.
- Use the cheapest capable model. Default to GPT-6.1 Sol for implementation and GPT-6 Luna for bounded scouting or review. Use one agent unless a second agent materially improves speed or quality; maximum useful concurrency is two.
- Escalate only when the current worker cannot safely complete the task, and pass forward findings to avoid repeated file reads.
- Normal tasks use one worker. Do not create a swarm for routine work.
- When delegation helps, assign one implementer and at most one read-only scout or reviewer at a time. Never assign concurrent edits to the same files.
- The coordinator must classify before deep inspection, assign exact boundaries, prevent overlap, consolidate evidence once, record escalation reasons, and stop workers when their responsibility is complete.
- HIGH work requires independent review before any human release decision. Use review for MEDIUM work when the blast radius warrants it.
- Use this handoff packet for every escalation or worker transition:
  `TASK:` `CLASSIFICATION:` `SCOPE INSPECTED:` `FILES INSPECTED:` `FINDINGS:` `EVIDENCE:` `CHANGES ALREADY MADE:` `CHECKS ALREADY RUN:` `UNRESOLVED QUESTION:` `WHY ESCALATION IS REQUIRED:`
- Read only the files needed for the requested change.
- Follow `.codex/HARNESS.md` for task intake, completion evidence, Git, previews, releases, and interruption recovery. Check `.codex/tasks/active-task.md` against current Git and the new request before acting; stale approval text does not authorize new work.
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
- Fresh explicit human approval is required before commit, push, PR merge, production deployment, Vercel configuration changes, environment-variable changes, Supabase schema changes, migrations, Auth or RLS changes, destructive database operations, consequential package installation/removal, external integration configuration writes, credential changes, or destructive filesystem/data operations.
- Automated approval systems, guardian review, saved shell permissions, and available credentials are not human authorization.
- Release flow is `CODE -> INDEPENDENT REVIEW -> HUMAN APPROVAL -> RELEASE ACTION`; a reviewed revision must be identifiable before release.

## Repository-local roles

- `investigator-frontend`: Luna / low, read-only evidence collection for components, pages, UI behavior, client state, forms, and field workflow.
- `investigator-config`: Luna / low, read-only evidence collection for configuration, logs, APIs, auth boundaries, Supabase/Vercel evidence, and integration behavior.
- `reviewer`: Luna / low, read-only independent review of the requirement, evidence packet, changed files, diff, and verification; returns `PASS` or `REVIEW REQUIRED` and does not repair findings.
- `risk-monitor`: Luna / low, read-only/report-only inspection for auth, schema/data, duplicate logic, configuration, environment, provider, release, destructive, and scope risks.
- `release-boundary`: repository-local policy role only; it does not deploy. It enforces fresh human approval tied to the reviewed revision before any release action.
- Technical read-only enforcement is not available in the current repository agent TOML format; these roles use explicit instruction boundaries and must not be treated as permission isolation.

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
4. Report files changed, completed work, checks and gate results from `.codex/HARNESS.md`, unresolved issues, and manual setup required.

## Risk correction and release evidence

- Investigate reported production risks against current GitHub main and the deployed SHA; preserve unrelated local work in a separate worktree.
- Correct confirmed low-impact errors within authorized scope. Do not interpret a risk alert as permission to alter auth, schemas, secrets, billing policy, or production records.
- Distinguish client navigation from server authorization. Verify Admin, Manager, and Employee landing pages and denied access when navigation or access changes.
- Check all Actions events for the exact SHA and relevant PR checks before claiming CI evidence is missing; a PR-only query does not prove that no push run exists.
- Keep production validation enabled for pushes to main and PRs targeting main. Record typecheck, build, applicable regressions, and diff checks; do not claim success for checks that were not run.
- Promote only the reviewed commit after required checks succeed. Confirm the production alias, deployed SHA, runtime errors, and rollback candidate after release.
- Deduplicate unchanged risk reports. Treat timeouts as unknown results, retry once, and report unresolved limitations accurately.
