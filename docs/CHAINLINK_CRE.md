# Chainlink CRE Integration in eStory

## What Problem Does It Solve?

eStory uses AI (Google Gemini) to analyze stories and produce quality metrics — significance score, emotional depth, writing quality, and themes. But if the AI analysis runs on your server, **anyone can fake the results**. A user could claim their story scored 95/100 when it actually scored 40. There's no way to prove the metrics are legitimate.

Chainlink CRE (Compute Runtime Environment) solves this by making the AI analysis **verifiable and tamper-proof**.

| Without Chainlink | With Chainlink CRE |
|---|---|
| AI runs on your server — you could fake results | AI runs inside encrypted DON enclaves with consensus |
| Metrics stored in your database — you could edit them | Cryptographic proofs stored on-chain — immutable, publicly auditable |
| Users must trust you | Users can verify on-chain themselves |
| Story content visible to node operators | Story content encrypted via ConfidentialHTTPClient |

The key insight: **Chainlink doesn't replace your AI — it makes your AI trustworthy** by running it in a privacy-preserving, consensus-based environment and recording cryptographic proofs immutably on-chain.

---

## Privacy Architecture

eStory is a storytelling platform handling both private journals and public stories (history, geopolitics, culture, creative non-fiction). Authors self-censor when their analysis data is broadcast on a public blockchain. The privacy-preserving CRE integration solves this with a **dual-write model**:

### What's Public (On-Chain)
- Quality tier (1-5): "High Quality" — not the exact score
- Meets quality threshold (bool): yes/no
- Metrics hash: keccak256 of all scores + themes + salt — provable but not reversible
- Author commitment: keccak256(walletAddress, storyId) — proves ownership without exposing address

### What's Private (Supabase, Author-Only)
- Exact scores (significance 0-100, emotional depth 1-5, quality 0-100)
- Themes (e.g., "trauma", "addiction", "family")
- Word count
- Full analysis details

### How It Works
```
On-chain (public):  "Verified, High Quality (Tier 4), meets threshold"
Off-chain (author): "Significance: 78, Emotional Depth: 4/5, Quality: 72, Themes: growth, resilience"
```

Anyone can verify that a story was analyzed and meets quality standards. Only the author sees the intimate details.

---

## What Triggers Verification?

**It is triggered automatically when a user saves a story.** There is no "Verify" button the user clicks.

In `app/api/journal/save/route.ts`, after the story is successfully saved to Supabase, the API fires off a background request to `/api/cre/trigger`. This is **fire-and-forget** — the save succeeds immediately, and CRE runs asynchronously.

### Note: "Generate / Create Insights" (UI) vs CRE

The "Generate Insights" / "Create Insights" button in the story UI (see `components/StoryInsights.tsx`) calls the local AI analysis endpoint (`/api/ai/analyze`) and updates the story's metadata for the UI. That action does **not** trigger the Chainlink CRE workflow.

Use `/api/cre/trigger` (automatically called after save) to start the CRE verification. You can also call it manually (requires an authenticated user token) as shown below.

### Quick manual triggers (curl & CRE CLI)

1) Trigger the app's CRE route (auth required):

```bash
curl -X POST "https://YOUR_APP_HOST/api/cre/trigger" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -d '{"storyId":"YOUR-STORY-UUID"}'
```

2) Trigger the CRE workflow endpoint directly (if running CRE runner locally or to demonstrate the workflow):

```bash
curl -X POST "$CRE_WORKFLOW_URL" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $CRE_API_KEY" \
     -d '{"storyId":"YOUR-STORY-UUID","title":"...","content":"...","authorWallet":"0x..."}'
```

3) CLI demo (recommended for presentations if you have the CRE runner available):

```bash
cd cre
cat demo-input.json | cre workflow simulate iStory_workflow
# or --broadcast to write to testnet
cat demo-input.json | cre workflow simulate iStory_workflow --broadcast
```

### Short presentation checklist (what to show on stage)

