# Store Release Gates

This file tracks the remaining release work for Apple App Store and Google Play packaging.

## Gate 1 — Harden web core
- [x] Production validation runs on main and pull requests.
- [x] Typecheck, build, auth boundaries, privacy/export, extraction, billing, ICS, job-save and cover fixtures are release evidence.
- [x] Add baseline browser security headers and suppress framework disclosure.
- [ ] Add a real ESLint configuration rather than aliasing lint to TypeScript.
- [ ] Complete live Supabase security/performance advisor review.
- [ ] Complete safe CompanyCam write + cleanup verification.

## Gate 2 — Field resilience
- [x] Existing server compare-and-swap prevents silent concurrent job overwrite.
- [x] CompanyCam integration save retries preserve newer job edits.
- [ ] Durable per-user mutation queue for offline field writes.
- [ ] Idempotency keys for retryable write operations.
- [ ] Resumable/retry-safe photo and document uploads.
- [ ] Device tests for Wi-Fi/cellular/offline/reconnect transitions.

## Gate 3 — Native packaging
- [ ] Select and initialize the native shell after owner approval for the new mobile package/toolchain.
- [ ] iOS project, bundle identifier, signing, native camera/files/share/network/secure storage.
- [ ] Android project, application ID, signing, target API required by Google Play.
- [ ] Device builds and smoke tests.

## Gate 4 — Store compliance
- [ ] Final public product/company identity for policy documents.
- [ ] Privacy policy, terms, support, retention and account-deletion request pages.
- [ ] Apple privacy disclosures and Google Data Safety inventory.
- [ ] Store icon/screenshot/feature-art assets.
- [ ] Reviewer/demo-account instructions.

## Gate 5 — Release torture test
- [ ] Admin/Manager/Employee role matrix.
- [ ] Disabled/expired/unauthorized account cases.
- [ ] Concurrent edits and duplicate taps.
- [ ] Offline/reconnect and interrupted upload.
- [ ] CompanyCam/OpenAI/provider failure isolation.
- [ ] iOS and Android device matrix.
- [ ] Accessibility pass.
- [ ] Production smoke and rollback evidence.

## Approval boundary
Safe, reversible repository changes and tests may proceed. Park and request owner approval for destructive production changes, schema migrations with data risk, secret rotation, billing, native signing/account actions, irreversible data deletion, CompanyCam writes without cleanup authority, and actual store submission.
