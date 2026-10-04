# RTS Field App — Codex engineering harness

This guide implements `AGENTS.md`; that file controls if the two differ. Keep the workflow in this repository. No background agent or provider action is implied by these instructions.

## 1. Intake and discovery

1. Read `AGENTS.md`, then `.codex/tasks/active-task.md`, then `git status --short --branch` and `git log -1 --oneline`. Treat an old task or approval as historical until its scope and Git revision match the new request. Record dirty and untracked paths before editing; preserve them.
2. Classify LIGHT, MEDIUM, or HIGH and name the requested outcome. Search existing code, docs, branches, task notes, tests, scripts, and applicable skills before creating a second implementation. Check shared auth, storage, billing, API, configuration, and integration boundaries when relevant.
3. Record exact in-scope files or areas, prohibited changes, acceptance checks, and approval state in the task packet below. Ask only for a missing decision that blocks safe work. A request to implement authorizes scoped edits, not commit, push, provider writes, or release.
4. Prefer one agent. Use GPT-6.1 Sol for implementation/debugging. Use GPT-6 Luna for a bounded, read-only scout/review assignment when that saves work or reduces risk. Maximum useful concurrency is two. No overlapping edits. Escalate to an expensive model only after recording the blocker and prior evidence.

## 2. Implementation and completion

- The implementer owns code changes and targeted checks. Reuse existing types, components, utilities, routes, and test patterns. Preserve unrelated behavior and all pre-existing dirty work. Never run clean/reset/stash against protected work.
- A scout/reviewer receives the requirement, exact scope, changed-file list, relevant diff, and checks. It reports omissions, regressions, and uncertainty; its statement is evidence to inspect, not completion proof.
- Verify the changed behavior with the smallest meaningful tests. Run `npm run typecheck` and `npm run build` for app changes when the local environment supports them; run relevant `verify:*` scripts. Documentation-only changes need markdown/content review and `git diff --check`, not an app build.
- Review `git diff --check`, `git status --short`, and the complete in-scope diff. Separate pre-existing changes from this task. Never broad-stage a dirty checkout.
- Report each applicable gate as PASS, FAIL, or UNVERIFIED: IMPLEMENTATION, SCOPE, DISCOVERY, TYPECHECK/VALIDATION, BUILD, DIFF/CHANGE REVIEW, DEPENDENCIES, REVIEW. Finish with STATUS: ELIGIBLE FOR APPROVAL, BLOCKED, or INCOMPLETE. A gate is PASS only with direct evidence.

## 3. Git, preview, and production

1. Before commit, identify the exact reviewed paths and revision. Stage only those paths or hunks, inspect `git diff --cached`, and run `git diff --cached --check`. Commit requires fresh explicit human approval.
2. Push and PR creation/update are separate external actions requiring explicit approval under `AGENTS.md`. Use a PR to review the exact intended diff. Existing GitHub Actions workflows validate PRs to `main`; inspect their actual results. A passing action is not proof of runtime behavior.
3. For preview, first determine the target branch, preview URL, environment, data connection, and deployment settings. Obtain approval before any action that pushes code or changes Vercel configuration. Treat preview as potentially connected to real Supabase data until verified otherwise. Test with read-only or approved test data and report the URL, commit SHA, checks, and untested paths.
4. For production, prepare a release packet with exact SHA, diff, review result, CI/build result, preview evidence, migration/configuration implications, rollback ref, and remaining risks. Obtain fresh explicit approval tied to that SHA before merge, promotion, deployment, or provider changes. After release, verify the deployment identity and narrow live behavior. Do not infer live state from local build or transformed third-party views.
5. If review, SHA, scope, or configuration changes, repeat affected checks and request approval for the new release candidate. Never use a prior approval as a standing release instruction.

## 4. Recovery and credit control

- Keep the current task packet in `.codex/tasks/active-task.md` when the user has approved changing that file. If it contains protected or unrelated work, leave it intact and put a new handoff in a separately named task file. Do not silently overwrite a stale packet.
- Before a long interruption, write a short durable handoff: current branch/SHA, objective, approval state, in-scope paths, protected dirty baseline, changes made, checks and results, blockers, and the smallest next action. On resume, compare it with current Git state before continuing.
- Stop scouting as soon as the relevant files are known. Avoid duplicate agents, repeated broad scans, unnecessary builds, package installs, and redoing previously verified work unless code or environment changed. Do not create a permanent role for a one-off task.

## Task packet template

```text
TASK:
CLASSIFICATION: LIGHT | MEDIUM | HIGH
OUTCOME AND ACCEPTANCE:
APPROVAL STATE:
BRANCH / BASE SHA:
PROTECTED DIRTY BASELINE:
DISCOVERY / EXISTING SOLUTION:
IN-SCOPE PATHS:
PROHIBITED CHANGES / BLAST RADIUS:
AGENT ASSIGNMENT (if useful):
CHANGES MADE:
CHECKS AND RESULTS:
REVIEW / OPEN RISKS:
NEXT ACTION:
```