- Save a story in the app (or call `/api/journal/save`) → show `verification_logs` row created with `status = "pending"`.
- Show `/api/cre/trigger` call (background fetch) or run the `cre workflow simulate` command and point to the CRE runner logs.
- Show CRE workflow log steps (Step 1..8) — Gemini query, metricsHash/commitment, on-chain write (tx hash).
- Show on-chain proof (call `getMetrics` on `PrivateVerifiedMetrics`) — only minimal fields visible.
- Show `/api/cre/callback` result reflected in `verified_metrics` (full scores, themes) and `verification_logs` status changed to `completed`.
- In the app, refresh the story author view; `VerifiedMetricsCard` should show full metrics while public view shows proof only.


---

## The Full Pipeline

```
User records/writes a story and hits Save
       |
       v
  /api/journal/save
       |  1. Saves story to Supabase
       |  2. Triggers AI analysis (Gemini, for local insights)
       |  3. Triggers CRE verification (fire-and-forget)
       v
  /api/cre/trigger
       |  Validates ownership, creates verification_logs entry
       |  POSTs story content to Chainlink CRE workflow URL
       v
  Chainlink DON (Decentralized Oracle Network)
       |  ConfidentialHTTPClient: story content encrypted inside enclave
       |  Multiple independent nodes ALL run the same Gemini call
       |  They must ALL agree on the result (consensus)
       v
  DUAL WRITE:
       |
       |──> [On-Chain] KeystoneForwarder → PrivateVerifiedMetrics.sol
       |         Stores: qualityTier, meetsThreshold, metricsHash,
       |                 authorCommitment, attestationId
       |         Emits: MetricsVerified(storyId, authorCommitment, tier, threshold)
       |
       |──> [Off-Chain] ConfidentialHTTPClient → /api/cre/callback
       |         Stores: full scores, themes, word count, tx hash
       |         (Supabase verified_metrics table, author-only access)
       v
  /api/cre/check (author-based response filtering)
       |  Author: full metrics + proof
       |  Public: proof only (tier, threshold)
       v
  useVerifiedMetrics hook → VerifiedMetricsCard
       |  Author view: progress bars, themes, scores
       |  Public view: star rating, quality tier label
```

---

## Each Piece Explained

### 1. The Trigger (`/api/cre/trigger`)

**File:** `app/api/cre/trigger/route.ts`

When called (automatically from journal save, or manually):
- Validates the user owns the story (Bearer token auth)
- Checks it hasn't already been verified (prevents duplicates — 409 if exists)
- Creates a `verification_logs` entry with status `"pending"`
- POSTs story content (id, title, content, author wallet) to `CRE_WORKFLOW_URL`

### 2. The CRE Workflow (runs on Chainlink DON nodes)

**Files:** `cre/iStory_workflow/`

#### `main.ts` — Entry Point
- Sets up an HTTP trigger using `@chainlink/cre-sdk`
- Config includes `callbackUrl` and `owner` for Vault DON secrets

#### `gemini.ts` — Confidential AI Analysis
- Uses **`ConfidentialHTTPClient`** instead of `HTTPClient`
- Story content stays encrypted inside the DON enclave
- API key injected via Vault DON template: `{{.geminiApiKey}}`
- Uses `multiHeaders` and `vaultDonSecrets` (not `runtime.getSecret()`)
- `consensusIdenticalAggregation` — all nodes must return the same result

#### `httpCallback.ts` — 8-Step Orchestrator
1. **Parse & validate** — Decode JSON payload, check required fields
2. **AI analysis** — Call `askGemini()` via ConfidentialHTTPClient
3. **Derive privacy fields** — Compute qualityTier, meetsThreshold, metricsHash, authorCommitment
4. **Network setup** — Get chain config, create EVMClient for Base Sepolia
5. **Encode minimal data** — ABI-encode only: storyId, authorCommitment, meetsThreshold, qualityTier, metricsHash, attestationId
6. **Generate CRE report** — `runtime.report()` with ECDSA signing
7. **Write on-chain** — `evmClient.writeReport()` to PrivateVerifiedMetrics contract
8. **Callback full metrics** — ConfidentialHTTPClient POST to `/api/cre/callback` with all scores, themes, etc.

### 3. The Smart Contract (`PrivateVerifiedMetrics.sol`)

