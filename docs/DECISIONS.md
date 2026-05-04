# Decision Log & References

## Decision Log

### Why private-first instead of public-first?
Public-first incentivizes performance over authenticity. Private-first with selective sharing creates higher-quality public content and differentiates from social media.

### Why "canonical" stories?
Not all memories are equally important. Introducing intentional selection prevents noise, enables meaningful NFT minting, and creates the foundation for AI that understands what matters to the user.

### Why metadata extraction before graph database?
GraphRAG (Neo4j) is powerful but complex. Starting with a metadata table in Supabase proves the value of cognitive features before committing to architectural complexity. Can migrate to graph later if needed.

### Why Gemini Flash for analysis?
Already used for enhancement, keeps the stack simple. Fast and cost-effective for metadata extraction. Can swap for other models later if needed.

### Why keep social features for now?
Need users before we can serve users. Social provides discovery, engagement loops, and monetization validation. Will rebalance hierarchy after cognitive features are validated.

### Why privacy-preserving CRE instead of full on-chain metrics?
The original CRE integration stored all AI analysis data on-chain: raw scores, themes like "trauma" or "addiction", word count, and the author's wallet address — all permanently public. For a personal journaling app, this causes self-censorship. Users won't write honestly if their emotional inner world is broadcast on a public blockchain. The new `PrivateVerifiedMetrics` contract stores only minimal cryptographic proofs (quality tier, threshold bool, hashes), while full metrics live in Supabase visible only to the author. The blockchain attests that verification happened; it doesn't broadcast what was found. Uses `ConfidentialHTTPClient` for encrypted Gemini API calls inside DON enclaves.

### Why client-side encryption (Web Crypto API) instead of server-side for the local vault?
The vault encrypts stories on-device using the Web Crypto API (AES-256-GCM, PBKDF2). The PIN never leaves the device. This follows the same privacy-first principle as the CRE rewrite — the server should not have access to unencrypted personal journals unless the user explicitly syncs. Client-side crypto with IndexedDB means stories exist offline and the server can only receive what the user chooses to share. The DEK is held in-memory only while unlocked; locking clears it from the `dekMap`.

### Why Dexie.js for IndexedDB instead of the raw API?
Dexie provides a Promises-based API and the `dexie-react-hooks` package provides `useLiveQuery` — a reactive query primitive that automatically re-renders components when IndexedDB data changes. This eliminates polling and makes the encrypted story list feel like a reactive Supabase query. The `resetVaultDb()` singleton-reset function makes it testable with `fake-indexeddb`.

### Why dual-write (cloud-first, vault additive) in RecordPageClient?
Vault save runs after cloud save succeeds and is explicitly non-blocking (wrapped in its own try/catch). Vault failure never surfaces to the user or blocks the cloud save confirmation. This design avoids a failure mode where a crypto error causes a story to silently disappear — the cloud copy is always the authoritative record. The vault save sets `sync_status: "synced"` since the cloud already has the data.

### Why implicit OAuth flow? (TEMPORARY — migration planned)
The browser Supabase client (`supabaseClient.ts`) uses `createClient` from `@supabase/supabase-js` with `localStorage`. PKCE requires `@supabase/ssr` with cookie storage on both browser and server. The implicit flow works but is deprecated (RFC 9700) — refresh tokens are exposed in URL hash fragments. Migration to PKCE is a priority security task. Server callback handles missing `?code` gracefully by redirecting home. See memory file `oauth-pkce-migration.md` for full migration plan.

### Why show wallet status in the nav dropdown instead of a separate page?
Google OAuth users need a visible, low-friction path to optionally connect a wallet. Hiding it on the profile page made it invisible. The nav dropdown always shows wallet state: either a green check with truncated address (linked) or a "Connect Wallet" button that opens the existing AuthModal. This keeps wallet connection optional but discoverable without adding new pages or modals.

## References

- **Project Vision:** Research document "The Architecture of Digital Immortality"
In a world where history has often been manipulated by conquerors, victors and dominating empires, eStory reclaims the power of authentic storytelling. Users can broadcast their unfiltered truths forever on the blockchain, ensuring tamper-proof preservation, while earning rewards through community engagement and NFT-based sales.
- **Competitive Analysis:** StoriedLife, Remento, Rewind.ai (capture-focused, not cognitive)
- **Psychological Framework:** Self-Defining Memories (Singer), Self-Memory System (Conway)
- **Technical Reference:** GraphRAG (Microsoft Research) — future consideration
