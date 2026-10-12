# Google Play Release Readiness

Status date: 2026-07-31  
Package: `app.estories.mobile`  
Release channel: Google Play, consumption-only  
Source of truth: `mobile/app.config.ts` and `mobile/eas.json`

This is the operational release gate for the Android app. The older
`MOBILE_BUILD_GUIDE.md` is an implementation reference and contains stale SDK,
branching, package-name, and monetization examples; do not use it for release.

## Release policy implemented

- Expo SDK 54 / React Native 0.81 targets Android 16 (API 36).
- Production builds are Android App Bundles (`.aab`) with remote version-code
  auto-increment and the EAS `production` environment.
- Google Play builds are consumption-only. Wallet, crypto, tipping, paywall
  purchase, and external purchase steering are disabled fail-closed.
- Google sign-in is disabled for this first Play release. Email/password and
  password reset remain available. Re-enable only after native Google Identity
  integration and Play-device testing are complete.
- Users explicitly accept Terms, Privacy Policy, and Community Guidelines
  before account creation.
- Stories, comments, and accounts can be reported. Authors can be blocked, and
  blocked relationships are filtered server-side.
- Account deletion exists in-app and at
  `https://estories.app/account-deletion`.
- Notification permission is requested only after an explicit user action.
- Cost-bearing AI and audio routes use atomic, server-side per-user quotas.
- App Links are scoped to story and book URLs and require verified signing
  fingerprints through `/.well-known/assetlinks.json`.

## Hard blockers before the first internal-track upload

Do not build or submit until all items in this section are complete.

1. Replace the Expo placeholder files with approved production artwork:
   - `mobile/assets/icon.png`: opaque 1024 x 1024 PNG, no rounded corners.
   - `mobile/assets/adaptive-icon.png`: transparent 1024 x 1024 foreground,
     important artwork inside the adaptive-icon safe zone.
   - `mobile/assets/splash-icon.png`: approved splash mark.
   - Use an Android notification small icon that is white-on-transparent; do
     not use the full-color launcher icon for notifications.
2. Apply `supabase/migrations/019_create_content_safety_and_account_deletion.sql`
   to the production database before deploying the API or testing deletion,
   moderation, avatar upload, or quotas.
3. Deploy the web/API changes and verify these public URLs return HTTP 200:
   - `https://estories.app/privacy`
   - `https://estories.app/terms`
   - `https://estories.app/community-guidelines`
   - `https://estories.app/account-deletion`
4. Set `ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS` on the web deployment to a
   comma-separated list containing the Google Play App Signing SHA-256
   fingerprint. Add the upload-key fingerprint as well when testing locally.
   Verify the response at `https://estories.app/.well-known/assetlinks.json`.
5. Add `estory://auth/reset-password` to the Supabase Auth redirect allowlist
   and test reset links from Gmail on a physical Android device.
6. Configure the EAS `production` environment with the public values required
   by `app.config.ts`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `API_BASE_URL`.
   Client-bundled values are public; never put a service-role key or provider
   secret in mobile/EAS client configuration.
7. Confirm the Play Console developer identity and required contact details are
   verified. Reserve package `app.estories.mobile`; package names cannot be
   changed after publication.
8. Remediate high/critical production dependency advisories on `master`, then
   sync this branch. The 2026-07-31 gate found 10 high advisories in the root
   production tree (including direct Next.js) and 46 high/1 critical in the
   mobile production tree. Do not use `npm audit fix --force`; proposed fixes
   include breaking Expo/Web3/toolchain upgrades.
9. Obtain a clean Linux CI production build. The local Windows Next.js build
   generated current server/static manifests but its internal type-check worker
   stopped making progress and never emitted `BUILD_ID`; standalone root
   `tsc --noEmit` passed.

## Build and technical validation

