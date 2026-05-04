# API Routes Reference

**Note:** All API routes require Bearer token authentication unless marked otherwise. Auth is validated via `lib/auth.ts`.

## AI Services (`/api/ai/*`) — Auth Required

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/ai/transcribe` | POST | Bearer | Voice → text via ElevenLabs Scribe. Input: FormData (max 25MB, audio/* only). Output: `{ text }` |
| `/api/ai/enhance` | POST | Bearer | Enhance text via Gemini 2.5 Flash. Input: `{ text }` (max 50K chars). Output: `{ text }` |
| `/api/ai/analyze` | POST | Bearer + ownership | Extract metadata from story. Input: `{ storyId, storyText }`. Verifies caller owns story. Output: `{ success, metadata, insight }` |
| `/api/ai/reflection` | POST | Bearer | Generate weekly reflection. Input: `{ userId, userWallet }`. Rate limited: 1/week. Output: `{ reflection }` |

## Auth (`/api/auth/*`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/nonce` | GET | None | Generate server-side nonce for wallet signing. Query: `?address=0x...`. Output: `{ nonce, message }` |
| `/api/auth/login` | POST | None | Authenticate with wallet signature. Verifies nonce + timestamp. |
| `/api/auth/callback` | GET | None | OAuth callback handler. Validates redirect URL against whitelist. |
| `/api/auth/onboarding` | POST | Bearer | Complete new user onboarding. Verifies userId matches token. |
| `/api/auth/link-account` | POST | Bearer + signature | Link wallet to Google account. Requires wallet signature. |
| `/api/auth/link-google` | POST | Linking token | Link Google OAuth to existing wallet account. |
| `/api/auth/initiate-link` | POST | Bearer + signature | Start account linking flow. Generates HMAC-signed linking token. |

## Journal & Stories — Auth Required

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/journal/save` | POST | Bearer | Save story to `stories` table. Triggers AI analysis in background. Input: `{ title, content, mood, tags, hasAudio }` |
| `/api/stories` | GET/POST | Bearer | GET: Fetch public stories feed. POST: Create story (verifies author_id matches token). Client-side: successful POST also triggers additive vault save (non-blocking) if vault is set up and unlocked. |
| `/api/stories/[storyId]` | GET | None | Get specific story details |

## Books — Auth Required

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/book/compile` | POST | Bearer + ownership | Compile stories into book NFT. Verifies authorId matches token. |
| `/api/books` | GET | None | List compiled books |
| `/api/books/[bookId]` | GET | None | Get specific book details |

## Social & Monetization — Auth Required

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/social/like` | POST | Bearer | Like/unlike story (atomic toggle). Uses authenticated userId, not client-provided. |
| `/api/social/follow` | GET/POST | Bearer + wallet ownership | GET: Check follow status. POST: Follow/unfollow. Verifies wallet ownership. |
| `/api/tip` | POST | Bearer | Send $STORY to creator. Input: `{ to, amount, storyId }` |
| `/api/paywall` | POST | Bearer | Pay to unlock content. Input: `{ to, amount, storyId }` |

## User & Habits — Auth Required

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/user/profile` | GET/PUT | Bearer | GET: Fetch authenticated user's real profile. PUT: Update name/bio/avatar only (500 char limit). |
| `/api/habits` | GET/POST/PUT/DELETE | Bearer + ownership | Habit tracking. All operations verify user_id matches authenticated user. |

## Notifications

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/notifications` | GET/POST/PUT/DELETE | Bearer | Full CRUD. Has its own `validateAuth` implementation (was the original pattern). |

Notification types: `like`, `comment`, `tip`, `follow`, `book_published`, `story_mentioned`

## CRE Verification (`/api/cre/*`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/cre/trigger` | POST | Bearer + ownership | Trigger CRE story verification. Fetches story from DB, validates ownership, sends to CRE workflow. Input: `{ storyId }`. Output: `{ success, workflowRunId }` |
| `/api/cre/check` | POST | Bearer | Check verification status. Dual-source: Supabase cache + on-chain fallback. Author gets full metrics + proof; non-author gets proof only (qualityTier, meetsThreshold). Legacy contract fallback for backward compat. Input: `{ storyId }`. Output: `{ verified, isAuthor, metrics?, proof }` |
| `/api/cre/callback` | POST | X-CRE-Callback-Secret | DON callback receiver. Stores full metrics in Supabase. Idempotent (upsert on story_id). Always returns `{ success: true }` for DON consensus. Rate limit: 30/min. |

## Waitlist — Public

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/waitlist` | POST | None | Pre-launch email capture. Validates email format, upserts to `waitlist` table, sends confirmation email via Resend (best-effort). Rate limit: 10/min per IP. Input: `{ email }`. Output: `{ success: true }` |

## Infrastructure — Special Auth

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/ipfs/upload` | POST | Bearer | Upload to IPFS via Pinata. Max 50MB. MIME whitelist: image/*, audio/*, application/json. |
| `/api/email/send` | POST | Bearer | Send email via Resend. Input: `{ type, email, username }` |
| `/api/sync/verify_tx` | POST | Bearer + wallet ownership | Verify blockchain transaction. Validates wallet matches user. |
| `/api/cron/distribute-rewards` | POST | CRON_SECRET (timing-safe) | **Disabled.** Reserved for future token distribution. Cron schedule removed from vercel.json. |
| `/api/admin/analysis-stats` | GET | ADMIN_SECRET (timing-safe) | Analysis statistics. Uses `safeCompare()` for secret. |
