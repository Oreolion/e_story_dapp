# Production TODO — Web App

Sorted by priority. Work in `i_story_dapp/` (or the web worktree).

---

## BLOCKERS (Must fix before public launch)

### 1. Domain & DNS Setup
- [x] Follow `docs/CLOUDFLARE_DNS_GUIDE.md` to configure `estories.app`
- [x] Update Vercel project with custom domain
- [x] Update `.env.local` and Vercel env vars:
  ```
  NEXT_PUBLIC_APP_URL=https://estories.app
  NEXT_PUBLIC_SITE_URL=https://estories.app
  ```
- [x] Update Supabase Auth redirect URLs in dashboard
- [x] Update Google OAuth authorized origins + redirect URIs
- [ ] Update Resend sending domain to `estories.app`
- [x] Verify SSL + redirects working

### 2. Privacy Policy & Terms Pages
- [ ] Create `app/privacy/page.tsx` — render privacy policy from `docs/PRIVACY_POLICY.md`
- [ ] Create `app/terms/page.tsx` — render terms of service from `docs/TERMS_OF_SERVICE.md`
- [ ] Fill in `[INSERT DATE]` placeholders with launch date
- [ ] Fill in `[YOUR LEGAL ENTITY NAME]` when entity is formed
- [ ] Fill in `[YOUR STATE/JURISDICTION]` in Terms
- [ ] Add footer links to privacy + terms on all pages
- [ ] Add privacy + terms links on login/signup pages

### 3. Account Deletion Endpoint
- [ ] Create `app/api/user/route.ts` with `DELETE` handler
  - Verify auth with `validateAuthOrReject`
  - Delete user's stories, collections, notifications from Supabase
  - Delete user record
  - Return success (note: on-chain data persists — warn user)
- [ ] Add "Delete Account" to profile settings page
- [ ] Add confirmation modal ("This cannot be undone. On-chain data will persist.")

### 4. Environment Variable Cleanup
- [ ] Audit `.env.example` — ensure ALL required vars are listed with descriptions
- [ ] Remove any hardcoded URLs pointing to `e-story-dapp.vercel.app`
- [ ] Verify no secrets in client-side code (`NEXT_PUBLIC_` prefix only for public vars)

### 5. Fix Resend Lazy Initialization
- [ ] Ensure Resend client uses lazy-init pattern (not module-scope):
  ```typescript
  let _resend: Resend | null = null;
  function getResend() {
    if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
    return _resend;
  }
  ```
- [ ] Verify email sending works with `estories.app` domain

### 6. Run Pending Supabase Migrations
- [ ] Run `005_create_waitlist_table.sql`
- [ ] Run `006_create_verified_metrics_tables.sql`
- [ ] Verify tables exist in Supabase dashboard

---

## HIGH PRIORITY (Before public beta)

### 7. Error Response Audit
- [ ] Grep all API routes for `error.message` in responses — replace with generic messages
- [ ] Pattern: `console.error("[ROUTE] Error:", err);` → `return NextResponse.json({ error: "Internal server error" }, { status: 500 });`
- [ ] Specifically check: `/api/ai/*`, `/api/stories/*`, `/api/book/*`

### 8. CSP Header Tightening
- [ ] Review `next.config.mjs` CSP header
- [ ] Remove any `unsafe-eval` if possible
- [ ] Ensure `script-src` whitelist is minimal
- [ ] Test that all features still work after tightening

### 9. Testnet Disclaimer
- [ ] Add testnet banner on pages with blockchain features (story detail, profile, NFT minting)
- [ ] Text: "Base Sepolia Testnet — No real assets"
- [ ] Style: non-intrusive but visible (amber/yellow badge)

### 10. SEO Finalization
- [ ] Verify `robots.ts` allows crawling of public pages
- [ ] Verify `sitemap.ts` includes all public stories
- [ ] Test OG image generation (`opengraph-image.tsx`)
- [ ] Submit sitemap to Google Search Console after domain setup

### 11. Digital Asset Links (Android Deep Links)
- [ ] Create `app/.well-known/assetlinks.json/route.ts` (see Cloudflare DNS guide)
- [ ] Will need Play Store app signing SHA256 fingerprint (after EAS build)

---

## MEDIUM PRIORITY (Post-launch polish)

### 12. Rate Limiting Review
- [ ] Verify `middleware.ts` rate limits are appropriate for production:
  - AI routes: 10/min
  - Auth routes: 20/min
  - General: 60/min
- [ ] Add rate limiting to any new routes added since last audit

### 13. Monitoring & Logging
- [ ] Consider adding Sentry for error tracking
- [ ] Set up Vercel Analytics (free tier)
- [ ] Monitor Supabase usage dashboard

### 14. Performance Verification
- [ ] Run Lighthouse on all major pages (target 70+ mobile)
- [ ] Verify bundle sizes haven't regressed (target <500 kB per page)
- [ ] Test Core Web Vitals with PageSpeed Insights after domain setup

### 15. Blockradar Payment Integration
- [ ] Research Blockradar API/SDK
- [ ] Create payment API routes (`/api/payment/create`, `/api/payment/webhook`)
- [ ] Integrate with pricing page
- [ ] Handle subscription state (store in Supabase users table)
- [ ] Add payment confirmation UI

### 16. Collections Feature (Web Side)
- [ ] Verify collection API routes exist and work:
  - `GET/POST /api/collections`
  - `GET/PUT/DELETE /api/collections/[id]`
  - `POST/DELETE /api/collections/[id]/stories`
- [ ] Add collections UI to library page (if not already done)
- [ ] Add "Add to Collection" option on story detail page

### 17. PWA Enhancements
- [ ] Verify `manifest.json` has correct start_url, icons, theme_color
- [ ] Test "Add to Home Screen" on Android Chrome
- [ ] Add service worker for offline caching (optional)

---

## Files to Create/Update

### New files needed:
```
app/privacy/page.tsx           # Privacy policy page
app/terms/page.tsx             # Terms of service page
app/api/user/route.ts          # Account deletion endpoint
app/.well-known/assetlinks.json/route.ts  # Android deep links
```

### Files to update when domain changes:
```
.env.local                     # APP_URL, SITE_URL
.env.example                   # Document all vars
next.config.mjs                # CSP headers (if domain-specific)
app/robots.ts                  # sitemap URL
app/sitemap.ts                 # base URL
lib/wagmi.config.ts            # WalletConnect metadata
components/emails/*.tsx         # Email template URLs
```

---

## Deployment Checklist

Before going live on `estories.app`:

- [x] All env vars set in Vercel dashboard
- [x] DNS propagated (verify with `dig estories.app`)
- [x] SSL working (`curl -I https://estories.app`)
- [x] Supabase redirect URLs updated
- [x] Google OAuth redirect URLs updated
- [x] Resend domain verified
- [x] `npm run build` passes
- [x] No merge conflict markers in source
- [x] `package.json` scripts correct (dev=next dev, build=next build)
- [x] Privacy policy accessible at `/privacy`
- [x] Terms accessible at `/terms`
- [x] Testnet disclaimer visible on blockchain pages
- [x] Account deletion working
- [x] Email sending works from new domain
