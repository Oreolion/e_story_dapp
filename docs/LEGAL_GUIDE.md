# Legal Guide for First-Time Founders — eStories

A practical guide for launching eStories legally as a solo/first-time founder.
Last updated: 2026-03-23

---

## Table of Contents

1. [Legal Entity](#1-legal-entity)
2. [Privacy Policy](#2-privacy-policy)
3. [Terms of Service](#3-terms-of-service)
4. [Crypto/Web3 Compliance](#4-cryptoweb3-compliance)
5. [App Store Compliance](#5-app-store-compliance)
6. [Data Protection (GDPR/CCPA)](#6-data-protection)
7. [AI Disclosure](#7-ai-disclosure)
8. [Timeline & Budget](#8-timeline--budget)
9. [When to Hire a Lawyer](#9-when-to-hire-a-lawyer)

---

## 1. Legal Entity

### Do I need one before launch?

**For testnet**: No. You can launch on testnet as a personal project. No real money is changing hands.

**Before mainnet with payments**: Yes. You need a legal entity to:
- Open a business bank account for Blockradar payouts
- Sign terms with payment processors, app stores, and API providers
- Limit your personal liability
- Issue invoices and handle taxes

### Recommended structure

| Option | Cost | Best For |
|--------|------|----------|
| **US LLC** (Wyoming or Delaware) | $100-500 filing + $50-300/yr | Solo founders, crypto-friendly, low maintenance |
| **UK LTD** | ~£12 filing | Non-US founders, EU-adjacent |
| **Cayman/BVI** | $1,500-5,000 | Heavy crypto treasuries (overkill for now) |

**Recommendation**: Wyoming LLC. Crypto-friendly state, no state income tax, single-member LLC is pass-through for US tax. Can be formed online in 1-2 days via:
- Wyoming Secretary of State (cheapest)
- Stripe Atlas ($500 — gives you LLC + EIN + bank account + tax guidance)
- Firstbase.io, Doola, or similar services

### Action items

- [ ] Choose entity type and jurisdiction
- [ ] Register entity (before accepting real payments)
- [ ] Get EIN (US) or equivalent tax ID
- [ ] Open business bank account
- [ ] Register with Blockradar under business entity

---

## 2. Privacy Policy

### Why you need it

- **Google Play Store**: Required for all apps
- **Apple App Store**: Required for all apps
- **Google OAuth**: Required to use Google Sign-In
- **GDPR/CCPA**: Legal requirement if you have EU/California users
- **Supabase**: Their ToS requires you to have one

### What it must cover

For eStories specifically, your privacy policy MUST address:

1. **Data collected**: Account info (name, email, wallet address), story content, audio recordings, AI-generated analysis, on-chain transaction data
2. **AI processing**: That stories are sent to Google Gemini and ElevenLabs for transcription/analysis — and what those providers do with data
3. **Blockchain data**: That some data (hashes, metrics tiers) is written to a public blockchain and **cannot be deleted**
4. **Encryption**: That private stories are encrypted client-side (AES-256-GCM) and you literally cannot read them
5. **Third-party services**: Supabase, Google (OAuth + Gemini), ElevenLabs, Pinata/IPFS, Chainlink, Base/Ethereum
6. **Data retention**: How long you keep data, what happens on account deletion
7. **Children**: State that the service is not for children under 13 (COPPA)
8. **Contact**: A real email address for privacy inquiries

### Template

See: [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) — a template you can customize and host at `estories.app/privacy`

---

## 3. Terms of Service

### What it must cover

1. **Account responsibility**: Users are responsible for their credentials and wallet security
2. **Content ownership**: Users own their stories. You get a license to display/process them
3. **AI-generated content**: Disclaimers that AI analysis is for informational purposes, not professional advice
4. **Blockchain immutability**: Once minted/written on-chain, it cannot be reversed
5. **Payments & refunds**: Subscription terms, refund policy, crypto payment finality
6. **Prohibited content**: Hate speech, illegal content, harassment
7. **Termination**: You can terminate accounts for ToS violations
8. **Limitation of liability**: Standard liability caps
9. **Dispute resolution**: Arbitration vs courts, governing law
10. **Age requirement**: 13+ (or 16+ for EU)

### Template

See: [`TERMS_OF_SERVICE.md`](./TERMS_OF_SERVICE.md) — a template you can customize and host at `estories.app/terms`

---

## 4. Crypto/Web3 Compliance

### Testnet phase (current)

- No real money = minimal regulatory concern
- Still add a disclaimer: "This is a testnet deployment. No real assets are involved."
- Do NOT market testnet tokens as having value

### Mainnet considerations

| Topic | Risk Level | Action |
|-------|-----------|--------|
| **$STORY token** | HIGH | If tradeable, may be a security. Consider utility-only design |
| **NFT minting** | MEDIUM | Generally OK as digital collectibles. Don't promise financial returns |
| **Tips/payments** | MEDIUM | Money transmission laws vary by jurisdiction |
| **Paywall** | LOW | Standard digital content sales |

### Key rules

1. **Never promise financial returns** from tokens or NFTs
2. **$STORY token**: If it's purely utility (pay for features, tip creators) and not marketed as an investment, lower risk. If tradeable on DEXs, consult a crypto lawyer
3. **Money transmission**: Facilitating payments between users (tips) may require money transmitter licensing in some US states. Blockradar may handle this as the payment processor — verify with them
4. **KYC/AML**: If handling significant crypto payments, you may need KYC. Blockradar likely handles this for their payment flow
5. **Securities**: The Howey Test — if users buy tokens expecting profit from your efforts, it's likely a security. Design tokens as pure utility

### Recommended approach

1. **Testnet**: Launch freely, gather users, iterate
2. **Pre-mainnet**: Consult a crypto-specialized lawyer ($500-2,000 for initial consultation)
3. **Mainnet**: Have legal opinion letter on token classification before launch

---

## 5. App Store Compliance

### Google Play (Android first)

| Requirement | Status | Action |
|-------------|--------|--------|
| Privacy policy URL | Needed | Host at `estories.app/privacy` |
| Data safety form | Needed | Fill out in Play Console |
| Content rating | Needed | Complete IARC questionnaire |
| Target audience | Needed | Select 13+ or "Not designed for children" |
| App signing | Needed | Use Play App Signing (recommended) |
| Store listing | Needed | Screenshots, description, feature graphic |
| Crypto disclosure | Needed | If blockchain features are prominent, disclose in description |

### Google Play crypto policy

Google Play allows crypto apps but requires:
- Clear disclosure of blockchain functionality
- No misleading claims about earnings
- Compliance with local financial regulations
- NFT apps: allowed as of 2023, but must follow their NFT policy

### Apple App Store (later)

Apple is stricter on crypto:
- NFT viewing: OK
- NFT purchasing: Must use in-app purchase (30% cut) OR link to external purchase
- Crypto wallets: Allowed but scrutinized
- Token sales: Generally not allowed through the app

**Strategy**: Launch Android first. For iOS, consider a "lite" version that shows stories but links to web for crypto features.

---

## 6. Data Protection

### GDPR (EU users)

If you have any EU users, you must:

1. **Legal basis for processing**: Consent (for optional features) or Legitimate Interest (for core service)
2. **Right to deletion**: Users can request all their data be deleted
3. **Right to export**: Users can request a copy of their data
4. **Data Processing Agreement**: With Supabase, Google Cloud, etc. (they all offer standard DPAs)
5. **Cookie consent**: If you use analytics cookies (you probably should skip cookies for now)
6. **Blockchain exception**: On-chain data cannot be deleted — disclose this clearly before users write to chain

### CCPA (California users)

Similar to GDPR but:
- "Do Not Sell My Personal Information" link required if you share data with third parties for monetary consideration
- Since you're not selling data, less of a concern
- Still need privacy policy disclosures

### Practical approach for testnet

1. Add privacy policy and terms to app/website
2. Add account deletion endpoint (required by both app stores and GDPR)
3. Add data export endpoint (nice to have, required for GDPR)
4. Clearly disclose what's on-chain (immutable) vs off-chain (deletable)

---

## 7. AI Disclosure

### Why it matters

Regulations are emerging worldwide requiring disclosure of AI-generated content:

1. **EU AI Act**: Requires disclosure when content is AI-generated
2. **FTC (US)**: Increasingly scrutinizing undisclosed AI use
3. **User trust**: Transparency builds trust

### What to disclose in eStories

- AI transcription (ElevenLabs) converts voice to text
- AI enhancement (Gemini) can improve/rewrite story text
- AI analysis provides craft feedback (coherence, themes, depth scores)
- Chainlink CRE verifies AI analysis results
- AI-enhanced text is labeled as such in the UI (you already do this)

### Where to disclose

1. **Terms of Service**: Section on AI features
2. **In-app**: Labels on AI-enhanced content (already implemented)
3. **Privacy Policy**: Which AI providers process user data
4. **Onboarding**: Brief mention during setup

---

## 8. Timeline & Budget

### Testnet launch (now — free/low cost)

| Item | Cost | Timeline |
|------|------|----------|
| Privacy policy (template) | $0 | 1 day to customize |
| Terms of service (template) | $0 | 1 day to customize |
| Google Play developer account | $25 (one-time) | 1-2 days approval |
| Domain (estories.app) | Already bought | Already done |
| SSL certificate | $0 (Cloudflare) | Automatic |

### Pre-mainnet (before real money)

| Item | Cost | Timeline |
|------|------|----------|
| Wyoming LLC | $100-500 | 1-2 weeks |
| EIN | $0 | 1-4 weeks (IRS) |
| Business bank account | $0 | 1 week |
| Crypto lawyer consultation | $500-2,000 | 1 session |
| Professional privacy policy review | $300-800 | 1 week |

### Total pre-mainnet: ~$1,000-3,500

---

## 9. When to Hire a Lawyer

### You DON'T need a lawyer for

- Testnet launch
- Using template legal docs (privacy policy, ToS)
- Filing an LLC
- Google Play submission
- Basic GDPR compliance

### You DO need a lawyer for

- **Before mainnet with real $STORY tokens**: Token classification opinion letter
- **If you raise funding**: Investment docs, SAFTs, equity agreements
- **If you get a legal threat**: DMCA takedown, cease and desist, user lawsuit
- **Before accepting US payments**: Money transmission analysis
- **If storing sensitive data**: Healthcare, financial, or minor's data

### Where to find affordable crypto lawyers

1. **LegalZoom / Rocket Lawyer**: Template docs and basic filings ($30-100/mo)
2. **Crypto-specialized firms**: Anderson Kill, Fenwick & West, or smaller boutiques
3. **Startup legal clinics**: Many law schools offer free startup legal clinics
4. **Crypto Twitter/Discord**: Ask in builder communities for recommendations
5. **Stripe Atlas**: Includes legal template pack with your LLC

---

## Quick Reference Checklist

### Before testnet launch
- [x] Domain registered (estories.app)
- [ ] Privacy policy published at `estories.app/privacy`
- [ ] Terms of service published at `estories.app/terms`
- [ ] Google Play developer account created ($25)
- [ ] App data safety form completed
- [ ] Account deletion flow implemented
- [ ] AI usage disclosed in ToS and privacy policy
- [ ] "Testnet — no real assets" disclaimer added

### Before mainnet launch
- [ ] Legal entity formed (LLC recommended)
- [ ] Business bank account opened
- [ ] Crypto lawyer consulted on token classification
- [ ] KYC/AML requirements clarified with Blockradar
- [ ] Professional legal review of privacy policy and ToS
- [ ] GDPR data export and deletion endpoints implemented
- [ ] Money transmission analysis completed (if facilitating tips)
- [ ] Apple App Store submission (if targeting iOS)

---

*This guide is for educational purposes and does not constitute legal advice. Consult a qualified attorney for your specific situation.*
