# Cloudflare DNS Configuration Guide — estories.app

Step-by-step guide to configure `estories.app` on Cloudflare pointing to Vercel (web app) and setting up email, security, and mobile deep links.

---

## 1. Prerequisites

- [x] Domain `estories.app` purchased on Cloudflare
- [ ] Vercel project deployed (currently at `e-story-dapp.vercel.app`)
- [ ] Access to Cloudflare dashboard

---

## 2. Add Domain to Vercel

### Step 2.1: Add custom domain in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `i_story_dapp` project
3. Go to **Settings** → **Domains**
4. Click **Add Domain**
5. Enter: `estories.app`
6. Also add: `www.estories.app`
7. Vercel will show you DNS records to configure

Vercel will give you something like:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

---

## 3. Configure DNS Records in Cloudflare

### Step 3.1: Go to Cloudflare DNS settings

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select `estories.app`
3. Go to **DNS** → **Records**

### Step 3.2: Add required records

Add these DNS records:

#### Root domain (estories.app)
| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| **A** | `@` | `76.76.21.21` | DNS only (grey cloud) | Auto |

#### WWW subdomain
| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| **CNAME** | `www` | `cname.vercel-dns.com` | DNS only (grey cloud) | Auto |

> **IMPORTANT**: Set proxy status to **DNS only** (grey cloud icon), NOT **Proxied** (orange cloud). Vercel manages its own SSL and CDN. Double-proxying through Cloudflare causes SSL handshake issues and redirect loops.

### Step 3.3: Verify in Vercel