**File:** `contracts/PrivateVerifiedMetrics.sol`

Inherits from Chainlink's `ReceiverTemplate`. Stores **minimal cryptographic proofs**:

```solidity
struct MinimalMetrics {
    bool meetsQualityThreshold;  // qualityScore >= 70
    uint8 qualityTier;           // 1-5
    bytes32 metricsHash;         // keccak256(all scores + themes + salt)
    bytes32 authorCommitment;    // keccak256(walletAddress, storyId)
    bytes32 attestationId;
    uint256 verifiedAt;
    bool exists;
}
```

**Privacy verification helpers:**
- `verifyAuthor(storyId, address)` — Proves ownership by recomputing commitment
- `verifyMetricsHash(storyId, hash)` — Proves full metrics integrity

**Legacy contract:** `contracts/legacy/VerifiedMetrics.sol` — Old contract that stored full scores on-chain. Kept for backward compatibility with already-verified stories.

### 4. The Callback (`/api/cre/callback`)

**File:** `app/api/cre/callback/route.ts`

Receives full metrics from CRE DON nodes via ConfidentialHTTPClient:
- **Not user-authenticated** — uses `X-CRE-Callback-Secret` header with `safeCompare()`
- Upserts to `verified_metrics` Supabase table (idempotent for multiple DON nodes)
- Updates `verification_logs` status to "completed"
- Always returns `{ success: true }` for DON consensus

### 5. Reading Results (`/api/cre/check` + `useVerifiedMetrics`)

**File:** `app/api/cre/check/route.ts`

Dual-source reading with author-based filtering:
1. Check Supabase cache (full data from callback)
2. If caller is author → return full metrics + proof
3. If caller is NOT author → return proof only (tier, threshold)
4. If cache miss → read minimal on-chain data from contract
5. Legacy fallback → check old contract for backward compat

**File:** `app/hooks/useVerifiedMetrics.ts`

Returns separated `metrics` (author-only) and `proof` (always available):
```typescript
const { metrics, proof, isPending, isVerified, isAuthor, refetch } = useVerifiedMetrics(storyId);
```

### 6. Frontend Display

**Author view** (full metrics): Progress bars, emotional depth, themes, word count — same rich display as before, but only the author sees it.

**Public view** (proof only): Quality tier as 1-5 star rating with labels ("Developing" / "Fair" / "Good" / "High Quality" / "Exceptional"), "CRE Verified" shield, "Meets Quality Threshold" checkmark.

---

## Security Layers

1. **API Auth:** All endpoints require Bearer token via `validateAuthOrReject`
2. **Callback Auth:** CRE callback uses `X-CRE-Callback-Secret` with timing-safe comparison
3. **Ownership:** `/api/cre/trigger` verifies user owns the story before triggering
4. **Confidential HTTP:** Story content encrypted inside DON enclave via `ConfidentialHTTPClient`
5. **DON Consensus:** Multiple independent nodes must agree on the Gemini result
6. **Forwarder Validation:** `ReceiverTemplate` checks `msg.sender == forwarderAddress`
7. **On-chain Privacy:** No raw scores, themes, or wallet addresses stored on-chain
8. **Author-based Filtering:** `/api/cre/check` returns full metrics only to the story author

---

## Contract Addresses

| Contract | Address | Chain |
|----------|---------|-------|
| PrivateVerifiedMetrics | `NEXT_PUBLIC_VERIFIED_METRICS_ADDRESS` (env var) | Base Sepolia (84532) |
| Legacy VerifiedMetrics | `NEXT_PUBLIC_LEGACY_VERIFIED_METRICS_ADDRESS` (env var) | Base Sepolia (84532) |
| KeystoneForwarder | `0x82300bd7c3958625581cc2f77bc6464dcecdf3e5` | Base Sepolia |

## Environment Variables

