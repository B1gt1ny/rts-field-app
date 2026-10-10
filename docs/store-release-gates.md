# Store Release Gates

This file tracks the remaining release work for PUBLIC Apple App Store and Google Play listings. Updated October 10, 2026. Browser/PWA proof is separate from installed-native proof; unchecked native gates do not imply the corresponding web feature is absent.

## Gate 1 — Harden web core
- [x] Production validation runs on main and pull requests.
- [x] Typecheck, build, auth boundaries, privacy/export, extraction, billing, ICS, job-save and cover fixtures are release evidence.
- [x] Add baseline browser security headers and suppress framework disclosure.
- [ ] Consider a real ESLint configuration; current lint aliases TypeScript. This is an engineering improvement, not itself a store admission requirement; new dependencies need approval.
- [ ] Complete live Supabase security/performance advisor review.
- [ ] Complete safe CompanyCam write + cleanup verification.

## Gate 2 — Field resilience
- [x] Existing server compare-and-swap prevents silent concurrent job overwrite.
- [x] CompanyCam integration save retries preserve newer job edits.
- [x] Web offline note drafts and pending photo recovery are account-scoped; do not claim an arbitrary offline mutation queue or a fully cached job database.
- [x] Supported note/file retries use stable identity and revision checks; local/hosted interrupted-response checks exist. This is not a claim that every endpoint has server idempotency keys.
- [x] Web retry-safe uploads, lost-save recovery and duplicate prevention tested for the supported workflow.
- [x] User-assisted iPhone Safari picker/offline checks passed for the web pilot.
- [ ] Repeat Wi-Fi/cellular/offline/reconnect and app-kill recovery tests in installed iOS/Android builds.

## Gate 3 — Native packaging
- [ ] Approve native toolchain setup and a bounded native-host proof using the existing backend. Do not treat Capacitor live-reload server.url as the production packaging plan.
- [ ] iOS project, bundle identifier, signing, native camera/files/share/network/secure storage.
- [ ] Android project, application ID, signing, target API required by Google Play.
- [ ] Device builds and smoke tests.

## Gate 4 — Store compliance
- [x] Local candidate standardizes RTS Field App / RTS Land Solutions LLC identity and uses owner-confirmed support contact.
- [x] Local static privacy, support and account/data-request pages prepared; exact routes are public information only and do not authorize app/API access.
- [ ] Owner reviews/publishes policy copy and adopts workable retention/request-handling practices. Manual request pages do not implement automatic deletion.
- [ ] Apple privacy disclosures and Google Data Safety inventory.
- [ ] Store icon/screenshot/feature-art assets.
- [ ] Reviewer/demo-account instructions.

## Gate 5 — Release torture test
- [x] Web Admin/Manager/Employee role matrix tested; native repeat pending.
- [x] Web disabled/unauthorized and session renewal checks tested; native lifecycle repeat pending.
- [x] Web concurrent edits/duplicate-retry/account-switch denial tested; native repeat pending.
- [x] Web offline draft/reconnect and interrupted upload checks tested; native repeat pending.
- [ ] CompanyCam/OpenAI/provider failure isolation.
- [ ] iOS and Android device matrix.
- [x] Local candidate adds explicit mobile control names and clearer role navigation.
- [ ] Installed-build VoiceOver/TalkBack, dynamic text, contrast and physical device accessibility pass.
- [x] Existing web production release has deployment smoke and rollback evidence; this new usability candidate is not published yet.

## Approval boundary
Follow repository `AGENTS.md` and the owner’s explicit instructions for all approval requirements. This checklist is non-exhaustive and does not itself grant commit, push, merge, deployment, provider, security, or store-submission authorization.

Safe, reversible repository changes and tests may proceed. Park and request owner approval for destructive production changes, schema migrations with data risk, secret rotation, billing, native signing/account actions, irreversible data deletion, CompanyCam writes without cleanup authority, and actual store submission.
