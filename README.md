# eStories: AI-Powered Sovereign Storytelling Platform

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-cyan?logo=tailwind-css)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-DB-orange?logo=supabase)
![Wagmi](https://img.shields.io/badge/Wagmi-2.17-green?logo=ethereum)
![Base](https://img.shields.io/badge/Base-L2-blue?logo=base)
![Chainlink CRE](https://img.shields.io/badge/Chainlink-CRE-blue?logo=chainlink)
![Vitest](https://img.shields.io/badge/Vitest-4-green?logo=vitest)
![Playwright](https://img.shields.io/badge/Playwright-E2E-orange?logo=playwright)

**Live:** [estories.app](https://www.estories.app)

## Overview

eStories is a privacy-preserving, AI-powered Web3 storytelling platform that transforms narratives into structured, permanent, and verifiable memory infrastructure. Built on Base (Ethereum L2), it combines voice capture, AI transcription, client-side encryption, blockchain permanence, and Chainlink CRE-verified cognitive analysis.

Users write about anything they're passionate about -- personal journals, historical narratives, geopolitical analysis, cultural stories, creative non-fiction -- with AI-powered craft feedback that helps them become better storytellers over time. Every story is encrypted on-device, and verification is provable without trusting the platform.

### The Three Crises eStories Solves

1. **The Ancient Crisis -- Memory Extinction.** Human experience vanishes. Oral traditions die with their keepers. Cultural narratives disappear with communities. eStories captures voice -> AI transcription -> encrypted storage -> optional on-chain permanence.

2. **The Present Crisis -- The Unexamined Life at Scale.** We are living through a civilizational inflection point comparable to the Renaissance and Industrial Revolution. Writing declutters the mind and sharpens thinking, but current platforms harvest intimate data. eStories provides sovereign storytelling with client-side encryption (AES-256-GCM) and Chainlink CRE for verifiable analysis.

3. **The Emerging Crisis -- The Meaning Void.** As AI automates work, millions lose identity and purpose. Storytelling fills that void -- and eStories's AI feedback helps users improve as writers. In a world flooded with AI-generated content, authenticity must be provable. On-chain cryptographic proofs create tamper-proof provenance.

**1-line pitch:** Privacy-preserving AI-powered sovereign storytelling platform with verifiable metrics via Chainlink CRE on Base L2.

## Key Features

### Core Functionality

- **Voice-to-Text Storytelling**: Record stories with browser audio capture + AI transcription (ElevenLabs Scribe) -- or type directly
- **Write About Anything**: Personal journals, history, geopolitics, culture, creative non-fiction, memoirs
- **AI Enhancement**: Grammar polishing, creative prompts, and AI suggestions (Google Gemini 2.5 Flash)
- **Storytelling Craft Feedback**: AI analyzes narrative coherence, emotional depth, thematic quality -- improving with every story
- **Story Collections**: Group stories into series with continuations -- curate chapters of your life
- **Blockchain Immortality**: Mint stories as NFTs on Base (Ethereum L2) with IPFS storage via Pinata

### Privacy & Encryption (Local Vault)

- **Client-Side Encryption**: AES-256-GCM encryption at rest in IndexedDB via Web Crypto API
- **PIN-Protected Vault**: PIN -> PBKDF2 (100K iterations) -> KEK -> AES-KW wraps DEK
- **Zero-Knowledge Design**: DEK held in-memory only while unlocked; cleared on sign-out
- **Offline Capable**: Stories exist locally even without internet
- **Dual-Write Architecture**: Cloud save first (authoritative), vault save additive (non-blocking)

### Chainlink CRE Integration (Verified AI Analysis)

- **Verifiable AI Metrics**: Story analysis runs inside Chainlink DON enclaves via ConfidentialHTTPClient
- **Privacy-Preserving Proofs**: On-chain stores only quality tier, threshold boolean, and keccak256 hashes
- **Full Metrics Author-Only**: Complete scores, themes, and analysis stored in Supabase (visible only to the author)
- **Dual-Write Pipeline**: DON consensus -> KeystoneForwarder (on-chain proofs) + HTTP callback (Supabase full metrics)
- **PrivateVerifiedMetrics Contract**: `0x158e08BCD918070C1703E8b84a6E2524D2AE5e4c` (Base Sepolia)

### Cognitive Layer (AI Analysis)

- **Automatic Story Analysis**: Themes, emotions, life domains extracted from every story
- **Emotional Insights**: AI-detected emotional tone (hopeful, reflective, joyful, etc.)
- **Entity Extraction**: People, places, and time references identified automatically
- **Significance Scoring**: AI evaluates intensity and significance of each story
- **Actionable Craft Advice**: Specific feedback on how to improve each story
- **Weekly Reflections**: AI-generated summaries of writing patterns and growth
- **Pattern Discovery**: Theme tracking, domain grouping, and canonical story curation across your archive

### Authentication & Security

- **Dual Auth**: Google OAuth or Web3 wallet -- both work independently
- **Custom Wallet JWT**: Wallet users get custom JWT (jose, HS256, 7-day expiry) stored in localStorage
- **Google OAuth**: Standard Supabase auth session with implicit flow
- **Account Linking**: Link Google and wallet for unified access (nav dropdown)
- **Nav Dropdown Wallet Status**: Always shows wallet state -- green check with address (linked) or "Connect Wallet" button
- **Nonce-Based Signing**: Server-generated UUID nonces with 5-minute expiry prevent replay attacks
- **Bearer Token Auth**: All API routes protected via `lib/auth.ts` (tries Supabase token first, then wallet JWT)
- **Rate Limiting**: Route-specific (AI: 10/min, Auth: 20/min, CRE Callback: 5/min, Default: 60/min)
- **Security Headers**: CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, HSTS
- **Onboarding Flow**: Multi-step onboarding for all new users (username, optional vault setup, optional wallet)

### Social Features

- **Community Feed**: Discover and engage with public stories
- **Like System**: Social appreciation (no token rewards -- purely social)
- **Tip System**: Support creators with direct payments
- **Comment System**: Build discussions on stories
- **Follow System**: Build your storytelling community

### Monetization

- **USDC Subscriptions**: Monthly plans via Blockradar ($2.99 Storyteller / $7.99 Creator)
- **Paywall System**: Set custom prices for exclusive stories
- **Tip Jar**: Accept voluntary tips from supporters
- **NFT Minting**: Compile stories into digital books and mint as NFTs
- **$STORY Token**: ERC20 token (testnet only -- mainnet at 100+ users)

### Library & Curation

- **Personal Library**: All stories with month-by-month archive grouping
- **Story Collections**: Create curated series with add/remove stories
- **Story Continuations**: Continue an existing story as a new entry
- **Themes & Domains**: AI-powered grouping by theme and life domain
- **Canonical Stories**: Mark key moments for special curation
- **Book Compilation**: Combine stories into digital books

### User Profiles

- **Profile Customization**: Name, bio, avatar, location, website
- **Contribution Heatmap**: GitHub-style activity visualization (365 days)
- **Writing Streaks & Achievements**: Track consistency and earn badges
- **Statistics Dashboard**: Stories, likes, followers, impact metrics
- **Vault Settings**: Setup, unlock, lock, change PIN from profile
- **Linked Accounts**: See and manage Google + wallet connections

## How It Works

### Step 1: Record or Write

Use AI Speech-to-Text to record by voice, or type directly. Write about whatever moves you -- reflections, history, culture, geopolitics, creative non-fiction.

### Step 2: Enhance & Analyze

AI polishes grammar and style. Automatic cognitive analysis extracts themes, emotions, and provides craft feedback. Optionally trigger CRE verification for on-chain proof.

### Step 3: Encrypt & Store

Stories are encrypted on-device (AES-256-GCM) in the local vault. Cloud backup is separate and authoritative. Your PIN never leaves the device.

### Step 4: Share & Earn

Publish stories to the community feed. Earn from tips and paywall sales. Build your audience as a creator.

## Tech Stack

### Frontend
- **Framework**: Next.js 15.5.9 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4 with dark/light mode
- **Animations**: Framer Motion
- **UI Components**: shadcn/ui + Radix primitives
- **Icons**: Lucide React

### Blockchain & Web3
- **Wallet Integration**: Wagmi 2.17 + RainbowKit 2.2
- **Smart Contracts**: Solidity on Base (Ethereum L2) via Hardhat
- **Contract Interaction**: Viem 2.38
- **Verification**: Chainlink CRE (Compute Runtime Environment)

### Backend & Database
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **API**: Next.js API Routes (serverless)
- **IPFS**: Pinata for decentralized file storage
- **Email**: Resend (transactional emails, domain-verified)
- **Payments**: Blockradar (USDC subscriptions on Base)

### AI Services
- **Speech-to-Text**: ElevenLabs Scribe
- **Text Enhancement + Analysis**: Google Gemini 2.5 Flash
- **Thinking Agent**: Claude SDK (complex reasoning tasks)
- **CRE AI**: Gemini via Chainlink ConfidentialHTTPClient (encrypted DON enclave)

### Client-Side Security
- **Encryption**: Web Crypto API (AES-256-GCM, PBKDF2, AES-KW)
- **Local Storage**: Dexie.js (IndexedDB with reactive queries via useLiveQuery)
- **Key Management**: PIN -> KEK -> DEK architecture, in-memory only while unlocked

### Testing
- **Unit**: Vitest + React Testing Library (96+ tests)
- **E2E**: Playwright (Chrome, Firefox, Safari)
- **Vault**: 27 dedicated encryption/key lifecycle tests

### Deployment
- **Hosting**: Vercel
- **Domain**: estories.app (Cloudflare DNS, HSTS enabled)
- **Contracts**: Base Sepolia (testnet)

## Architecture


### Smart Contracts (Base Sepolia)

| Contract | Address | Purpose |
|----------|---------|---------|
| eStoryToken | `0xf9eDD76B...` | ERC20 $STORY token, MAX_SUPPLY 100M |
| StoryProtocol | `0xA51a4cA0...` | Tips & paywall payments |
| StoryNFT | `0x6D37ebc5...` | ERC721 story books, mintFee 0.001 ETH |
| PrivateVerifiedMetrics | `0x158e08BC...` | Privacy-preserving CRE metrics |
| VerifiedMetrics (legacy) | `0x052B52A4...` | Old CRE contract (backward compat) |

## Project Structure

```
i_story_dapp/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (all require Bearer token auth)
│   │   ├── admin/                # Admin endpoints (ADMIN_SECRET, timing-safe)
│   │   ├── ai/                   # AI endpoints (analyze, enhance, transcribe, reflection)
│   │   ├── auth/                 # Auth (callback, login, nonce, onboarding, link-*)
│   │   ├── book/                 # Book compilation
│   │   ├── cre/                  # Chainlink CRE (trigger, callback, check)
│   │   ├── journal/              # Story saving (triggers AI analysis)
│   │   ├── notifications/        # Notification CRUD
│   │   ├── paywall/              # Paywall payments
│   │   ├── social/               # Like, follow
│   │   ├── stories/collections/  # Story collections CRUD
│   │   ├── sync/                 # Blockchain tx verification
│   │   ├── tip/                  # Tipping
│   │   ├── user/                 # User profile
│   │   └── waitlist/             # Waitlist signup
│   ├── hooks/                    # React hooks
│   │   ├── useVault.ts           # Vault lifecycle (setup/unlock/lock/changePin)
│   │   ├── useLocalStories.ts    # Encrypted CRUD via IndexedDB (reactive)
│   │   ├── useVerifiedMetrics.ts # CRE metrics + proof polling
│   │   ├── usePatterns.ts        # Theme/domain grouping
│   │   ├── useReflection.ts      # Weekly AI reflections
│   │   ├── useEStoryToken.ts     # Token contract interactions
│   │   ├── useStoryProtocol.ts   # Tips/paywall contract
│   │   ├── useStoryNFT.ts        # NFT minting
│   │   └── useNotifications.ts   # Notification system
│   ├── types/                    # TypeScript definitions
│   ├── utils/                    # Supabase clients, services
│   └── [pages]/                  # Each: server page.tsx + *PageClient.tsx
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── vault/                    # VaultGuard, PinEntryModal, VaultSettings
│   ├── emails/                   # Email templates (Welcome, Waitlist)
│   ├── patterns/                 # ThemesView, DomainsView, MonthlySummary
│   ├── AuthProvider.tsx          # Auth context (dual auth, token management)
│   ├── AuthButton.tsx            # Nav auth button with wallet status dropdown
│   ├── AuthModal.tsx             # Sign-in modal (Google + Wallet)
│   ├── Navigation.tsx            # Top nav bar
│   ├── StoryCard.tsx             # Story card component
│   ├── VerifiedBadge.tsx         # CRE verification badge
│   └── VerifiedMetricsCard.tsx   # CRE metrics display
├── contracts/                    # Solidity smart contracts
│   ├── eStoriesToken.sol         # ERC20 $STORY token
│   ├── StoryProtocol.sol         # Tips & paywall
│   ├── StoryNFT.sol              # ERC721 book NFTs
│   ├── PrivateVerifiedMetrics.sol # Privacy-preserving CRE receiver
│   ├── legacy/                   # Old contracts (backward compat)
│   └── interfaces/               # IERC165, IReceiver, ReceiverTemplate
├── cre/                          # Chainlink CRE workflows
│   └── iStory_workflow/          # main.ts, gemini.ts, httpCallback.ts
├── lib/
│   ├── auth.ts                   # Shared auth middleware
│   ├── jwt.ts                    # Custom wallet JWT (jose, HS256)
│   ├── crypto.ts                 # Timing-safe comparison
│   ├── contracts.ts              # Contract addresses & ABIs
│   └── vault/                    # Client-side encryption
│       ├── crypto.ts             # AES-256-GCM + PBKDF2 + AES-KW
│       ├── db.ts                 # Dexie.js IndexedDB schema
│       ├── keyManager.ts         # DEK lifecycle
│       └── index.ts              # Barrel export
├── middleware.ts                 # API rate limiting
├── __tests__/                    # Unit tests (Vitest, 96+ tests)
├── e2e/                          # E2E tests (Playwright)
├── scripts/                      # Deployment & utility scripts
├── docs/                         # Detailed reference docs
└── supabase/migrations/          # Database migrations
```

## API Endpoints

All API routes require Bearer token authentication unless noted. Rate limits apply globally via `middleware.ts`.

### AI Endpoints (Auth Required)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ai/transcribe` | Convert audio to text (max 25MB) |
| POST | `/api/ai/enhance` | Enhance story text with AI (max 50K chars) |
| POST | `/api/ai/analyze` | Extract cognitive metadata (verifies ownership) |
| GET/POST | `/api/ai/reflection` | Weekly AI reflection (1 per week limit) |

### Chainlink CRE Endpoints (Auth Required)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/cre/trigger` | Trigger CRE verification for a story |
| POST | `/api/cre/callback` | DON callback receiver (secret-authenticated) |
| GET | `/api/cre/check` | Read metrics (author: full, public: proof only) |

### Auth Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/auth/nonce` | Generate nonce for wallet signing (no auth) |
| POST | `/api/auth/login` | Wallet auth (verifies nonce + signature) |
| GET | `/api/auth/callback` | OAuth callback (redirect whitelist) |
| POST | `/api/auth/onboarding` | Complete new user onboarding |
| POST | `/api/auth/initiate-link` | Start account linking (HMAC token) |
| POST | `/api/auth/link-account` | Link wallet to Google account |
| POST | `/api/auth/link-google` | Link Google to wallet account |

### Story & Social Endpoints (Auth Required)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/journal/save` | Save story (triggers AI analysis) |
| GET/POST/DELETE | `/api/stories/collections` | Story collections CRUD |
| POST | `/api/social/like` | Like/unlike (atomic toggle) |
| POST | `/api/social/follow` | Follow/unfollow user |
| POST | `/api/tip` | Send tip to creator |
| POST | `/api/paywall` | Unlock paywalled content |

### User & Notification Endpoints (Auth Required)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/PUT | `/api/user/profile` | Fetch/update user profile |
| GET/POST/PUT/DELETE | `/api/notifications` | Notification CRUD |
| GET/POST/PUT/DELETE | `/api/habits` | Habit tracking |

### Infrastructure Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ipfs/upload` | Upload to IPFS (max 50MB, MIME whitelist) |
| POST | `/api/email/send` | Send email via Resend |
| POST | `/api/waitlist` | Join waitlist (mobile app) |
| GET | `/api/admin/analysis-stats` | Admin stats (ADMIN_SECRET) |

## Getting Started

### Prerequisites

- Node.js 18+ with npm
- Supabase account with project setup
- Web3 wallet (MetaMask or compatible) for blockchain features
- Base Sepolia testnet access for development
- Google Gemini API key
- ElevenLabs API key

### Installation

```bash
git clone <repo-url>
cd i_story_dapp
npm install
```

Create `.env.local` from `.env.example`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Services
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
ELEVENLABS_API_KEY=your_elevenlabs_key

# Web3
NEXT_PUBLIC_PROJECT_ID=your_walletconnect_project_id

# Smart Contracts (Base Sepolia)
NEXT_PUBLIC_ESTORY_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_STORY_PROTOCOL_ADDRESS=0x...
NEXT_PUBLIC_STORY_NFT_ADDRESS=0x...

# Email & Payments
RESEND_API_KEY=your_resend_key
BLOCKRADAR_API_KEY=your_blockradar_key

# Security
CRON_SECRET=your_cron_secret
JWT_SECRET=your_jwt_secret
```

### Development

```bash
npm run dev          # Start Next.js dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npx vitest run       # Unit tests
npx playwright test  # E2E tests
```

### Smart Contract Deployment

```bash
npx hardhat compile
npx hardhat run scripts/deploy.ts --network baseSepolia
npx hardhat run scripts/verify-deployment.ts --network baseSepolia
```

### CRE Workflow (from cre/ directory)

```bash
cre workflow simulate iStory_workflow              # Local test
cre workflow simulate iStory_workflow --broadcast  # Test with on-chain write
cre workflow deploy iStory_workflow                # Deploy (early access)
```

## Monetization Architecture

Two independent payment systems:

| System | Currency | Status | Purpose |
|--------|----------|--------|---------|
| Subscriptions | USDC via Blockradar | Live (mainnet) | Monthly plans ($2.99/$7.99) |
| Token Economy | $STORY (ERC-20) | Testnet (UI disabled) | Tips, paywalls, NFT minting |

Subscriptions process real USDC on Base. Token features are visible but disabled ("Coming soon") until 100+ users and 4+ weeks of stable subscriptions.

## Security

### Security Architecture

eStories implements a comprehensive, layered security model addressing 34 audit findings.

**API Security:**
- Bearer Token Auth on all API routes via shared `lib/auth.ts`
- Ownership verification: users can only modify their own resources
- Rate limiting: route-specific limits in middleware
- Input validation: file size, MIME type, text length limits
- Error sanitization: no internal details leaked to clients

**Authentication Security:**
- Nonce-based wallet signing: UUID nonces with 5-minute expiry
- HMAC-signed linking tokens for account linking
- OAuth redirect whitelisting
- Timing-safe secret comparison (constant-time)
- Custom wallet JWT with expiry validation

**Client-Side Security:**
- AES-256-GCM encryption at rest (Web Crypto API)
- PBKDF2 key derivation (100K iterations)
- DEK in-memory only while unlocked
- `clearAllKeys()` on sign-out

**Infrastructure Security:**
- CSP, X-Frame-Options DENY, HSTS, nosniff headers
- Supabase RLS policies
- OpenZeppelin AccessControl on all contracts

### Smart Contract Security

| Contract | Security Features |
|----------|-------------------|
| eStoryToken | MAX_SUPPLY 100M, Pausable, AccessControl (MINTER/PAUSER roles) |
| StoryProtocol | Pausable, AccessControl |
| StoryNFT | Mint fee (0.001 ETH), AccessControl, ERC2981 royalties |
| PrivateVerifiedMetrics | KeystoneForwarder-only write access, minimal on-chain data |

### Reporting Vulnerabilities

Found a security issue? Report privately:
- Email: remyoreo11@gmail.com
- Do not disclose publicly until a patch is available

## Deployment

- **Frontend**: Vercel (production at estories.app)
- **Domain**: Cloudflare DNS with HSTS
- **Email**: Resend (domain-verified estories.app)
- **Payments**: Blockradar (Base mainnet USDC)
- **Contracts**: Base Sepolia (testnet)

## Roadmap

### Completed
- Phase 1: Story metadata + AI analysis
- Phase 1.5: 96+ tests, 34 security findings fixed
- Phase 1.6: Chainlink CRE integration (verified simulation)
- Phase 1.6.1: Privacy-preserving CRE rewrite
- Phase 2.0: Auth overhaul (custom wallet JWT, no fake emails)
- Phase 2.2: Local Vault (AES-256-GCM encrypted IndexedDB)
- Phase 2.4: Record page UX, archive grouping, performance audit
- Phase 2.6: Story collections, pricing page, auth hardening
- Phase 2.7: Blockradar USDC subscriptions, Cloudflare domain
- Phase 2.8: Monetization cleanup (likes social-only)
- Phase 2.9: Nav dropdown wallet status, OAuth redirect fixes

### Next Up
- PKCE OAuth migration (implicit -> PKCE for security hardening)
- Error response audit + CSP tightening
- Vault -> Cloud sync (encrypted upload to Supabase storage)
- Topic-driven story discovery (History, Culture, Geopolitics categories)
- Storytelling progression tracking (quality improvement over time)

### Future
- Mobile app (React Native + Expo -- scaffolding complete)
- Graph-based memory (theme relationships)
- Memory API for external AI agents
- Multi-language support with AI translation
- $STORY token mainnet deployment (at 100+ users)
- Cross-chain support (Optimism, Arbitrum)

## Use Cases

- **Personal Journals**: Daily voice journaling with AI transcription
- **Historical Writing**: Essays on events, eras, and figures with tamper-proof provenance
- **Geopolitical Analysis**: Commentary on world events and international relations
- **Cultural Storytelling**: Preserving oral histories, traditions, and indigenous knowledge
- **Creative Non-Fiction**: Memoirs, essays, travel writing, longform storytelling
- **Craft Development**: Improving writing skills through AI feedback on coherence, depth, and quality
- **Book Compilation**: Curate stories into published collections and NFTs
- **Mind Decluttering**: Self-reflection, theme discovery, and pattern tracking

## Team & Contact

**Project Lead:** Remi Adedeji
- Twitter: @remyOreo_
- Email: remyoreo11@gmail.com

**Support:** support@estories.app

---

*Preserve your truth. Master your craft. Mint your legacy. Made with love by the eStories Team.*