| Var | Used By | Purpose |
|-----|---------|---------|
| `CRE_WORKFLOW_URL` | `/api/cre/trigger` | Chainlink CRE HTTP endpoint |
| `CRE_API_KEY` | `/api/cre/trigger` | Auth token for CRE workflow |
| `NEXT_PUBLIC_VERIFIED_METRICS_ADDRESS` | `/api/cre/check` | New contract address |
| `NEXT_PUBLIC_LEGACY_VERIFIED_METRICS_ADDRESS` | `/api/cre/check` | Old contract (backward compat) |
| `CRE_CALLBACK_SECRET` | `/api/cre/callback` | Secret for DON callback auth |
| `GEMINI_API_KEY_ALL` | CRE workflow | Google Gemini API key (Vault DON secret) |

## CRE CLI Commands

Run from the `cre/` directory:

```bash
# Simulate locally (no on-chain write)
cre workflow simulate iStory_workflow

# Simulate with on-chain broadcast (writes to testnet)
cre workflow simulate iStory_workflow --broadcast

# Deploy (requires Chainlink early access)
cre workflow deploy iStory_workflow
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `app/api/cre/trigger/route.ts` | Validates ownership, creates log, POSTs to CRE |
| `app/api/cre/callback/route.ts` | Receives full metrics from DON nodes |
| `app/api/cre/check/route.ts` | Author-filtered metrics reading |
| `app/hooks/useVerifiedMetrics.ts` | Frontend hook (metrics + proof) |
| `components/VerifiedMetricsCard.tsx` | Dual author/public display |
| `components/VerifiedBadge.tsx` | Badge with quality tier label |
| `cre/iStory_workflow/main.ts` | CRE workflow entry point |
| `cre/iStory_workflow/gemini.ts` | Confidential AI analysis |
| `cre/iStory_workflow/httpCallback.ts` | 8-step orchestration |
| `contracts/PrivateVerifiedMetrics.sol` | Privacy-preserving on-chain storage |
| `contracts/legacy/VerifiedMetrics.sol` | Old contract (full data on-chain) |
| `contracts/interfaces/ReceiverTemplate.sol` | Chainlink receiver base contract |

---

## Hackathon Demo

### Prerequisites
1. **CRE CLI installed** — `cre version`
2. **CRE account** — `cre login`
3. **Funded wallet** — Base Sepolia ETH in `cre/.env`
4. **API keys** — `GEMINI_API_KEY_ALL` in `cre/.env`
5. **Callback secret** — `CRE_CALLBACK_SECRET` matching the app's env var

### Running the Demo

```bash
cd cre

# Create input
cat > demo-input.json << 'EOF'
{
  "storyId": "YOUR-STORY-UUID",
  "title": "Overcoming Challenges",
  "content": "Today I faced a significant challenge...",
  "authorWallet": "0xYourWalletAddress"
}
---

## Ready-to-run demo input (copy & paste)

The following `demo-input.json` is a self-contained example you can copy into the `cre/` folder and run with the `cre` CLI. It uses a deterministic UUID and a placeholder wallet address that works for a local/demo run. If you plan to broadcast to testnet, ensure your CRE runner is configured with a funded wallet.

demo-input.json

```json
{
     "storyId": "11111111-1111-4111-8111-111111111111",
     "title": "Demo: CRE verification run",
     "content": "This is a short demo story used to exercise the Chainlink CRE workflow. It contains innocuous text for testing the pipeline, on-chain write, and callback behavior.",
     "authorWallet": "0x0000000000000000000000000000000000000001"
}
```

Commands (Bash / WSL / Git Bash)

```bash
# Save demo input
cat > demo-input.json << 'EOF'
{
     "storyId": "11111111-1111-4111-8111-111111111111",
     "title": "Demo: CRE verification run",
     "content": "This is a short demo story used to exercise the Chainlink CRE workflow. It contains innocuous text for testing the pipeline, on-chain write, and callback behavior.",
     "authorWallet": "0x0000000000000000000000000000000000000001"
}
EOF

# Dry run (no on-chain write)
cat input.json | cre workflow simulate iStory_workflow

# Broadcast (writes to testnet) — requires runner configured + funded wallet
cat input.json | cre workflow simulate iStory_workflow --broadcast
```

Commands (PowerShell)

