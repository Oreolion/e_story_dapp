# Mobile Feature Parity Checklist

> **Purpose:** Ensure the mobile app (Expo/React Native in `/mobile/`) implements all features available in the web app (Next.js in `/app/`).
>
> **How to use:** Update the **Status** column as you implement. Mark features that don't apply to mobile as `N/A`.

---

## Legend

| Status | Meaning |
|--------|---------|
| `⬜ TODO` | Not yet implemented |
| `🟡 WIP` | In progress |
| `✅ DONE` | Implemented and tested |
| `🚫 N/A` | Not applicable to mobile (e.g., browser-only features) |

---

## 1. Authentication & Onboarding

| Feature | Web Endpoint / Page | Mobile Screen | Status | Notes |
|---------|---------------------|---------------|--------|-------|
| Google OAuth sign-in | `/api/auth/callback` | `AuthModal` | | Use `expo-auth-session` |
| Wallet sign-in (MetaMask/Rainbow) | `/api/auth/nonce` + `/api/auth/login` | `AuthModal` | | Use `@walletconnect/react-native` |
| Account linking (Google ↔ Wallet) | `/api/auth/initiate-link` | Profile settings | | Deep linking required |
| Onboarding flow | `/onboarding` | `OnboardingScreen` | | Multi-step: username → vault → wallet |
| Logout | `/api/auth/logout` | Profile settings | | Clear JWT + Supabase session |
| Auth refresh (Firefox fix) | `/api/auth/refresh` | Background refresh | | Proxy via same-origin fetch |

---

## 2. Story Recording & Writing

| Feature | Web Page | Mobile Screen | Status | Notes |
|---------|----------|---------------|--------|-------|
| Voice recording | `/record` | `RecordScreen` | | Use `expo-av` for audio capture |
| AI transcription (ElevenLabs) | `/api/ai/transcribe` | Upload audio → API | | Max 25MB |
| Text writing | `/record` | `WriteScreen` | | Rich text editor |
| AI text enhancement | `/api/ai/enhance` | FAB → enhance | | Max 50K chars |
| Story saving | `/api/journal/save` | Save button | | Triggers AI analysis |
| Story continuation | Story detail → "Continue" | Story detail → "Continue" | | Links to new story with parent ID |

---

## 3. AI Analysis & Insights

| Feature | Web API | Mobile Screen | Status | Notes |
|---------|---------|---------------|--------|-------|
| Cognitive analysis (themes, emotions) | `/api/ai/analyze` | Auto on save | | Author-only |
| Weekly AI reflection | `/api/ai/reflection` | Reflections tab | | 1 per week limit |
| Chainlink CRE verification | `/api/cre/trigger` | "Verify" button on story | | Async, poll for results |
| Verified metrics display | `/api/cre/check` | `VerifiedMetricsCard` | | Public: proof only |
| Significance scoring | `/api/ai/analyze` | Story insights | | |
| Emotional tone detection | `/api/ai/analyze` | Story insights | | |
| Craft advice | `/api/ai/analyze` | Story insights | | |

---

## 4. Library & Story Management

| Feature | Web Page | Mobile Screen | Status | Notes |
|---------|----------|---------------|--------|-------|
| Personal library | `/library` | `LibraryScreen` | | Month-by-month grouping |
| Story collections | `/library` → Collections | `CollectionsScreen` | | CRUD collections |
| Story detail view | `/story/[storyId]` | `StoryDetailScreen` | | |
| Story editing | Inline or `/record?edit=` | Edit modal | | |
| Story deletion | Story menu → Delete | Swipe to delete | | |
| Book compilation | `/api/book/compile` | `BookScreen` | | Combine stories into book |
| Archive grouping | `/library` | Library filter | | Month/year grouping |
| Canonical story marking | Story menu → "Mark canonical" | Story menu | | |

---

## 5. Social & Community

| Feature | Web API / Page | Mobile Screen | Status | Notes |
|---------|----------------|---------------|--------|-------|
| Community feed | `/social` | `SocialScreen` (tab) | | Discover public stories |
| Like/unlike | `/api/social/like` | Heart button | | Atomic toggle |
| Comment system | `/api/social/comment` | Comment section | | |
| Follow/unfollow | `/api/social/follow` | Follow button | | |
| Share story | Web Share API | `expo-sharing` | | Link to `https://estories.app/story/{id}` |
| Tip creator | `/api/tip` | Tip button | | Wallet transaction |

---

## 6. User Profile

| Feature | Web Page | Mobile Screen | Status | Notes |
|---------|----------|---------------|--------|-------|
| Profile view | `/profile/[username]` | `ProfileScreen` | | Public profile |
| Profile editing | `/api/user/profile` | Edit profile modal | | Name, bio, avatar, location, website |
| Contribution heatmap | Profile page | Profile stats | | GitHub-style 365-day grid |
| Writing streaks | Profile page | Profile stats | | |
| Achievements/badges | Profile page | Profile stats | | |
| Statistics dashboard | Profile page | Profile stats | | Stories, likes, followers |
| Vault settings | Profile → Vault | `VaultSettingsScreen` | | Setup, unlock, lock, change PIN |
| Linked accounts | Profile → Accounts | Profile settings | | Google + wallet connections |
| Avatar upload | `/api/user/profile` | Image picker | | Use `expo-image-picker` |

---

## 7. Notifications

| Feature | Web API / Page | Mobile Screen | Status | Notes |
|---------|----------------|---------------|--------|-------|
| Notification list | `/notifications` | `NotificationsScreen` (tab) | | |
| Notification CRUD | `/api/notifications` | Swipe actions | | Mark read, delete |
| Push notifications | 🚫 N/A | `expo-notifications` | | Mobile-only feature |

---

## 8. Payments & Monetization

