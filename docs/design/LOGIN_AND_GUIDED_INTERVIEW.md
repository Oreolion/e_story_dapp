# Standard login and guided story interviews

Implementation batch: Living Archive web foundation, 2026-11-24. This document describes the candidate source, not a production deployment. Hosted staging remains deferred. Mobile authentication and recording screens are outside this batch.

## Experience

The header offers distinct, bold **Log in** and **Sign up** buttons. Sign up presents account-creation copy and uses the same Google OAuth flow and existing profile onboarding; returning accounts retain the same login behavior. The established logo, brand colors and detailed landing-page sections are retained following user review on 2026-11-25. Google is the primary path; wallet login remains available as an alternative. Existing accounts, wallet signatures, OAuth callbacks and same-origin refresh are retained. No password database or new authentication provider is introduced.

The login dialog now pairs the established brand assets with a desktop story panel and a compact mobile layout. Google remains the primary action; wallet access is optional. Login and signup can be switched inside the dialog without starting authentication. Privacy and terms links remain accessible, and closing the dialog returns focus to its opener.

New accounts complete one profile form, then open `/record`. Wallet and Local Vault setup are optional account features. The old onboarding sequence could redirect home immediately after saving a profile, skipping its subsequent steps; there is no longer a required wallet/vault tour to skip.

Profile setup shows account/profile/first-story progress and a saving state. Completed users are redirected to recording instead of being shown an editable setup form. Tests cover duplicate submissions, invalid usernames, account changes, save errors, server ownership checks, and successful persistence even if the welcome email fails. Browser tests exercise the real client auth context and router against synthetic post-authentication responses, including reload and username-conflict recovery. These checks do not establish that a live Google OAuth consent/callback round trip has succeeded.

The recording page offers two modes:

- **Monologue:** record freely or type in the story editor.
- **Guided interview:** start with a clearly labelled, fixed starter question. Type or record an answer, then explicitly request the next AI question. Finish whenever you want by adding the answers to the story editor. Review and edit before saving or publishing.

Switching modes keeps both drafts. Interview answers are appended in question-and-answer form, without generating an invented first-person narrative. Repeated additions copy only answers not already added. Questions are not read aloud in this version.

```mermaid
flowchart TD
  A[Log in with Google or an optional wallet] --> B[Complete profile if needed]
  B --> C[Choose a recording mode]
  C --> D[Monologue: write or record]
  C --> E[Interview: fixed starter question]
  E --> F[Type or record an answer]
  F --> G{Next AI question?}
  G -->|Yes| H[Authenticate, validate, check availability and reserve quota]
  H --> I[LangGraph: validate input → generate once → validate output]
  I --> F
  G -->|Finish| J[Append new answers to the story editor]
  D --> K[Review and edit]
  J --> K
  K --> L[Existing private save or explicit public publication]
```

## Availability, cost and privacy

The implementation does **not** enable production AI, change billing, provision providers or migrate the database. Existing AI setup holds and release fences still apply. If assistance is unavailable, typed answers remain usable and can be added to a story without inference. Recording depends on the existing transcription service.

`POST /api/ai/interview` uses authenticated canonical ownership, including an expected-owner header to reject stale account submissions. It accepts only a topic and completed turns; client-supplied user IDs, provider choices and instructions to tools are not authority.

Limits are deterministic:

| Control | Limit or behavior |
| --- | --- |
| Topic | 200 characters |
| Answers | Six total, including the starter answer |
| Each answer | 1,500 characters |
| Next-question context | At most five completed answers |
| Request body | 64 KiB, measured while streaming, independent of Content-Length |
| Generated question | One question, at most 240 characters; strict JSON schema; exact repeats rejected |
| Model output budget | 512 tokens for interview questions |
| Provider deadline | Existing 25-second bounded routing budget |
| Recording per interview answer | 90 seconds and 8 MiB |
| Admission | Existing enhancement/text-assistance pool; denial fails closed |
| Fallback | Existing configured DeepSeek routing; every additional provider call needs a separate durable quota reservation |
| Retries | Explicit user action; no automatic schema repair or agent loop |

The LangGraph task has no tools, checkpointer or durable conversation store. Private inference keeps ambient tracing disabled. The evaluation source fingerprint includes the interview route, contracts and graph task. Deterministic tests validate contracts, auth, account changes, quota, holds, retries, output rejection and UI behavior without paid inference or an LLM judge.

Next-question requests disclose the interview topic and prior answers to the configured AI provider. Recording discloses audio to the transcription provider. These disclosures appear beside the controls. Story text and provider errors are not logged by the new endpoint. Model questions render as ordinary React text, without HTML execution.

Interview and editor drafts are scoped to the account in sessionStorage. They are **not vault-encrypted**, are not a cloud backup, and can be lost when browser storage is cleared or the tab closes. An unavailable/full store shows a warning for interviews. Account changes remount the interview/editor, abort interview requests and stop its microphone. This is account separation in the UI, not protection against someone with access to the same browser's developer tools.

The previous unassigned `estories_record_draft` key is retained for manual recovery, without automatically importing another person's draft. No saved cloud stories are moved or deleted. Older unsaved drafts will not automatically appear in the new editor. Before clearing browser storage, recover any needed old draft locally; never paste private story contents into issue reports.

