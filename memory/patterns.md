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

## Account-Scoped Local Data

- Keys containing user-authored content must include the user ID.
- Remove legacy global keys during cleanup so an account switch cannot expose old content.
- Preserve scoped drafts on an expired session only; remove them on explicit logout or account deletion.

## Windows Verification

- Mobile Vitest is stable with threads, one worker, no file parallelism, and `isolate: false` in this environment.
- Metro export is reliable with `--max-workers 1`, though it may take 5–7 minutes.
- Root Next.js builds can exceed 15 minutes from a cold cache because Sentry source-map processing is substantial; a cached retry completed successfully.
