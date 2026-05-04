# iStory Mobile App Build Guide

> **Purpose**: This document is a complete, self-contained guide for an AI agent (Claude Code) to build a production-ready iOS and Android app for the iStory dApp. It covers every screen, every API call, every hook, and every configuration file needed.
>
> **Target**: Non-mobile-developer. Every command is explicit. Every decision is justified.
>
> **Stack**: React Native + Expo (SDK 52+), NativeWind v4, Reown AppKit, Wagmi, Viem, Supabase
>
> **Backend**: NO changes needed — the mobile app calls the existing deployed Next.js API routes.

---

## Table of Contents

1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Project Initialization](#3-project-initialization)
4. [Directory Structure](#4-directory-structure)
5. [Shared Code Strategy](#5-shared-code-strategy)
6. [Authentication Implementation](#6-authentication-implementation)
7. [Web3 Wallet Integration](#7-web3-wallet-integration)
8. [Screen-by-Screen Implementation](#8-screen-by-screen-implementation)
9. [Component Library](#9-component-library)
10. [Push Notifications](#10-push-notifications)
11. [Deep Linking & URL Scheme](#11-deep-linking--url-scheme)
12. [Offline Support & Caching](#12-offline-support--caching)
13. [Testing Strategy](#13-testing-strategy)
14. [Build & Deployment (EAS)](#14-build--deployment-eas)
15. [Phased Implementation Plan](#15-phased-implementation-plan)
16. [Common Pitfalls & Troubleshooting](#16-common-pitfalls--troubleshooting)
17. [Environment Variable Reference](#17-environment-variable-reference)
18. [Minimal Backend Changes](#18-minimal-backend-changes)

---

## 1. Project Overview & Architecture

### What We're Building

A React Native mobile app that is a **new frontend** for the existing iStory backend. The app talks to the same Next.js API routes deployed on Vercel, the same Supabase database, and the same smart contracts on Base Sepolia.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    MOBILE APP (Expo)                      │
│  React Native + NativeWind + Reown AppKit + Wagmi        │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │   Auth    │  │  Record  │  │  Social  │  │ Library  │ │
│  │  Screen   │  │  Screen  │  │   Feed   │  │  Screen  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │              │              │              │       │
│       ▼              ▼              ▼              ▼       │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              API Client (api.ts)                      │ │
│  │     API_BASE_URL + Bearer Token from SecureStore      │ │
│  └────────────────────┬─────────────────────────────────┘ │
└───────────────────────┼─────────────────────────────────┘
                        │ HTTPS
                        ▼
┌───────────────────────────────────────────────────────────┐
│              EXISTING BACKEND (No Changes)                 │
│                                                            │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────────────┐ │
│  │  Next.js API │  │ Supabase │  │  Smart Contracts      │ │
│  │   (Vercel)   │  │ (DB+Auth)│  │  (Base Sepolia)       │ │
│  │              │  │          │  │  - iStoryToken         │ │
│  │ /api/ai/*    │  │ users    │  │  - StoryProtocol      │ │
│  │ /api/auth/*  │  │ stories  │  │  - StoryNFT           │ │
│  │ /api/journal │  │ comments │  │  - VerifiedMetrics     │ │
│  │ /api/social  │  │ likes    │  │                        │ │
│  │ /api/cre/*   │  │ books    │  │  KeystoneForwarder     │ │
│  │ /api/habits  │  │ habits   │  │  (Chainlink CRE)       │ │
│  └──────┬──────┘  └────┬─────┘  └───────────┬───────────┘ │
│         │              │                     │              │
│         └──────────────┴─────────────────────┘              │
│                     IPFS (Pinata)                            │
└───────────────────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Framework | React Native + Expo SDK 52 | Best DX, OTA updates, EAS builds, largest ecosystem |
| Styling | NativeWind v4 | Same Tailwind classes as web app, minimal rewrite |
| Web3 | Reown AppKit (formerly Web3Modal) | Native wallet support, WalletConnect v2, replaces RainbowKit |
| Auth Storage | expo-secure-store | Encrypted on-device storage for JWT tokens |
| Audio | expo-av | Native recording with format control |
| Navigation | Expo Router v4 | File-based routing like Next.js App Router |
| State | React Query + Zustand | Caching, offline persistence, global state |
| Git Strategy | Worktree on `mobile-app` branch | Isolated development, clean merge |

### Git Worktree Strategy

The mobile app lives in a `mobile/` subfolder on a separate `mobile-app` branch, developed using git worktree to avoid disrupting the web app on `master` and prevent conflicts when pushing to github.

```bash
# From the i_story_dapp root
git worktree add ../i_story_mobile mobile-app
cd ../i_story_mobile
# Now we're on the mobile-app branch
# The mobile/ subfolder will contain the entire Expo project
```

---

## 2. Tech Stack & Dependencies

### Library Mapping (Web → Mobile)

| Web Library | Mobile Equivalent | Notes |
|-------------|-------------------|-------|
| Next.js 15 | Expo Router v4 | File-based routing |
| React 19 | React 18.3 | RN uses React 18 |
| Tailwind CSS 4 | NativeWind v4 | Same class names |
| shadcn/ui | Custom RN components | Manual port (see Section 9) |
| RainbowKit | Reown AppKit RN | Native WalletConnect |
| Wagmi 2.17 | @wagmi/core + Reown | Hooks work same way |
| Viem 2.38 | viem (same) | Works in RN |
| framer-motion | react-native-reanimated | Animation library |
| next-themes | React Native Appearance API | Dark mode |
| react-hot-toast | react-native-toast-message | Toast notifications |
| sonner | react-native-toast-message | Combined |
| lucide-react | lucide-react-native | Same icon names |
| `navigator.mediaDevices` | expo-av | Audio recording |
| `window.speechSynthesis` | expo-speech | TTS |
| `localStorage` | @react-native-async-storage | Persistent cache |
| `sessionStorage` | In-memory Map | Ephemeral state |
| Supabase JS | @supabase/supabase-js + SecureStore adapter | Same SDK, different storage |
| `fetch` (relative `/api/*`) | `fetch` with `API_BASE_URL` prefix | Absolute URLs |

### Complete `package.json`

```json
{
  "name": "istory-mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "test": "jest",
    "lint": "eslint . --ext .ts,.tsx",
    "prebuild": "expo prebuild",
    "build:dev": "eas build --profile development --platform all",
    "build:preview": "eas build --profile preview --platform all",
    "build:production": "eas build --profile production --platform all"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-status-bar": "~2.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-av": "~15.0.0",
    "expo-speech": "~13.0.0",
    "expo-notifications": "~0.29.0",
    "expo-device": "~7.0.0",
    "expo-constants": "~17.0.0",
    "expo-linking": "~7.0.0",
    "expo-web-browser": "~14.0.0",
    "expo-auth-session": "~6.0.0",
    "expo-crypto": "~14.0.0",
    "expo-file-system": "~18.0.0",
    "expo-haptics": "~14.0.0",
    "expo-image": "~2.0.0",
    "expo-clipboard": "~7.0.0",
    "expo-updates": "~0.27.0",

    "react": "18.3.1",
    "react-native": "0.76.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-gesture-handler": "~2.20.0",
    "react-native-screens": "~4.0.0",
    "react-native-safe-area-context": "~4.12.0",

    "nativewind": "^4.1.0",
    "tailwindcss": "^3.4.0",

    "@reown/appkit": "^1.0.0",
    "@reown/appkit-wagmi-react-native": "^1.0.0",
    "wagmi": "^2.14.0",
    "viem": "^2.21.0",
    "@tanstack/react-query": "^5.60.0",

    "@supabase/supabase-js": "^2.45.0",
    "@react-native-async-storage/async-storage": "^2.1.0",

    "zustand": "^5.0.0",
    "react-native-toast-message": "^2.2.0",
    "lucide-react-native": "^0.460.0",
    "react-native-svg": "^15.9.0",
    "date-fns": "^4.1.0",
    "zod": "^3.23.0",
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",

    "@react-native-community/netinfo": "^11.4.0",

    "react-native-get-random-values": "^1.11.0",
    "react-native-url-polyfill": "^2.0.0",
    "@ethersproject/shims": "^5.7.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@types/react": "~18.3.0",
    "typescript": "^5.6.0",
    "eslint": "^9.0.0",
    "jest": "^29.7.0",
    "@testing-library/react-native": "^12.8.0",
    "jest-expo": "~52.0.0"
  }
}
```

### `app.config.ts`

```typescript
import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "iStory",
  slug: "istory",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#0f172a",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.istory.app",
    infoPlist: {
      NSMicrophoneUsageDescription:
        "iStory needs microphone access to record voice journals",
      NSCameraUsageDescription:
        "iStory needs camera access for profile photos",
    },
    associatedDomains: ["applinks:istory.vercel.app"],
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0f172a",
    },
    package: "com.istory.app",
    permissions: ["RECORD_AUDIO", "CAMERA"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "istory.vercel.app",
            pathPrefix: "/",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  scheme: "istory",
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#7c3aed",
      },
    ],
    "expo-av",
  ],
  extra: {
    eas: {
      projectId: "YOUR_EAS_PROJECT_ID",
    },
    API_BASE_URL: process.env.API_BASE_URL || "https://istory.vercel.app",
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID,
  },
  updates: {
    url: "https://u.expo.dev/YOUR_EAS_PROJECT_ID",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
});
```

### `babel.config.js`

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
```

### `metro.config.js`

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

### `tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        memory: {
          100: "#f0e6ff",
          200: "#d9c2ff",
          400: "#a855f7",
          500: "#9333ea",
          600: "#7c3aed",
          900: "#3b0764",
        },
        insight: {
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
        },
        growth: {
          200: "#bbf7d0",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          900: "#14532d",
        },
        story: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        void: {
          surface: "#f8fafc",
          light: "#f1f5f9",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

### `global.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### `tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

---

## 3. Project Initialization

### Step-by-Step Commands

```bash
# 1. Create git worktree for mobile development
cd /path/to/i_story_dapp
git branch mobile-app
git worktree add ../i_story_mobile mobile-app
cd ../i_story_mobile

# 2. Create Expo project inside a mobile/ subfolder
npx create-expo-app@latest mobile --template tabs
cd mobile

# 3. Install all dependencies (run from mobile/ directory)
npx expo install expo-router expo-secure-store expo-av expo-speech \
  expo-notifications expo-device expo-constants expo-linking \
  expo-web-browser expo-auth-session expo-crypto expo-file-system \
  expo-haptics expo-image expo-clipboard expo-updates \
  react-native-reanimated react-native-gesture-handler \
  react-native-screens react-native-safe-area-context \
  @react-native-async-storage/async-storage react-native-svg \
  @react-native-community/netinfo react-native-get-random-values \
  react-native-url-polyfill @ethersproject/shims

# 4. Install npm packages (not Expo-managed)
npm install nativewind tailwindcss \
  @reown/appkit @reown/appkit-wagmi-react-native \
  wagmi viem @tanstack/react-query \
  @supabase/supabase-js zustand \
  react-native-toast-message lucide-react-native \
  date-fns zod react-hook-form @hookform/resolvers

# 5. Install dev dependencies
npm install -D @types/react typescript eslint \
  jest @testing-library/react-native jest-expo

# 6. Create polyfill file (MUST be first import everywhere)
cat > polyfills.ts << 'EOF'
// CRITICAL: These MUST be imported before anything else
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import "@ethersproject/shims";
EOF

# 7. Create environment file
cat > .env << 'EOF'
API_BASE_URL=https://istory.vercel.app
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
EOF

# 8. Create global.css for NativeWind
echo '@tailwind base;\n@tailwind components;\n@tailwind utilities;' > global.css

# 9. Create development build (needed for native modules)
npx expo prebuild
```

### Critical: Polyfill Import Order

The polyfills file **MUST** be imported at the very top of the entry point (`app/_layout.tsx`), before any other imports. WalletConnect and crypto operations will fail silently without these.

```typescript
// app/_layout.tsx — FIRST LINE
import "../polyfills";
// ... all other imports after this
```

---

## 4. Directory Structure

```
mobile/
├── app/                           # Expo Router pages
│   ├── _layout.tsx                # Root layout (providers, fonts)
│   ├── index.tsx                  # Home screen (redirect or hero)
│   ├── (tabs)/                    # Tab navigator group
│   │   ├── _layout.tsx            # Tab bar configuration
│   │   ├── index.tsx              # Home tab
│   │   ├── record.tsx             # Record tab
│   │   ├── social.tsx             # Community tab
│   │   ├── library.tsx            # Archive tab
│   │   └── profile.tsx            # Profile tab
│   ├── story/
│   │   └── [storyId].tsx          # Story detail screen
│   ├── book/
│   │   └── [bookId].tsx           # Book detail screen
│   ├── tracker.tsx                # Daily tracker (accessible from profile)
│   ├── auth/
│   │   ├── login.tsx              # Login/onboarding screen
│   │   └── onboarding.tsx         # New user onboarding
│   └── settings.tsx               # App settings
├── components/
│   ├── ui/                        # Base UI components (RN equivalents of shadcn)
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Tabs.tsx
│   │   ├── Dialog.tsx
│   │   ├── Separator.tsx
│   │   ├── Progress.tsx
│   │   └── Textarea.tsx
│   ├── StoryCard.tsx              # Story card for feeds
│   ├── StoryInsights.tsx          # AI insights display
│   ├── VerifiedBadge.tsx          # CRE verification badge
│   ├── VerifiedMetricsCard.tsx    # CRE metrics display
│   ├── CanonicalBadge.tsx         # Key moment badge
│   ├── WeeklyReflection.tsx       # Weekly reflection section
│   ├── AudioRecorder.tsx          # Audio recording component
│   ├── MoodSelector.tsx           # Mood emoji picker
│   ├── HeatmapGrid.tsx            # Activity heatmap
│   └── Toast.tsx                  # Toast configuration
├── lib/
│   ├── api.ts                     # API client with auth headers
│   ├── supabase.ts                # Supabase client with SecureStore
│   ├── auth.ts                    # Auth state management (Zustand)
│   ├── contracts.ts               # Contract addresses & ABIs (copy from web)
│   ├── wagmi.config.ts            # Wagmi + Reown AppKit config
│   ├── storage.ts                 # SecureStore + AsyncStorage helpers
│   └── constants.ts               # App-wide constants
├── hooks/
│   ├── useIStoryToken.ts          # ERC20 token hook
│   ├── useStoryProtocol.ts        # Tips & paywall hook
│   ├── useStoryNFT.ts             # NFT minting hook
│   ├── useVerifiedMetrics.ts      # CRE verification hook
│   ├── useStoryMetadata.ts        # Story metadata hook
│   ├── usePatterns.ts             # Patterns & themes hook
│   ├── useNotifications.ts        # Push + in-app notifications
│   ├── useReflection.ts           # Weekly reflection hook
│   ├── useDeviceCapability.ts     # Device capability detection (replaces web WebGL check)
│   ├── useReducedMotion.ts        # Accessibility: reduced motion (use react-native-reanimated)
│   ├── useAuth.ts                 # Auth context hook
│   └── useNetworkStatus.ts        # Online/offline detection
├── types/
│   └── index.ts                   # Shared TypeScript types (copy from web)
├── contexts/
│   └── AuthContext.tsx             # Auth context provider
├── assets/
│   ├── icon.png                   # App icon (1024x1024)
│   ├── splash.png                 # Splash screen
│   ├── adaptive-icon.png          # Android adaptive icon
│   └── notification-icon.png      # Notification icon
├── polyfills.ts                   # Crypto & URL polyfills
├── global.css                     # NativeWind styles
├── app.config.ts                  # Expo config
├── babel.config.js                # Babel config
├── metro.config.js                # Metro bundler config
├── tailwind.config.ts             # Tailwind/NativeWind config
├── tsconfig.json                  # TypeScript config
├── eas.json                       # EAS Build config
├── .env                           # Environment variables
└── package.json
```

---

## 5. Shared Code Strategy

### Files to Copy Directly (No Changes)

These files can be copied verbatim from the web app:

| Web Path | Mobile Path | Contents |
|----------|-------------|----------|
| `app/types/index.ts` | `types/index.ts` | All TypeScript interfaces (`StoryDataType`, `AuthorProfile`, `StoryMetadata`, `NarrativeObject`, `Notification`, `WeeklyReflection`, etc.) — **remove mock data** and `moodColors` Tailwind classes |
| `lib/contracts.ts` | `lib/contracts.ts` | Contract addresses and ABIs — **replace `process.env.NEXT_PUBLIC_*` with Constants from expo-constants** |

### Files That Need Full Rewrite

| Web File | Mobile File | Why |
|----------|-------------|-----|
| `components/AuthProvider.tsx` | `contexts/AuthContext.tsx` + `lib/auth.ts` | Replace browser-based Supabase auth with SecureStore + expo-auth-session |
| `app/utils/supabase/supabaseClient.ts` | `lib/supabase.ts` | Use SecureStore adapter instead of browser localStorage |
| `lib/wagmi.config.ts` | `lib/wagmi.config.ts` | Replace RainbowKit with Reown AppKit |
| `components/Provider.tsx` | `app/_layout.tsx` | Different provider stack for RN |
| `components/Navigation.tsx` | `app/(tabs)/_layout.tsx` | Expo Router tab navigator |
| `app/hooks/useDeviceCapability.ts` | `hooks/useDeviceCapability.ts` | Web version detects WebGL/UA. Replace with `expo-device` + `Dimensions` API. No WebGL on mobile. |
| `app/hooks/useReducedMotion.ts` | `hooks/useReducedMotion.ts` | Web uses `matchMedia`. Replace with `useReducedMotion` from `react-native-reanimated` or `AccessibilityInfo.isReduceMotionEnabled()`. |
| All `*PageClient.tsx` files | `app/(tabs)/*.tsx` | Full rewrite for RN components |

### Types Adaptation

Copy `app/types/index.ts` and make these changes:

```typescript
// types/index.ts (mobile)
// Copy all interfaces from web app/types/index.ts
// Remove: mockStories, mockAuthors, featuredWriters (mock data)
// Remove: moodColors (Tailwind gradient classes don't work in RN)

// Add mobile-specific mood colors:
export const moodColors: Record<string, { from: string; to: string }> = {
  peaceful: { from: "#4ade80", to: "#059669" },
  inspiring: { from: "#facc15", to: "#f97316" },
  adventurous: { from: "#60a5fa", to: "#06b6d4" },
  nostalgic: { from: "#c084fc", to: "#ec4899" },
  thoughtful: { from: "#818cf8", to: "#a855f7" },
  exciting: { from: "#f87171", to: "#ea580c" },
  neutral: { from: "#9ca3af", to: "#64748b" },
  unknown: { from: "#9ca3af", to: "#64748b" },
};

// Add: Push notification token type
export interface PushTokenData {
  token: string;
  platform: "ios" | "android";
  device_id: string;
}
```

### Contracts Adaptation

```typescript
// lib/contracts.ts (mobile)
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra || {};

export const STORY_TOKEN_ADDRESS = "0xf9eDD76B55F58Bf4E8Ae2A90a1D6d8d44dfA74BC";
export const STORY_PROTOCOL_ADDRESS = "0xA51a4cA00cC4C81A5F7cB916D0BFa1a4aD6f4a71";
export const STORY_NFT_ADDRESS = "0x6D37ebc5eAEF37ecC888689f295D114187933342";
export const VERIFIED_METRICS_ADDRESS =
  extra.VERIFIED_METRICS_ADDRESS || "0x052B52A4841080a98876275d5f8E6d094c9E086C";

// ABIs — copy exactly from web lib/contracts.ts
export const STORY_TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
] as const;

export const STORY_PROTOCOL_ABI = [
  "function tipCreator(address creator, uint256 amount, uint256 storyId)",
  "function payPaywall(address author, uint256 amount, uint256 contentId)",
  "event TipSent(address indexed from, address indexed to, uint256 amount, uint256 indexed storyId)",
  "event ContentUnlocked(address indexed payer, address indexed author, uint256 amount, uint256 indexed contentId)",
] as const;

export const STORY_NFT_ABI = [
  "function mintBook(string memory uri)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  'event NFTMinted(uint256 indexed tokenId, address indexed recipient, string uri, string collectionType)',
] as const;

export const VERIFIED_METRICS_ABI = [
  "function onReport(bytes calldata metadata, bytes calldata report)",
  "function getMetrics(bytes32 storyId) view returns (uint8 significanceScore, uint8 emotionalDepth, uint8 qualityScore, uint32 wordCount, string[] themes, bytes32 attestationId, uint256 verifiedAt)",
  "function isVerified(bytes32 storyId) view returns (bool)",
  "function getAttestationId(bytes32 storyId) view returns (bytes32)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
] as const;
```

---

## 6. Authentication Implementation

### Overview

The mobile app uses the same auth flows as the web but adapted for native:
- **Wallet auth**: WalletConnect deep links → nonce signing → JWT
- **Google OAuth**: `expo-auth-session` → redirect → Supabase session
- **Token storage**: `expo-secure-store` (encrypted)

### Supabase Client with SecureStore

```typescript
// lib/supabase.ts
import "react-native-url-polyfill/auto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra || {};

const SUPABASE_URL = extra.SUPABASE_URL;
const SUPABASE_ANON_KEY = extra.SUPABASE_ANON_KEY;

// SecureStore adapter for Supabase auth persistence
const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("SecureStore setItem error:", error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error("SecureStore removeItem error:", error);
    }
  },
};

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: SecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Important for RN
    },
  }
);
```

### API Client

```typescript
// lib/api.ts
import Constants from "expo-constants";
import { supabase } from "./supabase";

const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || "https://istory.vercel.app";

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Fetch wrapper that:
 * 1. Prepends API_BASE_URL to relative paths
 * 2. Automatically injects Bearer token from Supabase session
 * 3. Sets Content-Type to application/json by default
 */
export async function api(path: string, options: ApiOptions = {}): Promise<Response> {
  const { skipAuth = false, headers: customHeaders, ...rest } = options;

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  if (!skipAuth) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return fetch(url, { ...rest, headers });
}

/**
 * Convenience methods
 */
export const apiGet = (path: string, options?: ApiOptions) =>
  api(path, { ...options, method: "GET" });

export const apiPost = (path: string, body: unknown, options?: ApiOptions) =>
  api(path, {
    ...options,
    method: "POST",
    body: JSON.stringify(body),
  });

export const apiPut = (path: string, body: unknown, options?: ApiOptions) =>
  api(path, {
    ...options,
    method: "PUT",
    body: JSON.stringify(body),
  });

export const apiDelete = (path: string, options?: ApiOptions) =>
  api(path, { ...options, method: "DELETE" });

/**
 * Upload FormData (e.g., audio files) — skips JSON Content-Type
 */
export async function apiUpload(path: string, formData: FormData): Promise<Response> {
  const url = `${API_BASE_URL}${path}`;

  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Don't set Content-Type — let fetch set multipart boundary

  return fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });
}
```

### Auth State (Zustand Store)

```typescript
// lib/auth.ts
import { create } from "zustand";
import { supabase } from "./supabase";
import { api, apiPost } from "./api";
import type { User, Session } from "@supabase/supabase-js";

// Matches web UnifiedUserProfile
export interface UnifiedUserProfile {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  avatar: string | null;
  wallet_address: string | null;
  balance: string;
  isConnected: boolean;
  supabaseUser: User | null;
  auth_provider: "wallet" | "google" | "both";
  is_onboarded: boolean;
  google_id: string | null;
}

interface AuthState {
  profile: UnifiedUserProfile | null;
  isLoading: boolean;
  needsOnboarding: boolean;

  // Actions
  setProfile: (profile: UnifiedUserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setNeedsOnboarding: (needs: boolean) => void;

  // Auth flows
  handleWalletLogin: (address: string, signMessage: (msg: string) => Promise<string>) => Promise<void>;
  handleGoogleLogin: (session: Session) => Promise<void>;
  completeOnboarding: (data: { name: string; username: string; email: string }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null,
  isLoading: true,
  needsOnboarding: false,

  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setNeedsOnboarding: (needsOnboarding) => set({ needsOnboarding }),

  /**
   * Wallet Login Flow:
   * 1. Fetch nonce from server
   * 2. Sign nonce with wallet
   * 3. Send signature to login endpoint
   * 4. Create Supabase session from returned token
   * 5. Build profile from returned user data
   */
  handleWalletLogin: async (address, signMessage) => {
    try {
      set({ isLoading: true });

      // Step 1: Fetch nonce
      const nonceRes = await api(`/api/auth/nonce?address=${address}`, { skipAuth: true });
      if (!nonceRes.ok) throw new Error("Failed to get nonce");
      const { message } = await nonceRes.json();

      // Step 2: Sign with wallet
      const signature = await signMessage(message);

      // Step 3: Login
      const loginRes = await apiPost("/api/auth/login", { address, message, signature }, { skipAuth: true });
      if (!loginRes.ok) {
        const err = await loginRes.json().catch(() => ({}));
        throw new Error(err.error || "Auth failed");
      }

      const json = await loginRes.json();
      const userRow = json.user;

      // Step 4: Create Supabase session
      if (json.session_token && json.session_email) {
        await supabase.auth.verifyOtp({
          email: json.session_email,
          token: json.session_token,
          type: "email",
        });
      }

      // Step 5: Build profile
      if (userRow) {
        const { data: { session } } = await supabase.auth.getSession();
        const profile = buildProfile(userRow, session?.user ?? null, address, true);
        set({ profile, needsOnboarding: !profile.is_onboarded });
      }
    } catch (error) {
      console.error("[AUTH] Wallet login error:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Google OAuth Flow:
   * Handles the post-OAuth callback after expo-auth-session redirect
   */
  handleGoogleLogin: async (session) => {
    try {
      set({ isLoading: true });
      const user = session.user;
      const googleId = user.identities?.[0]?.id ?? user.id;

      // Priority 1: Check by Supabase auth user ID
      const { data: existing } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (existing) {
        set({
          profile: buildProfile(existing, user, null, false),
          needsOnboarding: !existing.is_onboarded,
        });
        return;
      }

      // Priority 2: Check by google_id
      const { data: byGoogleId } = await supabase
        .from("users")
        .select("*")
        .eq("google_id", googleId)
        .maybeSingle();

      if (byGoogleId) {
        set({
          profile: buildProfile(byGoogleId, user, null, false),
          needsOnboarding: !byGoogleId.is_onboarded,
        });
        return;
      }

      // Priority 3: Create new Google user
      const { data: created } = await supabase
        .from("users")
        .upsert(
          {
            id: user.id,
            name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
            email: user.email ?? null,
            avatar: user.user_metadata?.avatar_url ?? null,
            google_id: googleId,
            auth_provider: "google",
            is_onboarded: true,
            wallet_address: null,
          },
          { onConflict: "id", ignoreDuplicates: true }
        )
        .select()
        .maybeSingle();

      if (created) {
        set({
          profile: buildProfile(created, user, null, false),
          needsOnboarding: !created.is_onboarded,
        });
      }
    } catch (error) {
      console.error("[AUTH] Google login error:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  completeOnboarding: async (data) => {
    const { profile } = get();
    if (!profile) throw new Error("No profile to onboard");

    const res = await apiPost("/api/auth/onboarding", { userId: profile.id, ...data });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Onboarding failed");
    }

    const { user } = await res.json();
    set({
      profile: buildProfile(user, profile.supabaseUser, profile.wallet_address, profile.isConnected),
      needsOnboarding: false,
    });
  },

  refreshProfile: async () => {
    const { profile } = get();
    if (!profile) return;

    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", profile.id)
      .maybeSingle();

    if (data) {
      set({
        profile: buildProfile(data, profile.supabaseUser, profile.wallet_address, profile.isConnected),
      });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null, needsOnboarding: false });
  },

  /**
   * Hydrate session on app start
   */
  hydrate: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        set({ isLoading: false });
        return;
      }

      // Look up user in DB
      const { data: userRow } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (userRow) {
        set({
          profile: buildProfile(userRow, session.user, userRow.wallet_address, false),
          needsOnboarding: !userRow.is_onboarded,
        });
      }
    } catch (error) {
      console.error("[AUTH] Hydration error:", error);
    } finally {
      set({ isLoading: false });
    }
  },
}));

function buildProfile(
  userRow: any,
  sessionUser: User | null,
  walletAddress: string | null,
  isConnected: boolean
): UnifiedUserProfile {
  return {
    id: userRow.id,
    name: userRow.name ?? null,
    username: userRow.username ?? null,
    email: userRow.email ?? null,
    avatar: userRow.avatar ?? null,
    wallet_address: (userRow.wallet_address ?? walletAddress ?? null)?.toLowerCase?.() ?? null,
    balance: "0",
    isConnected,
    supabaseUser: sessionUser,
    auth_provider: userRow.auth_provider ?? "wallet",
    is_onboarded: userRow.is_onboarded ?? false,
    google_id: userRow.google_id ?? null,
  };
}

// Convenience hook (re-export from Zustand)
export const useAuth = () => useAuthStore();
```

### Google OAuth with expo-auth-session

```typescript
// In auth/login.tsx or a useGoogleAuth hook:
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/auth";
import Constants from "expo-constants";

WebBrowser.maybeCompleteAuthSession();

const SUPABASE_URL = Constants.expoConfig?.extra?.SUPABASE_URL;

export function useGoogleAuth() {
  const { handleGoogleLogin } = useAuthStore();

  const redirectTo = AuthSession.makeRedirectUri({
    scheme: "istory",
    path: "auth/callback",
  });

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data?.url) {
      console.error("OAuth init error:", error);
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo
    );

    if (result.type === "success" && result.url) {
      // Extract tokens from URL
      const url = new URL(result.url);
      const params = new URLSearchParams(url.hash.substring(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (access_token && refresh_token) {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

        if (!sessionError && sessionData.session) {
          await handleGoogleLogin(sessionData.session);
        }
      }
    }
  };

  return { signInWithGoogle };
}
```

---

## 7. Web3 Wallet Integration

### Reown AppKit Setup (Replaces RainbowKit)

```typescript
// lib/wagmi.config.ts
import { createAppKit, defaultWagmiConfig } from "@reown/appkit-wagmi-react-native";
import { baseSepolia, sepolia } from "wagmi/chains";
import Constants from "expo-constants";

const projectId = Constants.expoConfig?.extra?.WALLETCONNECT_PROJECT_ID || "";

const metadata = {
  name: "iStory",
  description: "AI-Powered Voice Journaling dApp",
  url: "https://istory.vercel.app",
  icons: ["https://istory.vercel.app/icon.png"],
  redirect: {
    native: "istory://",
    universal: "https://istory.vercel.app",
  },
};

const chains = [baseSepolia, sepolia] as const;

export const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
});

createAppKit({
  projectId,
  wagmiConfig,
  defaultChain: baseSepolia,
  enableAnalytics: false,
});

export { chains };
```

### Provider Stack (Root Layout)

```typescript
// app/_layout.tsx
import "../polyfills"; // MUST BE FIRST

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { AppKit } from "@reown/appkit-wagmi-react-native";
import Toast from "react-native-toast-message";

import { wagmiConfig } from "@/lib/wagmi.config";
import { useAuthStore } from "@/lib/auth";

import "../global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: colorScheme === "dark" ? "#0f172a" : "#ffffff",
                },
              }}
            />
            <AppKit />
            <Toast />
          </QueryClientProvider>
        </WagmiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

### Web3 Hooks Adaptation

The web3 hooks from the web app (`useIStoryToken`, `useStoryProtocol`, `useStoryNFT`, `useVerifiedMetrics`) can be copied **almost verbatim** because they use Wagmi hooks which work the same way in React Native.

Key changes needed:
1. Replace `import { toast } from "react-hot-toast"` with `import Toast from "react-native-toast-message"`
2. Replace `toast.success("msg")` with `Toast.show({ type: "success", text1: "msg" })`
3. Replace `toast.error("msg")` with `Toast.show({ type: "error", text1: "msg" })`
4. Replace `toast.loading("msg", { id: "x" })` with `Toast.show({ type: "info", text1: "msg", autoHide: false })`

```typescript
// hooks/useIStoryToken.ts (mobile)
// Copy from app/hooks/useIStoryToken.ts
// Replace toast calls:
//   toast.loading("...", { id: "approve-toast" })  →  Toast.show({ type: "info", text1: "...", autoHide: false })
//   toast.success("...", { id: "approve-toast" })  →  Toast.show({ type: "success", text1: "..." })
//   toast.error("...")                             →  Toast.show({ type: "error", text1: "..." })
// Replace import path for contracts:
//   "@/lib/contracts"  →  "@/lib/contracts"  (same alias works with tsconfig paths)

// hooks/useStoryProtocol.ts (mobile) — same pattern
// hooks/useStoryNFT.ts (mobile) — same pattern
```

For `useVerifiedMetrics`, replace `useBrowserSupabase` with the direct supabase import:

```typescript
// hooks/useVerifiedMetrics.ts (mobile)
// Replace: import { useBrowserSupabase } from "./useBrowserSupabase";
// With:    import { supabase } from "@/lib/supabase";
// Replace: const supabase = useBrowserSupabase();
// With:    (use supabase directly)
// Replace fetch calls with api() from lib/api.ts
```

### BigInt Handling for React Native

React Native's Hermes engine has limited BigInt support. Add this utility:

```typescript
// lib/utils.ts
/**
 * Safely convert BigInt to string for display.
 * Hermes may not support BigInt.prototype.toLocaleString()
 */
export function formatBigInt(value: bigint, decimals: number = 18): string {
  const str = value.toString();
  if (str.length <= decimals) {
    return "0." + "0".repeat(decimals - str.length) + str;
  }
  const intPart = str.slice(0, str.length - decimals);
  const decPart = str.slice(str.length - decimals, str.length - decimals + 4);
  return `${intPart}.${decPart}`;
}

/**
 * JSON.stringify with BigInt support
 */
export function safeStringify(obj: unknown): string {
  return JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}
```

---

## 8. Screen-by-Screen Implementation

### 8.1. Tab Layout

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import {
  Home,
  Mic,
  Archive,
  Users,
  User,
} from "lucide-react-native";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#7c3aed",
        tabBarInactiveTintColor: isDark ? "#9ca3af" : "#6b7280",
        tabBarStyle: {
          backgroundColor: isDark ? "#1f2937" : "#ffffff",
          borderTopColor: isDark ? "#374151" : "#e5e7eb",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: "Record",
          tabBarIcon: ({ color, size }) => <Mic size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: "Community",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Archive",
          tabBarIcon: ({ color, size }) => <Archive size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

### 8.2. Home Screen

**Web equivalent**: `app/page.tsx` (homepage)
**Purpose**: Hero section, quick stats, quick actions, recent stories

```
Key elements:
- Welcome message with user name
- Quick action buttons: Record, Browse Stories, View Archive
- Token balance display (from useIStoryToken hook)
- Recent stories preview (last 3 stories from Supabase)
- Writing streak display
- AppKit connect button (if not connected)
```

**API calls**:
- `GET /api/user/profile` — user stats
- Supabase direct: `stories.select().eq("author_id", userId).limit(3)`

### 8.3. Record Screen

**Web equivalent**: `app/record/RecordPageClient.tsx`
**Purpose**: Voice recording, transcription, enhancement, save

This is the most complex screen. Key differences from web:

| Web Feature | Mobile Equivalent |
|-------------|-------------------|
| `navigator.mediaDevices.getUserMedia()` | `expo-av` Audio.Recording |
| `MediaRecorder` | `Audio.Recording` with WAV/M4A format |
| `window.speechSynthesis` | `expo-speech` |
| `audio/webm` blob | `audio/m4a` or `audio/wav` file URI |
| FormData with Blob | FormData with file URI |

```
Key elements:
- Large record button (animated with Reanimated)
- Recording timer
- Title input
- Date picker (mobile native)
- Public/Private toggle
- Content textarea (multiline TextInput)
- Action buttons: Read Aloud, Enhance AI, Save
- Recording tips card

Audio Recording Flow:
1. Request microphone permission (expo-av)
2. Start recording with Audio.Recording
3. On stop: get file URI
4. Upload to /api/ai/transcribe as FormData
5. Display transcribed text
6. Optional: enhance via /api/ai/enhance
7. Save: upload audio to Supabase storage, pin to IPFS, save to DB
```

**API calls**:
- `POST /api/ai/transcribe` (FormData with audio file)
- `POST /api/ai/enhance` (JSON: `{ text }`)
- `POST /api/journal/save` (JSON: story data) — or direct Supabase insert
- IPFS upload via `ipfsService` (rewrite to use `api()` helper)

**Audio Recording Implementation**:

```typescript
// components/AudioRecorder.tsx
import { useState, useRef } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error("Microphone permission required");

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await recording.startAsync();

    recordingRef.current = recording;
    setIsRecording(true);
    setDuration(0);
    intervalRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  };

  const stopRecording = async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();

    if (intervalRef.current) clearInterval(intervalRef.current);
    recordingRef.current = null;
    setIsRecording(false);

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    return uri;
  };

  const getFormData = async (uri: string): Promise<FormData> => {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    const formData = new FormData();
    formData.append("file", {
      uri,
      name: "recording.m4a",
      type: "audio/m4a",
    } as any);
    return formData;
  };

  return {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    getFormData,
  };
}
```

### 8.4. Social Feed Screen

**Web equivalent**: `app/social/SocialPageClient.tsx`
**Purpose**: Public story feed with search, tabs, interactions

```
Key elements:
- Stats bar (stories today, active writers, trending, $ISTORY balance)
- Search bar
- Tabs: Latest, Trending, Following
- FlatList of StoryCards (instead of .map())
- Pull-to-refresh
- Infinite scroll (load more on end reached)
- Featured Writers sidebar → horizontal scroll on mobile
- Trending Topics → horizontal badge scroll
```

**Key mobile adaptations**:
- Replace `<AnimatePresence>` + `.map()` with `<FlatList>` for performance
- Use `onEndReached` + `onEndReachedThreshold` for infinite scroll
- Use `refreshControl` for pull-to-refresh
- Sidebar becomes a horizontal scroll section above the feed

**API calls**:
- Supabase direct: `stories.select(...).order("created_at", { ascending: false })`
- `GET /api/social/follow?follower_wallet=...&followed_wallets=...`
- `POST /api/social/follow` (follow/unfollow)
- `POST /api/social/like` (like/unlike)

### 8.5. Library/Archive Screen

**Web equivalent**: `app/library/LibraryPageClient.tsx`
**Purpose**: Personal story archive, books, patterns, themes

```
Key elements:
- Monthly Summary card
- Stats grid (total stories, key moments, books, themes)
- Search bar
- Tabs: All, Stories, Books, Key Moments, Themes, Life Areas
- Story cards with selection mode for book compilation
- Book compilation dialog
- Patterns views (ThemesView, DomainsView)
```

**API calls**:
- Supabase: `stories.select("*").eq("author_id", userId)`
- Supabase: `books.select("*").eq("author_id", userId)`
- Supabase: `stories.select("*, story_metadata(*)")`
- `POST /api/books` (create book)
- IPFS upload for book metadata
- `mintBook()` via useStoryNFT hook

### 8.6. Profile Screen

**Web equivalent**: `app/profile/ProfilePageClient.tsx`
**Purpose**: User profile, settings, achievements, activity heatmap, linked accounts

```
Key elements:
- Profile card (avatar, name, bio, wallet, balance)
- Quick stats (stories, likes, views, books)
- Tabs: Overview, Achievements, Activity, Settings
- Overview: writing goals progress bars, daily journal compilation, weekly reflection
- Achievements: earned/unearned badges
- Activity: contribution heatmap (custom component), recent activity list
- Settings: profile edit form, linked accounts (Google + Wallet), preferences
```

**API calls**:
- Supabase: `users.select("*").eq("id", userId)`
- Supabase: `stories.select("id, created_at, title, content, likes, audio_url").eq("author_id", userId)`
- Supabase: `books.select("*", { count: 'exact', head: true }).eq("author_id", userId)`
- `POST /api/auth/link-account` (link wallet)
- `POST /api/auth/initiate-link` (start Google linking)
- `POST /api/ai/reflection` (weekly reflection)
- `GET /api/ai/reflection` (fetch reflections)

### 8.7. Story Detail Screen

**Web equivalent**: `app/story/[storyId]/StoryPageClient.tsx`
**Purpose**: Full story view with interactions

```
Key elements:
- Back button
- Mood gradient header
- Story title + badges (Canonical, Verified, Public/Private)
- Author info + follow button
- Story content (or paywall blocker)
- Audio player (expo-av Sound)
- Action bar: Like, Tip, Mint NFT, Share
- AI Insights (StoryInsights component)
- Verified Metrics card (CRE)
- Comments section (FlatList)
- Comment input
- Tip dialog
- Paywall unlock dialog
```

**API calls**:
- Supabase: `stories.select("..., author:users!stories_author_wallet_fkey(...)").eq("id", storyId)`
- Supabase: `comments.select("..., author:users!comments_author_id_fkey(...)").eq("story_id", storyId)`
- `GET /api/social/follow?follower_wallet=...&followed_wallets=...`
- `POST /api/social/follow`
- `POST /api/sync/verify-tx`
- Supabase: `comments.insert(...)` (post comment)
- `POST /api/cre/check` (via useVerifiedMetrics hook)
- `GET /api/stories/{storyId}/metadata` (via useStoryMetadata hook)

**Audio Playback** (replace HTML `<audio>` with expo-av):

```typescript
import { Audio } from "expo-av";

const [sound, setSound] = useState<Audio.Sound | null>(null);
const [isPlaying, setIsPlaying] = useState(false);

const playAudio = async (url: string) => {
  if (sound) {
    await sound.unloadAsync();
  }
  const { sound: newSound } = await Audio.Sound.createAsync({ uri: url });
  setSound(newSound);
  newSound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      setIsPlaying(false);
    }
  });
  await newSound.playAsync();
  setIsPlaying(true);
};

const stopAudio = async () => {
  if (sound) {
    await sound.stopAsync();
    setIsPlaying(false);
  }
};

// Clean up on unmount
useEffect(() => {
  return () => {
    sound?.unloadAsync();
  };
}, [sound]);
```

### 8.8. Book Detail Screen

**Web equivalent**: `app/books/[bookId]/page.tsx`
**Purpose**: Book contents with chapters

```
Key elements:
- Book header (title, author, description)
- Chapter/story list (SectionList)
- IPFS link
- NFT info
```

### 8.9. Daily Tracker Screen

**Web equivalent**: `app/tracker/TrackerPageClient.tsx`
**Purpose**: Habit tracking, mood logging, AI journal generation

```
Key elements:
- Header with progress percentage
- Habits list with checkboxes
- Add new habit input
- Mood selector (emoji grid)
- Daily brain dump textarea
- "Generate Journal" button (AI)
```

**API calls**:
- `GET /api/habits?user_id=...&date=...`
- `POST /api/habits` (add habit)
- `PUT /api/habits` (update daily log)
- `DELETE /api/habits?id=...`
- `POST /api/ai/enhance` (AI journal generation)
- `POST /api/journal/save` (save generated journal)

### 8.10. Auth/Login Screen

```
Key elements:
- App logo and tagline
- "Connect Wallet" button (opens AppKit modal)
- "Sign in with Google" button (expo-auth-session)
- Feature highlights carousel
```

### 8.11. Onboarding Screen

```
Key elements:
- Name input
- Username input
- Email input
- "Complete Setup" button
- API: POST /api/auth/onboarding
```

---

## 9. Component Library

### UI Component Mapping

| shadcn/ui (Web) | React Native (Mobile) | Implementation |
|-----------------|----------------------|----------------|
| `<Button>` | `<Pressable>` with NativeWind | Custom: variants (default, outline, ghost, destructive), sizes |
| `<Card>` | `<View>` with shadow + border | Custom: CardHeader, CardContent, CardTitle, CardDescription |
| `<Input>` | `<TextInput>` | Custom: styled with NativeWind |
| `<Textarea>` | `<TextInput multiline>` | Custom: auto-growing height |
| `<Badge>` | `<View>` + `<Text>` | Custom: variant colors |
| `<Avatar>` | `<Image>` from expo-image | Custom: fallback initials |
| `<Tabs>` | `<ScrollView>` horizontal tabs | Custom: TabsList, TabsTrigger, TabsContent |
| `<Dialog>` | React Native `<Modal>` | Custom: animated overlay |
| `<Separator>` | `<View>` with 1px height | Trivial |
| `<Progress>` | Animated `<View>` width | Custom: animated progress bar |
| `<Label>` | `<Text>` | Styled text |

### App-Specific Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `StoryCard` | Story preview in feeds/archive | `story`, `onLike`, `onFollow`, `onShare`, `onUnlock` |
| `StoryInsights` | AI analysis display | `storyId`, `storyText` |
| `VerifiedBadge` | CRE verification indicator | `status: "verified" \| "pending" \| "unverified"`, `txHash?` |
| `VerifiedMetricsCard` | Full CRE metrics display | `metrics`, `isPending` |
| `CanonicalBadge` | Key Moment indicator | `storyId`, `isCanonical`, `isAuthor`, `size` |
| `AudioRecorder` | Recording UI with timer | Uses `useAudioRecorder` hook |
| `MoodSelector` | Emoji mood picker | `value`, `onChange` |
| `HeatmapGrid` | GitHub-style activity grid | `data: {date, count}[]` |
| `WeeklyReflection` | Reflection display/generator | Uses `useReflection` hook |

### Design Tokens (Mobile)

Mood gradient colors (for LinearGradient backgrounds):

```typescript
// lib/constants.ts
export const moodGradients: Record<string, [string, string]> = {
  peaceful: ["#4ade80", "#059669"],
  inspiring: ["#facc15", "#f97316"],
  adventurous: ["#60a5fa", "#06b6d4"],
  nostalgic: ["#c084fc", "#ec4899"],
  thoughtful: ["#818cf8", "#a855f7"],
  exciting: ["#f87171", "#ea580c"],
  neutral: ["#9ca3af", "#64748b"],
  unknown: ["#9ca3af", "#64748b"],
};

export const emotionalToneColors: Record<string, string> = {
  reflective: "#818cf8",
  joyful: "#facc15",
  anxious: "#f87171",
  hopeful: "#4ade80",
  melancholic: "#c084fc",
  grateful: "#34d399",
  frustrated: "#ef4444",
  peaceful: "#22d3ee",
  excited: "#fb923c",
  uncertain: "#94a3b8",
  neutral: "#9ca3af",
};

export const lifeDomainColors: Record<string, string> = {
  work: "#3b82f6",
  relationships: "#ec4899",
  health: "#22c55e",
  identity: "#a855f7",
  growth: "#f59e0b",
  creativity: "#06b6d4",
  spirituality: "#8b5cf6",
  family: "#f43f5e",
  adventure: "#14b8a6",
  learning: "#6366f1",
  general: "#64748b",
};
```

---

## 10. Push Notifications

### Setup

```typescript
// hooks/useNotifications.ts (mobile)
import { useState, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { useAuthStore } from "@/lib/auth";
import { apiPost } from "@/lib/api";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const profile = useAuthStore((s) => s.profile);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    registerForPushNotifications().then((token) => {
      if (token) {
        setExpoPushToken(token);
        // Send token to backend
        if (profile?.id) {
          apiPost("/api/notifications/register-push", {
            token,
            platform: Platform.OS,
            userId: profile.id,
          }).catch(console.error);
        }
      }
    });

    // Foreground notification handler
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification);
      });

    // Notification tap handler (deep linking)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        // Handle navigation based on notification type
        if (data.storyId) {
          // Navigate to story
          // router.push(`/story/${data.storyId}`);
        }
      });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [profile?.id]);

  return { expoPushToken };
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#7c3aed",
    });
  }

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}
```

---

## 11. Deep Linking & URL Scheme

### Configuration

The app uses the `istory://` scheme, configured in `app.config.ts`.

### Route Patterns

| URL Pattern | Screen | Notes |
|-------------|--------|-------|
| `istory://` | Home | Default |
| `istory://record` | Record | Start recording |
| `istory://social` | Social Feed | |
| `istory://library` | Archive | |
| `istory://profile` | Profile | |
| `istory://story/{id}` | Story Detail | |
| `istory://book/{id}` | Book Detail | |
| `istory://tracker` | Daily Tracker | |
| `istory://auth/callback` | Auth Callback | OAuth redirect |
| `https://istory.vercel.app/story/{id}` | Story Detail | Universal link |

### Expo Router Linking

Expo Router handles deep linking automatically via file-based routing. The `scheme` in `app.config.ts` enables the `istory://` prefix.

---

## 12. Offline Support & Caching

### React Query Persistence

```typescript
// In root _layout.tsx, configure QueryClient:
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5,     // 5 minutes
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "ISTORY_QUERY_CACHE",
});

// Wrap app with PersistQueryClientProvider instead of QueryClientProvider
```

### Draft Recording Storage

```typescript
// lib/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const DRAFT_KEY = "istory_draft_recording";

export interface DraftRecording {
  title: string;
  content: string;
  audioUri: string | null;
  storyDate: string;
  isPublic: boolean;
  savedAt: string;
}

export async function saveDraft(draft: DraftRecording) {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export async function loadDraft(): Promise<DraftRecording | null> {
  const data = await AsyncStorage.getItem(DRAFT_KEY);
  return data ? JSON.parse(data) : null;
}

export async function clearDraft() {
  await AsyncStorage.removeItem(DRAFT_KEY);
}
```

### Network Status

```typescript
// hooks/useNetworkStatus.ts
import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  return { isOnline };
}
```

---

## 13. Testing Strategy

### Unit Tests (Jest + React Native Testing Library)

```json
// jest.config.js
module.exports = {
  preset: "jest-expo",
  setupFilesAfterSetup: ["@testing-library/jest-native/extend-expect"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind)"
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};
```

### Test Coverage Goals

| Area | Tests | Priority |
|------|-------|----------|
| Auth flows | Login, logout, session hydration | P0 |
| API client | Token injection, error handling | P0 |
| Record flow | Audio recording, transcription, save | P0 |
| Social feed | Fetch, like, follow, unlock | P1 |
| Story detail | Load, comment, tip, paywall | P1 |
| Library | Fetch, search, book compilation | P1 |
| Web3 hooks | Token balance, approve, tip, mint | P2 |
| Offline | Draft saving, cache loading | P2 |
| Profile | Edit, achievements, heatmap | P2 |

### E2E Tests (Maestro)

```yaml
# e2e/login_flow.yaml
appId: com.istory.app
---
- launchApp
- assertVisible: "Connect Wallet"
- assertVisible: "Sign in with Google"

# e2e/record_story.yaml
appId: com.istory.app
---
- launchApp
- tapOn: "Record"
- assertVisible: "Record Your Story"
```

---

## 14. Build & Deployment (EAS)

### `eas.json`

```json
{
  "cli": {
    "version": ">= 13.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "API_BASE_URL": "https://istory.vercel.app",
        "SUPABASE_URL": "YOUR_SUPABASE_URL",
        "SUPABASE_ANON_KEY": "YOUR_SUPABASE_ANON_KEY",
        "WALLETCONNECT_PROJECT_ID": "YOUR_PROJECT_ID"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "API_BASE_URL": "https://istory.vercel.app",
        "SUPABASE_URL": "YOUR_SUPABASE_URL",
        "SUPABASE_ANON_KEY": "YOUR_SUPABASE_ANON_KEY",
        "WALLETCONNECT_PROJECT_ID": "YOUR_PROJECT_ID"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "API_BASE_URL": "https://istory.vercel.app",
        "SUPABASE_URL": "YOUR_SUPABASE_URL",
        "SUPABASE_ANON_KEY": "YOUR_SUPABASE_ANON_KEY",
        "WALLETCONNECT_PROJECT_ID": "YOUR_PROJECT_ID"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-key.json",
        "track": "production"
      }
    }
  }
}
```

### iOS App Store Submission

1. **Apple Developer Account**: Enroll at developer.apple.com ($99/year)
2. **App Store Connect**: Create app with bundle ID `com.istory.app`
3. **Build**: `eas build --profile production --platform ios`
4. **Submit**: `eas submit --profile production --platform ios`
5. **App Review Notes**: "This app uses WalletConnect for Web3 wallet authentication. Test account: [provide test wallet address and steps]"

### Google Play Store Submission

1. **Google Play Console**: Create app at play.google.com/console ($25 one-time)
2. **Service Account**: Create for automated uploads
3. **Build**: `eas build --profile production --platform android`
4. **Submit**: `eas submit --profile production --platform android`

### OTA Updates

```bash
# Push OTA update (JS-only changes, no native code changes)
eas update --branch production --message "Bug fix: auth token refresh"
```

---

## 15. Phased Implementation Plan

### Phase 1: Foundation (Week 1-2)

**Goal**: App runs, navigates, authenticates

- [ ] Git worktree setup
- [ ] Expo project scaffolding
- [ ] Install all dependencies
- [ ] Polyfills configuration
- [ ] NativeWind setup + tailwind.config.ts
- [ ] Tab navigation (Expo Router)
- [ ] Supabase client with SecureStore adapter
- [ ] API client (lib/api.ts)
- [ ] Auth state management (Zustand store)
- [ ] Google OAuth via expo-auth-session
- [ ] Wallet connect via Reown AppKit
- [ ] Login screen
- [ ] Onboarding screen
- [ ] Basic Home screen (static)
- [ ] All UI base components (Button, Card, Input, etc.)

**Verification**: User can sign in with Google or wallet and see Home tab.

### Phase 2: Core Features (Week 3-4)

**Goal**: Record, browse, and read stories

- [ ] Record screen with audio recording (expo-av)
- [ ] Transcription via /api/ai/transcribe
- [ ] Text enhancement via /api/ai/enhance
- [ ] TTS via expo-speech
- [ ] Save story flow (IPFS + Supabase)
- [ ] Social feed with FlatList
- [ ] Story detail screen
- [ ] Comment system
- [ ] Like functionality
- [ ] Follow functionality
- [ ] Share (React Native Share API)
- [ ] Audio playback in story detail
- [ ] Library/Archive screen (stories + books list)
- [ ] Search functionality
- [ ] StoryCard component

**Verification**: User can record, save, browse, and interact with stories.

### Phase 3: Web3 Integration (Week 5-6)

**Goal**: All blockchain features working

- [ ] useIStoryToken hook (balance, approve)
- [ ] useStoryProtocol hook (tip, paywall)
- [ ] useStoryNFT hook (mint book)
- [ ] useVerifiedMetrics hook (CRE polling)
- [ ] Token balance display
- [ ] Tip dialog
- [ ] Paywall unlock flow (approve → pay → verify)
- [ ] Book compilation + NFT mint
- [ ] Story minting
- [ ] VerifiedBadge component
- [ ] VerifiedMetricsCard component
- [ ] StoryInsights component
- [ ] CanonicalBadge component

**Verification**: User can tip, unlock paywall, mint NFT, see CRE metrics.

### Phase 4: Advanced Features (Week 7-8)

**Goal**: Full feature parity with web

- [ ] Daily Tracker screen (habits, mood, AI journal)
- [ ] Profile screen (all tabs: overview, achievements, activity, settings)
- [ ] Activity heatmap component
- [ ] Achievements system
- [ ] Weekly reflection section
- [ ] usePatterns hook (themes, domains, canonical)
- [ ] Patterns views (ThemesView, DomainsView, MonthlySummary)
- [ ] Book detail screen
- [ ] Account linking (Google ↔ Wallet)
- [ ] Push notifications setup
- [ ] Notification list screen
- [ ] Profile editing with avatar upload

**Verification**: Full feature parity with web app.

### Phase 5: Polish & Ship (Week 9-10)

**Goal**: Production-ready

- [ ] Offline draft support
- [ ] React Query persistence
- [ ] Network status indicator
- [ ] Error boundaries
- [ ] Loading skeletons
- [ ] Haptic feedback (expo-haptics)
- [ ] Keyboard avoidance
- [ ] Dark mode polish
- [ ] Performance optimization (FlashList, memo)
- [ ] Accessibility (labels, roles)
- [ ] App icons and splash screen
- [ ] EAS build configuration
- [ ] TestFlight / Internal testing
- [ ] App Store submission
- [ ] Play Store submission

**Verification**: Apps approved and published on both stores.

---

## 16. Common Pitfalls & Troubleshooting

### 1. WalletConnect Polyfill Ordering

**Problem**: Crypto operations fail silently, wallet connections hang.

**Fix**: `polyfills.ts` MUST be imported before everything else in `_layout.tsx`.

```typescript
// CORRECT:
import "../polyfills"; // Line 1
import { Stack } from "expo-router"; // Line 2+

// WRONG:
import { Stack } from "expo-router";
import "../polyfills"; // Too late!
```

### 2. Audio Format Differences

**Problem**: iOS records in M4A (AAC), Android records in 3GP/AMR by default.

**Fix**: Use `Audio.RecordingOptionsPresets.HIGH_QUALITY` which outputs M4A on both platforms. The server's transcription API accepts M4A.

### 3. BigInt Serialization

**Problem**: `JSON.stringify` throws on BigInt values in Hermes.

**Fix**: Use `safeStringify()` from `lib/utils.ts`, or convert BigInts to strings before serializing.

### 4. Expo Go vs Development Build

**Problem**: Native modules (expo-secure-store, Reown AppKit) don't work in Expo Go.

**Fix**: Use `npx expo prebuild` and `npx expo run:ios` / `npx expo run:android` for development builds. Or use EAS development builds: `eas build --profile development`.

### 5. SecureStore Size Limits

**Problem**: SecureStore has a 2048-byte limit per key on some Android versions.

**Fix**: Supabase sessions are typically under this limit. If needed, chunk large values or fall back to AsyncStorage for non-sensitive data.

### 6. Keyboard Avoidance

**Problem**: Keyboard covers input fields, especially on the Record and Comment screens.

**Fix**: Use `KeyboardAvoidingView` with `behavior="padding"` on iOS and `behavior="height"` on Android:

```tsx
import { KeyboardAvoidingView, Platform } from "react-native";

<KeyboardAvoidingView
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  style={{ flex: 1 }}
  keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
>
  {/* content */}
</KeyboardAvoidingView>
```

### 7. Memory Leaks

**Problem**: Audio.Sound and Audio.Recording instances leak if not unloaded.

**Fix**: Always call `sound.unloadAsync()` in cleanup:

```typescript
useEffect(() => {
  return () => {
    sound?.unloadAsync();
    recording?.stopAndUnloadAsync();
  };
}, [sound, recording]);
```

### 8. react-native-reanimated Babel Plugin Order

**Problem**: Reanimated crashes if its Babel plugin isn't last.

**Fix**: In `babel.config.js`, ensure `"react-native-reanimated/plugin"` is the last item in `plugins`:

```javascript
plugins: ["react-native-reanimated/plugin"], // MUST be last
```

### 9. Relative URL Fetches

**Problem**: Web app uses relative paths like `fetch("/api/ai/transcribe")` which don't work in RN.

**Fix**: All API calls must use the `api()` / `apiPost()` / `apiUpload()` helpers from `lib/api.ts` which prepend `API_BASE_URL`.

### 10. FormData File Upload in React Native

**Problem**: RN FormData doesn't accept Blob objects, only `{ uri, name, type }`.

**Fix**:
```typescript
// WRONG (web-style):
formData.append("file", blob);

// CORRECT (RN-style):
formData.append("file", {
  uri: fileUri,       // file:///path/to/recording.m4a
  name: "recording.m4a",
  type: "audio/m4a",
} as any);
```

### 11. Supabase `detectSessionInUrl`

**Problem**: Supabase tries to parse URL hash for session tokens, which doesn't work in RN.

**Fix**: Set `detectSessionInUrl: false` in the Supabase client config (already done in `lib/supabase.ts`).

### 12. NativeWind Gradient Classes

**Problem**: Tailwind gradient classes (`from-*`, `to-*`, `bg-gradient-*`) don't work in NativeWind.

**Fix**: Use `expo-linear-gradient` for gradient backgrounds:

```tsx
import { LinearGradient } from "expo-linear-gradient";

<LinearGradient colors={["#7c3aed", "#0ea5e9"]} style={{ flex: 1 }}>
  {/* content */}
</LinearGradient>
```

---

## 17. Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `API_BASE_URL` | Yes | Deployed Next.js API URL (e.g., `https://istory.vercel.app`) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect Cloud project ID (same as web `NEXT_PUBLIC_PROJECT_ID`) |
| `VERIFIED_METRICS_ADDRESS` | No | VerifiedMetrics contract address (defaults to `0x052B52A4...`) |
| `EAS_PROJECT_ID` | For builds | Expo EAS project identifier |

### Where Variables Are Used

| Variable | Used In | Accessed Via |
|----------|---------|-------------|
| `API_BASE_URL` | `lib/api.ts` | `Constants.expoConfig.extra.API_BASE_URL` |
| `SUPABASE_URL` | `lib/supabase.ts` | `Constants.expoConfig.extra.SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | `lib/supabase.ts` | `Constants.expoConfig.extra.SUPABASE_ANON_KEY` |
| `WALLETCONNECT_PROJECT_ID` | `lib/wagmi.config.ts` | `Constants.expoConfig.extra.WALLETCONNECT_PROJECT_ID` |

---

## 18. Minimal Backend Changes

The mobile app requires **very few** backend changes. The existing API is designed to be client-agnostic.

### 1. Push Token Storage (New)

Add a table or column to store push notification tokens:

```sql
-- Option A: New table
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('ios', 'android')),
  device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Option B: Add to users table
ALTER TABLE users ADD COLUMN push_token TEXT;
ALTER TABLE users ADD COLUMN push_platform TEXT;
```

### 2. Push Token Registration Endpoint (New)

```
POST /api/notifications/register-push
Body: { token, platform, userId }
Auth: Bearer token
```

### 3. OAuth Redirect URL Registration

Add the mobile deep link to Supabase OAuth redirect allowlist:

- `istory://auth/callback`

This is configured in: **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**

### 4. CORS (Typically Not Needed)

Native apps don't use CORS (it's a browser concept). The existing API should work without changes. However, if you add explicit CORS headers that whitelist only specific origins, ensure they don't accidentally block native requests (which have no `Origin` header).

### 5. Audio Transcription Content-Type

The `/api/ai/transcribe` endpoint already accepts `multipart/form-data` with audio files. React Native sends files as `{ uri, name, type }` which the server handles correctly via `FormData` parsing. No changes needed — but verify the server accepts `audio/m4a` MIME type in addition to `audio/webm`.

---

## API Route Completeness Checklist

Every API route from the web app that the mobile app calls:

| Route | Method | Mobile Usage |
|-------|--------|-------------|
| `/api/auth/nonce` | GET | Wallet auth nonce |
| `/api/auth/login` | POST | Wallet login |
| `/api/auth/callback` | GET | OAuth callback (via deep link) |
| `/api/auth/onboarding` | POST | New user setup |
| `/api/auth/link-account` | POST | Link wallet to Google |
| `/api/auth/link-google` | POST | Link Google to wallet |
| `/api/auth/initiate-link` | POST | Start linking flow |
| `/api/ai/transcribe` | POST | Voice transcription |
| `/api/ai/enhance` | POST | Text enhancement + journal generation |
| `/api/ai/analyze` | POST | Story metadata extraction |
| `/api/ai/reflection` | GET/POST | Weekly reflections |
| `/api/journal/save` | POST | Save story |
| `/api/stories` | GET/POST | Story CRUD |
| `/api/stories/[storyId]` | GET | Story detail |
| `/api/stories/[storyId]/metadata` | GET/PATCH | Story metadata |
| `/api/book/compile` | POST | Book compilation |
| `/api/books` | GET/POST | Book CRUD |
| `/api/books/[bookId]` | GET | Book detail |
| `/api/social/like` | POST | Like/unlike |
| `/api/social/follow` | GET/POST | Follow/unfollow |
| `/api/tip` | POST | Send tip |
| `/api/paywall` | POST | Unlock content |
| `/api/user/profile` | GET/PUT | Profile CRUD |
| `/api/habits` | GET/POST/PUT/DELETE | Habit tracking |
| `/api/notifications` | GET/POST/PUT/DELETE | Notification CRUD |
| `/api/cre/trigger` | POST | Trigger CRE verification |
| `/api/cre/check` | POST | Check CRE status |
| `/api/ipfs/upload` | POST | IPFS upload |
| `/api/email/send` | POST | Email sending |
| `/api/sync/verify_tx` | POST | Verify blockchain tx |

Total: **30 API routes** — all called from mobile via `API_BASE_URL` prefix.

> **Note**: Two server-only routes are intentionally excluded: `/api/cron/distribute-rewards` (triggered by scheduler, uses `CRON_SECRET`) and `/api/admin/analysis-stats` (admin dashboard, uses `ADMIN_SECRET`). These are never called from any client app.

---

## Web3 Hook Coverage

| Hook | Mobile File | Status |
|------|-------------|--------|
| `useIStoryToken` | `hooks/useIStoryToken.ts` | Copy + adapt toast calls |
| `useStoryProtocol` | `hooks/useStoryProtocol.ts` | Copy + adapt toast calls |
| `useStoryNFT` | `hooks/useStoryNFT.ts` | Copy + adapt toast calls |
| `useVerifiedMetrics` | `hooks/useVerifiedMetrics.ts` | Rewrite: replace useBrowserSupabase + fetch with api() |
| `useStoryMetadata` | `hooks/useStoryMetadata.ts` | Rewrite: replace fetch with api() |
| `usePatterns` | `hooks/usePatterns.ts` | Rewrite: replace supabaseClient + useAuth |
| `useNotifications` | `hooks/useNotifications.ts` | Rewrite: replace localStorage token with Supabase session + add push |
| `useReflection` | `hooks/useReflection.ts` | Rewrite: replace fetch with api() |
| `useDeviceCapability` | `hooks/useDeviceCapability.ts` | **Rewrite entirely**: web version detects WebGL/screen size for 3D backgrounds. Mobile replacement uses `expo-device` + `Dimensions` from RN. Returns `{ isLowEndDevice, screenWidth, screenHeight, pixelRatio }`. No WebGL on mobile — always use 2D backgrounds. Use `Device.modelName`, `Device.totalMemory`, `Dimensions.get('window')`. |
| `useReducedMotion` | `hooks/useReducedMotion.ts` | **Replace with native API**: web version uses `window.matchMedia('prefers-reduced-motion')`. On mobile use `import { useReducedMotion } from 'react-native-reanimated'` (already a dependency). Alternatively use `AccessibilityInfo.isReduceMotionEnabled()` from `react-native`. |

Total: **10 hooks** — all covered. (`useBrowserSupabase` is replaced by direct Supabase import, not ported as a hook.)

---

## Screen Coverage

| Screen | Mobile Path | Web Equivalent |
|--------|-------------|----------------|
| Home | `app/(tabs)/index.tsx` | `app/page.tsx` |
| Record | `app/(tabs)/record.tsx` | `app/record/RecordPageClient.tsx` |
| Social Feed | `app/(tabs)/social.tsx` | `app/social/SocialPageClient.tsx` |
| Library | `app/(tabs)/library.tsx` | `app/library/LibraryPageClient.tsx` |
| Profile | `app/(tabs)/profile.tsx` | `app/profile/ProfilePageClient.tsx` |
| Story Detail | `app/story/[storyId].tsx` | `app/story/[storyId]/StoryPageClient.tsx` |
| Book Detail | `app/book/[bookId].tsx` | `app/books/[bookId]/page.tsx` |
| Daily Tracker | `app/tracker.tsx` | `app/tracker/TrackerPageClient.tsx` |
| Login | `app/auth/login.tsx` | AuthButton + AuthProvider |
| Onboarding | `app/auth/onboarding.tsx` | Onboarding dialog in AuthProvider |
| Settings | `app/settings.tsx` | Profile Settings tab |

Total: **11 screens** — all covered.

---

## Version Compatibility Matrix

| Library | Version | Compatible With |
|---------|---------|----------------|
| Expo SDK | 52 | React 18.3, RN 0.76 |
| NativeWind | 4.x | Tailwind 3.4+ |
| Wagmi | 2.14+ | Viem 2.21+ |
| Viem | 2.21+ | — |
| Reown AppKit | 1.x | Wagmi 2.x |
| @supabase/supabase-js | 2.45+ | — |
| react-native-reanimated | 3.16+ | Expo SDK 52 |
| expo-router | 4.x | Expo SDK 52 |

---

## Quick Reference: Web → Mobile Translation Patterns

### Fetching Data

```typescript
// WEB:
const res = await fetch("/api/ai/transcribe", { method: "POST", body: formData });

// MOBILE:
import { apiUpload } from "@/lib/api";
const res = await apiUpload("/api/ai/transcribe", formData);
```

### Rendering Lists

```typescript
// WEB:
{stories.map((story) => <StoryCard key={story.id} story={story} />)}

// MOBILE:
<FlatList
  data={stories}
  keyExtractor={(item) => item.id.toString()}
  renderItem={({ item }) => <StoryCard story={item} />}
/>
```

### Navigation

```typescript
// WEB:
import { useRouter } from "next/navigation";
router.push(`/story/${id}`);

// MOBILE:
import { useRouter } from "expo-router";
router.push(`/story/${id}`);
```

### Toast Notifications

```typescript
// WEB:
import { toast } from "react-hot-toast";
toast.success("Saved!");
toast.error("Failed!");
toast.loading("Saving...");

// MOBILE:
import Toast from "react-native-toast-message";
Toast.show({ type: "success", text1: "Saved!" });
Toast.show({ type: "error", text1: "Failed!" });
Toast.show({ type: "info", text1: "Saving...", autoHide: false });
```

### Animations

```typescript
// WEB:
import { motion } from "framer-motion";
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />

// MOBILE:
import Animated, { FadeIn } from "react-native-reanimated";
<Animated.View entering={FadeIn} />
```

### Dark Mode

```typescript
// WEB:
import { useTheme } from "next-themes";
const { theme } = useTheme();

// MOBILE:
import { useColorScheme } from "react-native";
const colorScheme = useColorScheme(); // "light" | "dark"
```

### Clipboard

```typescript
// WEB:
navigator.clipboard.writeText(url);

// MOBILE:
import * as Clipboard from "expo-clipboard";
await Clipboard.setStringAsync(url);
```

### Share

```typescript
// WEB:
navigator.share({ title, url });

// MOBILE:
import { Share } from "react-native";
await Share.share({ title, url });
```

---

*This guide was generated for the iStory project. Last updated: February 2026.*
*For questions about the web app architecture, see `docs/CLAUDE.md` and `docs/` in the main repository.*