Questions are validated structurally, not proven semantically safe by a schema. Before enabling live journal inference, verify the provider's current privacy terms and models, evaluate synthetic interview quality and safety, and confirm quota behavior. Gemini 2.5 Flash currently supports disabling thinking for this small task; provider model lifecycle changes require revalidation rather than silently assuming the same configuration remains supported. See [Google's thinking controls](https://firebase.google.com/docs/ai-logic/thinking).

## Interface foundation

The current web token source is [styles/design-system.css](../../styles/design-system.css), exposed through the existing Tailwind aliases in [app/globals.css](../../app/globals.css). Semantic values are complete CSS colors; use `var(--primary)`, without an extra `hsl()` wrapper. Compatibility tokens such as `--memory-*` remain HSL channels for existing consumers and must keep their existing `hsl(var(...))` usage until those consumers migrate.

| Token | Light | Dark |
| --- | --- | --- |
| Background | `#FAFAFA` | `#030617` |
| Foreground | `#111827` | `#F8FAFC` |
| Card | `#FFFFFF` | `#24252B` |
| Primary | `hsl(217 91% 40%)` | `hsl(217 91% 50%)` |
| Primary foreground | `#FFFFFF` | `#FFFFFF` |
| Muted foreground | `#4B5563` | `#AEB7C8` |

Body and display typography use Inter; the established wordmark uses Love Light. Both load through `next/font` with their variables on the root HTML element. Reuse semantic colors, visible focus rings and the existing 44px control sizing. The earlier [design-system document](../DESIGN_SYSTEM.md) is retained as a historical reference.

The homepage retains eStories' blue, purple and gold branding, logo and detailed feature sections, alongside a lightweight illustrative story preview. It keeps the mobile waitlist. No real customer story is used in visual assets. Root layout no longer mounts the global decorative WebGL background. Existing background context consumers remain compatible.

Navigation separates public discovery from the signed-in workspace. Mobile uses a compact header and five workspace destinations; Tracker remains accessible through the account menu and homepage shortcut. Controls have accessible names, a skip link, larger targets and reduced-motion support. Footer links point to actual routes instead of generic social-service homepages or an unconditional operational claim. Onchain verification remains coming soon.

The cookie banner is in document flow, with equal optional/essential choices and a footer control to revisit them. The Meta base pixel and custom helpers require optional marketing consent; denial revokes the loaded pixel's consent. A storage failure defaults to denying marketing for the current page. Vercel operational analytics retain their existing behavior; this change is not a claim that every telemetry system is cookie-based or covered by Meta consent.

## Verification and rollout

Run the focused unit/API tests, the complete web/evaluation suites, lint, web/evaluation TypeScript checks and the isolated production build. Public Playwright journeys cover login entry, privacy/deletion, the anonymous recording boundary, the story preview and overflow at 320, 390, 768 and 1440 CSS pixels in Chromium and Firefox. Use computer use to inspect mobile/desktop, light/dark and keyboard/modal behavior on the candidate.

For reproducible local browser acceptance, use the existing isolated runner with locked dependencies and installed Chromium/Firefox engines:

```sh
node scripts/verify-isolated.mjs --build
```

Use Node 22 to match CI. This runner excludes local credential files, supplies synthetic settings, builds once, checks that the served build manifest matches that artifact, runs every browser evaluation against `next start`, and stops its own server. Do not use `next dev` or modify the source during release acceptance: on-demand compilation and hot reload can invalidate timing and navigation evidence. The CI Build job also runs the full browser suite on its compiled artifact. A loading timeout or interrupted run is a failure, not evidence of onboarding success.

Callback unit tests exercise the real route with a synthetic code-exchange boundary, including missing/failed exchange, allowed destinations and open-redirect rejection. Browser username-conflict assertions select the form's error text rather than Next.js's separate route-announcer alert. Neither check replaces the live provider test below.

For live Google verification, bind the test to the candidate URL and commit. The Supabase redirect allowlist must contain that exact origin's `/api/auth/callback`; a production callback entry does not authorize a new preview URL. Use a dedicated account and stop for account selection, consent or credentials. Confirm the callback returns to the candidate, the new profile saves, recording opens, reload preserves completion and sign-out works. Never record authorization codes, session tokens or private account data in screenshots, traces or issue reports. Do not broaden the allowlist to arbitrary preview domains to make a test pass.

Live Google OAuth, a physical-device microphone, adaptive interview quality and provider fallback require controlled synthetic accounts/provider setup; mock tests do not establish those real integrations. No real journals, mainnet payments or paid inference are required for this batch's deterministic checks.

Before any production promotion, apply the installed web/mobile production audit to the exact commit, artifact, environment and release entry points, then verify delivery. Reverting the compatible application change is the rollback path; this feature has no database migration. Keep AI disabled until the separate inference setup gate is satisfied.

Remaining design-plan phases include archive/story layouts, profile/privacy settings, truthful pricing and payment states, and native-screen alignment. A 3D book viewer remains optional, subject to measured usefulness and performance. This first batch does not claim those later phases are complete.