1. Go back to Vercel → Settings → Domains
2. Both `estories.app` and `www.estories.app` should show green checkmarks
3. Vercel auto-provisions SSL certificates (Let's Encrypt)
4. Configure redirect: `www.estories.app` → `estories.app` (or vice versa)

---

## 4. SSL/TLS Configuration

### Cloudflare SSL settings

Since we're using DNS-only mode (grey cloud):

1. Go to **SSL/TLS** → **Overview**
2. Set mode to **Full (strict)** — this ensures Cloudflare doesn't interfere
3. Actually, since proxy is off, SSL is handled entirely by Vercel — no Cloudflare SSL config needed

### If you later want Cloudflare proxy (orange cloud)

Only do this if you need Cloudflare WAF, DDoS protection, or caching:

1. Set SSL mode to **Full (strict)**
2. Go to **SSL/TLS** → **Edge Certificates** → Enable **Always Use HTTPS**
3. Go to **Rules** → **Page Rules** → Add rule:
   - URL: `*estories.app/*`
   - Setting: SSL = Full (strict)
4. Test thoroughly — Vercel + Cloudflare proxy can cause redirect loops if misconfigured

**Recommendation**: Start with DNS-only. Add proxy later only if needed.

---

## 5. Email Configuration

You'll need email for `privacy@estories.app`, `legal@estories.app`, etc.

### Option A: Cloudflare Email Routing (free, recommended)

1. Go to **Email** → **Email Routing**
2. Enable Email Routing
3. Add destination: your personal email (e.g., `you@gmail.com`)
4. Add routing rules:

| Match | Forward to |
|-------|-----------|
| `privacy@estories.app` | `you@gmail.com` |
| `legal@estories.app` | `you@gmail.com` |
| `support@estories.app` | `you@gmail.com` |
| `*@estories.app` (catch-all) | `you@gmail.com` |

5. Cloudflare automatically adds required MX records

### Option B: Google Workspace ($6/mo)

If you want to send FROM `@estories.app`:
1. Sign up for Google Workspace
2. Add MX records they provide
3. Full send/receive from `@estories.app`

### Resend (for transactional emails)

You already use Resend for app emails. Add these DNS records:

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Add domain `estories.app`
3. Resend will give you records like:

| Type | Name | Content |
|------|------|---------|
| **TXT** | `@` | `v=spf1 include:amazonses.com ~all` |
| **CNAME** | `resend._domainkey` | `[value from Resend]` |
| **TXT** | `_dmarc` | `v=DMARC1; p=none; rua=mailto:you@gmail.com` |

4. Add all records in Cloudflare DNS
5. Verify in Resend dashboard (takes a few minutes)

---

## 6. Security Settings

### 6.1 DNSSEC

1. Go to **DNS** → **Settings**
2. Enable **DNSSEC**
3. Cloudflare handles this automatically since the domain was bought on Cloudflare
4. No registrar DS record needed (Cloudflare is both registrar and DNS)

### 6.2 Recommended Cloudflare settings

| Setting | Location | Value |
|---------|----------|-------|
| Always Use HTTPS | SSL/TLS → Edge Certificates | ON |
| HSTS | SSL/TLS → Edge Certificates | Enable (if using proxy) |
| Minimum TLS | SSL/TLS → Edge Certificates | TLS 1.2 |
| Bot Fight Mode | Security → Bots | ON (free tier) |
| Browser Integrity Check | Security → Settings | ON |

---

## 7. Mobile App Deep Links (Android)

For Android App Links (when app is published on Play Store):

### 7.1 Digital Asset Links file

Create/host at `estories.app/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.estories.mobile",
      "sha256_cert_fingerprints": [
        "YOUR_SHA256_FINGERPRINT_HERE"
      ]
    }
  }
]
```

Get your SHA256 fingerprint:
```bash
# From your keystore
keytool -list -v -keystore your-release-key.keystore | grep SHA256

# Or from Google Play App Signing (recommended)
# Play Console → Release → Setup → App signing → SHA-256 certificate fingerprint
```

### 7.2 Add to Next.js (web app)

Create `app/.well-known/assetlinks.json/route.ts`:

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "app.estories.mobile",
        sha256_cert_fingerprints: ["YOUR_SHA256_FINGERPRINT"],
      },
    },
  ]);
}
```

### 7.3 Mobile app.json config

Already configured in `eas.json` — ensure `intentFilters` in `app.json`:

```json
{
  "expo": {
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "estories.app",
              "pathPrefix": "/story/"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

---

## 8. Environment Variables Update

After DNS propagation, update these in your `.env.local` and Vercel:

```bash
# Web app
NEXT_PUBLIC_APP_URL=https://estories.app
NEXT_PUBLIC_SITE_URL=https://estories.app

# Supabase Auth redirect URLs
# Go to Supabase Dashboard → Authentication → URL Configuration
# Add: https://estories.app/api/auth/callback
# Add: https://estories.app (Site URL)

# Google OAuth
# Go to Google Cloud Console → Credentials → OAuth client
# Add authorized redirect URI: https://estories.app/api/auth/callback
# Add authorized origin: https://estories.app

# Resend
# Update FROM address: noreply@estories.app

# Mobile app
# Update eas.json API URLs to https://estories.app
```

---

## 9. Verification Checklist

After setup, verify everything works:

```bash
# 1. DNS propagation (may take up to 48 hours, usually minutes)
dig estories.app +short
# Should return: 76.76.21.21

dig www.estories.app +short
# Should return: cname.vercel-dns.com (or resolved IP)

# 2. SSL certificate
curl -I https://estories.app
# Should return HTTP/2 200 with valid SSL

# 3. WWW redirect
curl -I https://www.estories.app
# Should redirect to https://estories.app (or vice versa)

# 4. Email routing (send a test email)
# Send to test@estories.app → should arrive at your Gmail

# 5. Resend domain verification
# Check Resend dashboard — domain should show "Verified"
```

---

## 10. DNS Records Summary

Final state of all DNS records:

| Type | Name | Content | Proxy | Purpose |
|------|------|---------|-------|---------|
| A | `@` | `76.76.21.21` | DNS only | Vercel |
| CNAME | `www` | `cname.vercel-dns.com` | DNS only | Vercel |
| MX | `@` | (auto by Cloudflare) | - | Email routing |
| TXT | `@` | `v=spf1 include:...` | - | Email auth (SPF) |
| CNAME | `resend._domainkey` | (from Resend) | - | Email auth (DKIM) |
| TXT | `_dmarc` | `v=DMARC1; p=none...` | - | Email auth (DMARC) |

---

## Timeline

| Step | Time |
|------|------|
| Add domain to Vercel | 5 minutes |
| Configure DNS records | 10 minutes |
| DNS propagation | 5 min – 48 hours |
| SSL auto-provisioning | Automatic (Vercel) |
| Email routing setup | 10 minutes |
| Resend domain verification | 15 minutes |
| Update env vars + OAuth URLs | 30 minutes |
| Deep link setup | When submitting to Play Store |

**Total active work: ~1 hour. DNS propagation is passive waiting.**

---

*Guide written 2026-03-23. Verify Vercel's A record IP hasn't changed at [Vercel docs](https://vercel.com/docs/custom-domains) before configuring.*
