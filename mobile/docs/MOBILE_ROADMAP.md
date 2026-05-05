# Mobile App Roadmap — Production Beta Milestone

> **Created**: 2026-05-05  
> **Goal**: Get the mobile app to a production-ready beta release on Google Play (Android) and TestFlight (iOS).  
> **Philosophy**: Stability first, then distribution, then monetization. No new features until these milestones are hit.

---

## Current State Summary

The mobile app is **feature-complete** for MVP:
- ✅ 6-tab navigation (Home, Record, Tracker, Library, Social, Profile)
- ✅ Multi-method auth (email, Google OAuth, wallet connect, SIWE)
- ✅ Full story pipeline (record → transcribe → enhance → save)
- ✅ Library with collections, themes, life domains
- ✅ Social feed with likes, comments, follows, shares
- ✅ Web3 integration (tips, paywalls, $STORY token, NFT minting)
- ✅ Chainlink CRE verification
- ✅ Daily tracker + AI journal generation
- ✅ Push notifications
- ✅ Deep linking configured

**What's blocking production**:
- ☐ No crash reporting / error boundaries
- ☐ No offline support
- ☐ No real payment flow (pricing screen is display-only)
- ☐ Expo default icons / splash screen
- ☐ No EAS production build profile
- ☐ Missing GDPR compliance (account deletion UI, privacy links)
- ☐ No tests
- ☐ `.env.example` has outdated API URL

---

## Phase 1: Stability & Reliability (Week 1)

**Goal**: The app should never crash silently. Users should see graceful errors and offline states.

### 1.1 Error Boundaries
**Files**: `app/_layout.tsx`, new `components/ErrorBoundary.tsx`
- Wrap each tab screen in a React error boundary
- Show a friendly "Something went wrong" screen with retry button
- Log errors to console (pre-Sentry)

### 1.2 Sentry Integration
**Files**: `mobile/package.json`, `app/_layout.tsx`, `.env.example`
- Install `@sentry/react-native`
- Configure in `_layout.tsx` with DSN from env
- Capture errors from boundaries + native crashes
- Add breadcrumb logging for navigation

### 1.3 Offline Support — Sync Queue
**Files**: `lib/api.ts`, `stores/syncStore.ts`, new `lib/offline.ts`
- Detect network state (`@react-native-community/netinfo` or expo built-in)
- Queue failed POST/PUT/DELETE requests in AsyncStorage
- On reconnect, process queue in order
- Show "Syncing..." / "Offline — changes saved locally" toast

### 1.4 Loading & Empty States
**Files**: `app/(tabs)/library.tsx`, `app/(tabs)/social.tsx`, `app/(tabs)/profile.tsx`
- Skeleton loaders for story lists (already have `SkeletonLoader` component)
- Empty states: "No stories yet — record your first!" with CTA
- Empty search results, empty collections, empty notifications

### 1.5 Form Validation
**Files**: `app/auth/login.tsx`, `app/auth/signup.tsx`, `app/(tabs)/record.tsx`
- Use Zod + React Hook Form consistently
- Validate email format, password strength, required fields
- Show inline error messages

**Verification**:
```bash
cd mobile
npx expo start
# Manually test: turn off WiFi, submit a story, turn on WiFi, verify sync
# Trigger a JS error in dev, verify boundary catches it
```

---

## Phase 2: Compliance & Distribution Prep (Week 2)

**Goal**: Meet Google Play / Apple App Store requirements. Prepare EAS build.

### 2.1 App Icons & Splash Screen
**Files**: `assets/`, `app.config.ts`
- Generate 1024×1024 master icon
- Use `@expo/image-utils` or Figma export to generate all sizes
- Splash screen: brand logo on dark gradient background
- Adaptive icons for Android (foreground + background layers)

### 2.2 EAS Build Configuration
**Files**: `eas.json`, `app.config.ts`
- Fix production profile: `API_BASE_URL=https://estories.app`
- Generate Android upload keystore
- Test production build: `eas build --profile production --platform android`
- iOS: configure bundle identifier, test `eas build --platform ios`

### 2.3 Account Deletion Flow
**Files**: `app/(tabs)/profile.tsx`, `lib/api.ts`
- Add "Delete Account" button in profile settings
- Confirmation modal: "This cannot be undone. All data will be permanently deleted."
- Call `DELETE /api/user`
- Clear SecureStore / AsyncStorage
- Sign out and redirect to login

### 2.4 Privacy Policy & Terms Links
**Files**: `app/auth/login.tsx`, `app/auth/signup.tsx`, `app/(tabs)/profile.tsx`
- Add "By signing up, you agree to our Terms and Privacy Policy" on signup
- Link to `/privacy` and `/terms` (web routes)
- Add links in profile settings