```powershell
@"
{
     "storyId": "11111111-1111-4111-8111-111111111111",
     "title": "Demo: CRE verification run",
     "content": "This is a short demo story used to exercise the Chainlink CRE workflow. It contains innocuous text for testing the pipeline, on-chain write, and callback behavior.",
     "authorWallet": "0x0000000000000000000000000000000000000001"
}
"@ > demo-input.json

Get-Content input.json | cre workflow simulate iStory_workflow
Get-Content input.json | cre workflow simulate iStory_workflow --broadcast
```

Notes

- `--broadcast` requires the CRE runner's configured EVM signer to have testnet funds and the workflow `evm` config set to the correct chain.
- If you only want to show the CRE logs without writing on-chain, run the simulate command without `--broadcast` and the runner will go through Steps 1-8 but skip a real transaction.
EOF

# Dry run (local only)

cat input.json | cre workflow simulate iStory_workflow

# Real on-chain write

cat input.json | cre workflow simulate iStory_workflow --broadcast
```

### Expected Output (8 Steps)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRE Workflow: eStory Privacy-Preserving Verification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Step 1] Processing story: ...
[Step 2] Querying Gemini AI (confidential enclave)...
[Step 3] Deriving privacy-preserving fields...
[Step 3] qualityTier=4, meetsThreshold=true
[Step 4] Target chain: ethereum-testnet-sepolia-base-1
[Step 5] Encoding minimal privacy-preserving data...
[Step 6] Generating CRE report...
[Step 7] On-chain write successful: 0x1a2b3c4d...
[Step 8] Sending full metrics via confidential callback...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Verify Privacy On-Chain
```bash
# Read from contract — only minimal data visible
cast call $CONTRACT_ADDRESS \
  "getMetrics(bytes32)(bool,uint8,bytes32,bytes32,bytes32,uint256)" \
  $STORY_BYTES32 \
  --rpc-url https://sepolia.base.org

# Returns: (true, 4, 0xabc...hash, 0xdef...commitment, 0x123...attestation, 1709123456)
# NO scores, NO themes, NO wallet address visible
```


### dev note

#### here are the things i notice needs touching in app now

- make critical and very accurate analysis using the archetecture decisions, development guide and design used in the project taking note of every part of the app, create a structure  that i can just copy to use in another project or a reuseable skill that note every details, it doesnt have to use the same dependencies or tools as they are obviously different apps for different things, what i need is architectural framework, design patterns that works here and is standard and conventional, including tests, securities, seo, mobile-app etc also make sure it is conventional and very production ready secure and safe before you see it as that. i just need something global my dev environment can always use as guard, something 100% production ready, well tested and guanrateed across everthing that makes a production app standard and production ready. think very deeply and critically about this --- give this prompt to AI to make it into a better prompt -- usecase: use it to check where other projects are lagging e.g. ecollabs and as blueprint or template for new projects.


- **Shareability hooks to build into the product:**
1. **"Share Your Story" button** after AI analysis -- generates a beautiful card image (Canva-style, but auto-generated) with a quote from the analysis + the user's name + eStories branding. One tap to share on X, LinkedIn, or download.


---

### content
-**Encouraging UGC without being pushy:**
- After the 3rd journal entry: "Your stories are powerful. Want to share one? [Share button]"
- After first NFT mint: "You just made your journal entry permanent on the blockchain. That's worth sharing. [Share button]"
- stories profile can develop into a sort of Replit AI Storyboard for creating UGC powered story contents or Hyperframe made video contents

- i expect vault to be part of premium plans. and that it is working well to allow files and stories be saved on user device



- add
## 2. The Mechanics of Pattern Recognition (eStories)
eStories is an engine for individuation. The patterns your AI reveals to users will inevitably touch upon their repressed, unconscious traits.

 **Actionable Focus:** Architect eStories to help users safely identify and integrate their `` rather than reject it.


### The Undercurrents of eStories

Your platform helps users "see their patterns." A pattern is only half-visible if you only look at the light.

Pay attention to: The . The personal unconscious contains repressed impulses and denied capabilities. True individuation—and true narrative synthesis—requires integrating the shadow. EStories will be most potent if its AI can help users detect and integrate the shadow within their spoken narratives.