Run from `mobile/`:

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm test
npx expo-doctor
npx expo config --type public
npx expo export --platform android --output-dir dist-android
npx eas-cli@latest build --platform android --profile production
```

The EAS build must show:

- package `app.estories.mobile`
- version name `1.0.0` and a unique integer version code
- target SDK 36 or later
- AAB output, Play App Signing enabled, and no debug signing
- `EXPO_PUBLIC_DISTRIBUTION_CHANNEL=google-play`
- Web3 and Google sign-in release flags false

Upload only to the internal track first. `mobile/eas.json` deliberately uses
`track: internal` and `releaseStatus: draft`; changing either requires an
explicit release decision.

After Play processes the AAB, inspect the App Bundle Explorer for:

- target API level and supported devices
- native-library 16 KB page-size compatibility
- unexpected permissions
- signing certificate fingerprints
- download size and pre-launch report failures

## Physical-device test matrix

At minimum, use one Android 16 device/emulator plus one lower supported Android
device. Repeat critical tests with font size and display size increased.

- clean install, upgrade install, cold start, background/resume, and offline
  start
- email signup requires policy consent; login, logout, expired session, and
  password reset
- create text story; record, upload, and transcribe valid audio; reject invalid
  or oversized audio
- feed, story detail, comments, like/follow, report story/comment/account,
  block/unblock, and server-side blocked-content filtering
- avatar selection without camera permission
- notification opt-in, denial, re-open settings, foreground receipt, cold-start
  deep link, and malformed notification payload
- story/book HTTPS App Links and custom reset-password link
- in-app account deletion followed by login failure and confirmation that
  profile, stories, media, moderation data, and push data are removed
- no wallet, crypto, token, tip, paywall-purchase, subscription purchase, or
  external payment CTA anywhere in the Play build
- TalkBack order/labels, 200% font scale, keyboard overlap, contrast, reduced
  motion, and touch-target review

## Play Console declarations

These answers must describe the released binary and production backend, not
planned features.

### App content

- Ads: **No**, unless an ad SDK is added later.
- App access: provide a stable reviewer account plus exact login and feature
  navigation steps. Do not require wallet access.
- Target audience: owner must select the real audience. The current Terms allow
  ages 13+, so do not declare the app exclusively 18+ without also changing the
  product policy and enforcement flow.
- Content rating: complete IARC accurately for public UGC, user interaction,
  and AI-assisted text.
- News: declare based on the actual primary purpose; user-authored historical or
  geopolitical stories do not by themselves make the app a news publisher.
- Financial features: the Play build exposes none. Re-audit this declaration if
  wallet or crypto features are ever enabled.
- Account deletion URL: `https://estories.app/account-deletion`.

### Data safety draft

Validate this inventory against production telemetry and provider settings when
submitting the form:

| Data category | Why it is collected | Handling |
|---|---|---|
| Email, user ID, name, username | Account management and authentication | Required for account use; deletable |
| Profile photo | Optional profile personalization | User provided; deletable |
| Stories, comments, social actions | Core app functionality and public UGC when the user publishes | User provided; deletable off-chain |
| Voice/audio | Recording, upload, and optional transcription | User provided; deletable |
| Push token/device platform | Notifications | Optional; delete with account |
| Crash diagnostics and device/app metadata | Reliability and security through Sentry | Disclose according to the production Sentry configuration |
| AI inputs and outputs | User-requested transcription, enhancement, and analysis | Processed by configured AI service providers |

Declare data encryption in transit only after verifying every production
endpoint uses HTTPS. Describe service-provider processing accurately; Play's
definition of “shared” has specific exceptions and must be answered in Console,
not guessed from this table.

## Store listing assets and copy

Required before production review:

- 512 x 512 high-resolution icon, maximum 1 MB
- 1024 x 500 feature graphic
- at least two current phone screenshots captured from the Play build
- short description (80 characters maximum) and full description
- support email, website, and privacy policy URL

Screenshots and copy must not show wallet, tokens, NFT minting, tipping,
subscriptions, testnet labels, or any feature disabled in the Google Play build.
Do not claim end-to-end encryption: ordinary mobile stories are sent to the
backend and, when requested, to AI providers.

## Promotion sequence

1. Internal track: team smoke test and Play pre-launch report.
2. Closed testing: real devices, account deletion, moderation operations, and
   backend monitoring. Satisfy any testing-duration/participant requirement
   shown for this specific developer account.
3. Fix all crashes, ANRs, broken flows, policy warnings, and accessibility
   blockers; upload a new version code.
4. Production: staged rollout, starting small, with crash-free sessions, ANRs,
   API error rates, moderation queue, deletion failures, and AI-cost quotas
   monitored before expansion.

## Future changes that require a new Play policy review

- enabling wallet, crypto, NFTs, tips, paywalls, external purchase steering, or
  subscriptions
- adding Google sign-in or another identity provider
- adding camera, contacts, location, background audio, or other permissions
- changing AI providers, analytics, advertising, or data retention
- adding direct messages or new forms of UGC
- changing package name, signing, API target, or Android native dependencies

References:

- Google Play target API requirements:
  https://support.google.com/googleplay/android-developer/answer/11926878
- Google Play UGC policy:
  https://support.google.com/googleplay/android-developer/answer/9876937
- Google Play account deletion:
  https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play payments policy:
  https://support.google.com/googleplay/android-developer/answer/9858738
- Expo Android production build:
  https://docs.expo.dev/tutorial/eas/android-production-build/