| Feature | Web API / Page | Mobile Screen | Status | Notes |
|---------|----------------|---------------|--------|-------|
| USDC subscriptions | `/api/payment/create` | `PricingScreen` | | Blockradar integration |
| Paywall unlock | `/api/paywall` | Paywall modal | | |
| Tip payments | `/api/tip` | Tip button | | Direct wallet transfer |
| Payment status check | `/api/payment/status` | Background poll | | |
| Payment webhook | `/api/payment/webhook` | 🚫 N/A | | Server-side only |
| Pricing page | `/pricing` | `PricingScreen` | | Plan comparison |

---

## 9. NFT & Blockchain

| Feature | Web Page / Hook | Mobile Screen | Status | Notes |
|---------|-----------------|---------------|--------|-------|
| NFT minting (story books) | `useStoryNFT` → `mint()` | Mint button on book | | Contract: `StoryNFT` |
| Token contract interaction | `useEStoryToken` | Token balance display | | `$STORY` ERC20 |
| Tip contract interaction | `useStoryProtocol` | Tip flow | | `StoryProtocol` contract |
| Wallet connection | RainbowKit | `@walletconnect/react-native` | | |
| Transaction history | Profile → Activity | Profile → Activity | | |

---

## 10. Vault (Client-Side Encryption)

| Feature | Web Hook | Mobile Screen | Status | Notes |
|---------|----------|---------------|--------|-------|
| Vault setup | `useVault` → `setupVault()` | `VaultSetupScreen` | | PIN → PBKDF2 → AES-256-GCM |
| Vault unlock | `useVault` → `unlockVault()` | `PinEntryModal` | | |
| Vault lock | `useVault` → `lockVault()` | Auto-lock on background | | |
| Change PIN | `useVault` → `changePin()` | Vault settings | | |
| Encrypted story save | `useLocalStories` | Local save | | Dexie.js → React Native? |
| Cloud sync | Dual-write architecture | Same dual-write | | Cloud first, vault additive |

**Mobile consideration:** The web vault uses IndexedDB + Dexie.js. On mobile, you'll need `expo-secure-store` or `react-native-mmkv` for encrypted storage. The crypto logic (AES-256-GCM, PBKDF2) from `lib/vault/crypto.ts` is platform-agnostic and can be reused.

---

## 11. Settings & Misc

| Feature | Web Page | Mobile Screen | Status | Notes |
|---------|----------|---------------|--------|-------|
| Privacy policy | `/privacy` | Link to web view | | Static page |
| Terms of service | `/terms` | Link to web view | | Static page |
| Waitlist signup | `/api/waitlist` | 🚫 N/A | | Only for pre-launch |
| Unsubscribe | `/api/unsubscribe` | 🚫 N/A | | Email-only |
| Habits tracker | `/api/habits` | 🚫 N/A (for now) | | Future feature |

---

## 12. UI/UX Patterns (Mobile-Specific)

| Pattern | Web Implementation | Mobile Equivalent | Status |
|---------|-------------------|-------------------|--------|
| Dark/light mode | `next-themes` | `expo-system-ui` or context | |
| Toast notifications | `react-hot-toast` / `sonner` | `expo-notifications` or custom toast | |
| Loading states | Skeletons / spinners | `ActivityIndicator` / skeletons | |
| Pull-to-refresh | 🚫 N/A | `RefreshControl` on lists | |
| Infinite scroll | IntersectionObserver | `onEndReached` on FlatList | |
| Bottom sheet modals | shadcn Dialog | `@gorhom/bottom-sheet` | |
| Tab navigation | Top nav bar | Bottom tabs (`expo-router` tabs) | |
| Swipe actions | 🚫 N/A | `react-native-gesture-handler` | |
| Biometric unlock | 🚫 N/A | `expo-local-authentication` | | Optional for vault |

---

## API Base URL Configuration

The mobile app uses a different API base URL than web:

| Environment | Web | Mobile (current `mobile-app` branch) |
|-------------|-----|--------------------------------------|
| Production | `https://estories.app` | `https://e-story-dapp.vercel.app` |

**Note:** Before releasing mobile, align this to `https://estories.app` unless you're intentionally using a separate backend.

---

## Deep Linking Requirements

Mobile app needs deep links for:

| Route | Deep Link | Handler |
|-------|-----------|---------|
| Story detail | `estories://story/[id]` | `app/story/[storyId].tsx` |
| User profile | `estories://user/[username]` | `app/profile/[username].tsx` |
| Auth callback | `estories://auth/callback` | OAuth redirect handler |
| Account linking | `estories://auth/link` | Linking token handler |

Configure in `app.json` / `app.config.ts` under `intentFilters` (Android) and `associatedDomains` (iOS).

---

## Web-Only Features (N/A for Mobile)

These features are browser-specific and intentionally skipped:

- Service Worker (`/sw.js`) — PWA offline support
- Browser extensions integration
- `window.crypto.subtle` direct access (use React Native crypto alternatives)
- Next.js App Router features (SSR, RSC)
- Vercel Analytics / Speed Insights scripts
- Sentry Replay (may have mobile equivalent)

---

## Testing Checklist

Before mobile release, verify:

- [ ] All API calls use the correct base URL
- [ ] Auth tokens persist across app restarts (`expo-secure-store`)
- [ ] Vault encryption/decryption works on device
- [ ] Wallet connection works on real device (not just simulator)
- [ ] Push notifications register and receive
- [ ] Deep links open correct screens
- [ ] Audio recording works on both iOS and Android
- [ ] App handles offline mode gracefully
- [ ] Biometric unlock works (if implemented)

---

## Last Updated

- **Date:** 2026-05-04
- **Mobile branch:** `mobile-app`
- **Web branch:** `master`