### 2.5 Testnet Disclaimer
**Files**: `components/TestnetBanner.tsx`, wallet-related screens
- Make banner dismissible but show on first wallet screen visit
- Store dismissal in AsyncStorage

### 2.6 Environment Cleanup
**Files**: `.env.example`
- Update `API_BASE_URL=https://estories.app`
- Document all required env vars with descriptions

**Verification**:
```bash
cd mobile
eas build --profile preview --platform android
# Download and install APK on physical device
# Verify icons, splash, deep links, account deletion
```

---

## Phase 3: Monetization — Blockradar Payments (Week 3)

**Goal**: Make the pricing screen functional. Users can actually subscribe.

### 3.1 Blockradar Integration
**Files**: `lib/blockradar.ts`, `app/pricing/index.tsx`
- Review web app's Blockradar integration (`lib/blockradar.ts`)
- Create mobile-specific Blockradar client (or reuse web lib)
- Initialize payment for each tier: Free / Storyteller ($2.99) / Creator ($7.99)

### 3.2 Payment Flow
**Files**: `app/pricing/index.tsx`, `stores/authStore.ts`
- On tier selection, call Blockradar checkout
- Handle success / cancel / error callbacks
- Update user's subscription tier in auth store
- Show "Subscribed" badge on profile

### 3.3 Paywall Enforcement
**Files**: `app/story/[storyId].tsx`, `app/(tabs)/library.tsx`
- Gate premium features behind subscription check
- Show upgrade prompt for Creator-tier features

**Verification**:
```bash
# Test on physical device with Blockradar test mode
# Verify payment intents, callback handling, tier persistence
```

---

## Phase 4: Polish & QA (Week 4)

**Goal**: The app feels professional. No jank, no confusion.

### 4.1 Deep Link Testing
**Files**: `app/_layout.tsx`
- Test `estory://story/123` opens story detail
- Test `https://estories.app/story/123` opens story detail
- Handle unauthenticated deep links → redirect to login, then to target

### 4.2 Push Notification Refinement
**Files**: `hooks/useNotifications.ts`, `app/_layout.tsx`
- Test on real Android device (not simulator)
- Handle permission denial gracefully
- Tap notification → navigate to correct screen
- Notification categories: likes, comments, follows, tips

### 4.3 Accessibility
**Files**: All screen components
- Add `accessibilityLabel` to all interactive elements
- Ensure color contrast meets WCAG AA
- Test with screen reader (TalkBack / VoiceOver)

### 4.4 Unit & Integration Tests
**Files**: `__tests__/mobile/`
- Setup Jest + React Native Testing Library
- Test auth store (login/logout state changes)
- Test API client (mock fetch, error handling)
- Test utility functions (formatters, validators)

### 4.5 Performance Pass
**Files**: `app/(tabs)/library.tsx`, `app/(tabs)/social.tsx`
- Memoize expensive list renders (`React.memo`, `useMemo`)
- Lazy load heavy components (story detail modals)
- Image optimization: use `expo-image` with proper sizing

**Verification**:
```bash
cd mobile
npm test
npx expo start --no-dev --minify
# Test on low-end Android device for performance
```

---

## Phase 5: Store Submission (Week 5)

**Goal**: Live on Google Play Internal Testing and TestFlight.

### 5.1 Google Play Store
- Pay $25 developer fee
- Create store listing: title, short description, full description
- Upload screenshots (phone + tablet)
- Upload feature graphic (1024×500)
- Fill Data Safety form
- Complete Content Rating questionnaire
- Upload AAB from EAS build
- Release to Internal Testing track

### 5.2 Apple App Store
- Enroll in Apple Developer Program ($99)
- Create app record in App Store Connect
- Upload screenshots (iPhone + iPad)
- Fill App Privacy details
- Upload IPA from EAS build
- Submit to TestFlight

### 5.3 Post-Launch Monitoring
- Monitor Sentry for crashes
- Monitor Google Play Console / App Store Connect for ANRs
- Collect feedback from internal testers

---

## Decision: When to Resume Web Feature Roadmap

**Resume Option C (web features)** ONLY after:
- ✅ Phase 1 complete (stability)
- ✅ Phase 2 complete (distribution prep + EAS build works)
- ✅ At least one successful production build on physical device

**Rationale**: The web app is already mature. The mobile app is the growth channel. Getting mobile to beta is higher ROI than adding graph-based memory or topic discovery to web.

---

## Quick Reference: Mobile Project Commands

```bash
# Development
cd mobile
npx expo start          # Start dev server
npx expo start --android # Start + open Android
npx expo start --ios     # Start + open iOS simulator

# Build
eas build --profile development --platform android
eas build --profile preview --platform android
eas build --profile production --platform android

# Testing
npm test                 # Run Jest (after setup)
npx expo start --no-dev --minify  # Production-like local test

# Submit
eas submit --platform android  # Submit to Play Store
eas submit --platform ios      # Submit to App Store
```
