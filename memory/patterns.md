# Project Patterns

## Monorepo Command Boundaries

- Run Expo, Expo Doctor, mobile tests, and mobile typechecking from `mobile/`.
- Run Git operations and repository-wide Next.js tests/typecheck/build from the repository root.

## Mobile Authentication

- Keep the API bearer token synchronized from Supabase `onAuthStateChange`; do not assume the token captured at initial login remains valid.
- On native platforms, start Supabase auto-refresh only while AppState is active and stop it in background/inactive states.
- Treat a signed-out event as fail-closed local cleanup even when remote sign-out fails.

## Offline Replay

- Never queue mutations by default.
- Require a same-origin relative path, authenticated owner ID, and backend-supported idempotency key.
- Never persist bearer tokens in AsyncStorage; inject the current token only at replay time.
- Keep queues owner-scoped and retain exhausted entries for visible/manual recovery instead of silently dropping data.
- Persist one idempotency key with the user draft and reuse it for every retry; generate a new key only after the save is accepted or the form is reset.
- Auto-sync at online startup as well as reconnection, but guard each owner/pending-count attempt so persistent failures do not spin continuously.
- Count current replay failures in the sync result and expose pending/failed state globally; retained requests must not become invisible.

## Idempotent Journal Writes

- Derive a deterministic UUID from the authoritative resolved user ID plus the validated idempotency key, then rely on the existing UUID primary key as the atomic concurrency boundary.
- On unique-key conflict, fetch by both deterministic ID and owner and compare all request-owned fields before treating the response as a replay.
- Return HTTP 409 when the same key is reused with different content; do not re-trigger background side effects for a successful replay.
- Normalize legacy input at the route boundary, validate once, and store a single canonical camel-case-to-database mapping.

## Owner-Scoped Async State

- Track which owner a pending count or sync result belongs to.
- Clear visible counts/results synchronously when the account changes.
- Before applying an awaited result, verify the same owner is still active so stale work cannot overwrite the new account's state.

## Account-Scoped Local Data

- Keys containing user-authored content must include the user ID.
- Remove legacy global keys during cleanup so an account switch cannot expose old content.
- Preserve scoped drafts on an expired session only; remove them on explicit logout or account deletion.

## Windows Verification

- Mobile Vitest is stable with threads, one worker, no file parallelism, and `isolate: false` in this environment.
- Metro export is reliable with `--max-workers 1`, though it may take 5–7 minutes.
- When a parent shell timeout detaches Metro, rerun the local Expo CLI directly with explicit Node memory and a temporary output directory to obtain a definitive exit code.
- Root Next.js builds can exceed 15 minutes from a cold cache because Sentry source-map processing is substantial; a cached retry completed successfully.
- Root TypeScript may leave stale Windows workers after a tool timeout; identify them by repository-specific command line before stopping only those processes, then retry the local compiler directly with explicit Node memory.
