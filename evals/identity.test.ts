import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FixtureDatabase } from "./support/database";
import { createPostgresFixture, postgresAdmin } from "./support/postgres";
import type { User } from "@supabase/supabase-js";
import type { PGlite } from "@electric-sql/pglite";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const state = vi.hoisted(() => ({ db: null as unknown as FixtureDatabase, admin: null as ReturnType<typeof postgresAdmin> | null, google: null as User | null }));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createSupabaseAdminClient: () => state.admin ?? state.db }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
  from: (table: string) => (state.admin ?? state.db).from(table),
  auth: { getUser: async (token: string) => ({ data: { user: token === "synthetic-google-session" ? state.google : null }, error: null }) },
}) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) }));
import { createLinkingToken } from "@/app/utils/linkingToken";
import { POST as linkGoogle } from "@/app/api/auth/link-google/route";
import { POST as initiateLink } from "@/app/api/auth/initiate-link/route";
import { POST as linkWallet } from "@/app/api/auth/link-account/route";
import { POST as sessionProfile } from "@/app/api/auth/session/route";
import { signWalletToken } from "@/lib/jwt";
import { validateAuth } from "@/lib/auth";

const owner = "00000000-0000-4000-8000-000000000011";
const wallet = `0x${"2".repeat(40)}`;
beforeEach(() => {
  state.db = new FixtureDatabase();
  state.admin = null;
  state.google = null;
  state.db.rows("users").push({ id: owner, wallet_address: wallet });
  process.env.LINK_TOKEN_SECRET = "synthetic-link-test-key-with-no-provider-access";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost";
});

describe("verified identity lifecycle with actual SQL and wallet signatures", () => {
  let db: PGlite;
  const account = privateKeyToAccount(generatePrivateKey());
  const otherAccount = privateKeyToAccount(generatePrivateKey());
  const oauth = "00000000-0000-4000-8000-000000000021";
  let cookie: string;
  beforeAll(async () => {
    db = await createPostgresFixture({ verifiedIdentity: true });
    cookie = `estory_wallet_token=${await signWalletToken(owner, account.address)}`;
  }, 60000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec("BEGIN");
    await db.query("INSERT INTO users(id,wallet_address) VALUES($1,$2)", [owner, account.address.toLowerCase()]);
    state.admin = postgresAdmin(db);
    state.google = { id: oauth, aud: "authenticated", created_at: "2026-10-01T00:00:00Z", identities: [{ id: "verified-google-subject", identity_id: "synthetic-identity", user_id: oauth, provider: "google" }], user_metadata: { wallet_address: "forged", full_name: "Synthetic user" }, app_metadata: {} };
  });
  afterEach(async () => { await db.exec("ROLLBACK"); });
  function request(route: string, body?: unknown, options: { google?: boolean; cookie?: string; origin?: string } = {}) {
    return new NextRequest(`http://localhost/api/auth/${route}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: options.origin ?? "http://localhost", ...(options.google ? { Authorization: "Bearer synthetic-google-session" } : {}), ...(options.cookie ? { Cookie: options.cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  async function walletChallenge() {
    const response = await initiateLink(request("initiate-link", { direction: "wallet_to_google", walletAddress: account.address }, { cookie }));
    expect(response.status).toBe(200);
    const challenge = await response.json();
    const signature = await account.signMessage({ message: challenge.message });
    return { challengeId: challenge.challengeId, signature };
  }

  it("links both verified identities once and resolves the same canonical API owner", async () => {
    const proof = await walletChallenge();
    expect((await db.query("SELECT challenge_hash FROM auth_link_challenges")).rows[0]).not.toHaveProperty("challenge_hash", proof.challengeId);
    const linked = await linkGoogle(request("link-google", proof, { google: true, cookie }));
    expect(linked.status).toBe(200);
    expect((await linked.json()).user.id).toBe(owner);
    expect(await validateAuth(request("session", undefined, { google: true }))).toBe(owner);
    expect((await linkGoogle(request("link-google", proof, { google: true, cookie }))).status).toBe(401);
    expect((await db.query("SELECT user_id FROM auth_identity_links")).rows).toEqual([{ user_id: owner }]);
  });
  it("requires the initiating wallet session in addition to a fresh signature and Google session", async () => {
    const proof = await walletChallenge();
    expect((await linkGoogle(request("link-google", proof, { google: true }))).status).toBe(403);
    expect((await db.query("SELECT * FROM auth_identity_links")).rows).toHaveLength(0);
  });
  it("rejects a signature from another wallet without consuming the challenge", async () => {
    const proof = await walletChallenge();
    proof.signature = await otherAccount.signMessage({ message: "Unrelated message" });
    expect((await linkGoogle(request("link-google", proof, { google: true, cookie }))).status).toBe(403);
    expect((await db.query("SELECT consumed_at FROM auth_link_challenges")).rows).toEqual([{ consumed_at: null }]);
  });
  it("rejects client identity fields even with otherwise valid proofs", async () => {
    const proof = await walletChallenge();
    expect((await linkGoogle(request("link-google", { ...proof, googleId: "forged" }, { google: true, cookie }))).status).toBe(401);
  });
  it("binds linking to the configured origin", async () => {
    const proof = await walletChallenge();
    expect((await linkGoogle(request("link-google", proof, { google: true, cookie, origin: "https://attacker.invalid" }))).status).toBe(403);
  });
  it("expires challenges even when both identity proofs remain valid", async () => {
    const proof = await walletChallenge();
    await db.exec("UPDATE auth_link_challenges SET created_at=now()-interval '6 minutes',expires_at=now()-interval '1 minute'");
    expect((await linkGoogle(request("link-google", proof, { google: true, cookie }))).status).toBe(401);
  });
  it("preserves another populated direct profile rather than silently merging its data", async () => {
    const proof = await walletChallenge();
    await db.query("INSERT INTO users(id,wallet_address,is_onboarded) VALUES($1,NULL,true)", [oauth]);
    // PostgREST gives each RPC its own transaction. This test has an outer
    // rollback fixture, so recover its savepoint after the expected SQL error.
    await db.exec("SAVEPOINT link_request");
    expect((await linkGoogle(request("link-google", proof, { google: true, cookie }))).status).toBe(409);
    await db.exec("ROLLBACK TO SAVEPOINT link_request");
    expect((await db.query("SELECT id FROM users ORDER BY id")).rows).toHaveLength(2);
    expect((await db.query("SELECT * FROM auth_identity_links")).rows).toHaveLength(0);
  });
  it("lets a legacy linked account reprove ownership without trusting its old metadata", async () => {
    await db.query("UPDATE users SET google_id='verified-google-subject',auth_provider='both' WHERE id=$1", [owner]);
    const held = await sessionProfile(request("session", undefined, { google: true }));
    expect(held.status).toBe(409);
    expect((await held.json()).code).toBe("identity_reverification_required");
    expect((await linkGoogle(request("link-google", await walletChallenge(), { google: true, cookie }))).status).toBe(200);
    expect((await sessionProfile(request("session", undefined, { google: true }))).status).toBe(200);
  });
  it("supports linking an unclaimed wallet from an existing verified Google account", async () => {
    await db.query("INSERT INTO users(id,wallet_address,google_id,auth_provider) VALUES($1,NULL,'verified-google-subject','google')", [oauth]);
    const started = await initiateLink(request("initiate-link", { direction: "google_to_wallet", walletAddress: otherAccount.address }, { google: true }));
    expect(started.status).toBe(200);
    const challenge = await started.json();
    const response = await linkWallet(request("link-account", { challengeId: challenge.challengeId, signature: await otherAccount.signMessage({ message: challenge.message }) }, { google: true }));
    expect(response.status).toBe(200);
    expect((await response.json()).user.wallet_address).toBe(otherAccount.address.toLowerCase());
  });
  it("consumes a wallet login nonce atomically, exactly once", async () => {
    const nonce = "00000000-0000-4000-8000-000000000031";
    await db.query("INSERT INTO auth_nonces(address,nonce,created_at) VALUES($1,$2,now())", [account.address.toLowerCase(), nonce]);
    expect((await db.query("SELECT consume_wallet_nonce($1,$2) AS consumed", [account.address, nonce])).rows).toEqual([{ consumed: true }]);
    expect((await db.query("SELECT consume_wallet_nonce($1,$2) AS consumed", [account.address, nonce])).rows).toEqual([{ consumed: false }]);
  });
  it("denies direct authenticated access to link authority", async () => {
    await db.exec("SET LOCAL ROLE authenticated");
    await expect(db.query("SELECT * FROM auth_identity_links")).rejects.toThrow(/permission denied/);
  });
});
describe("linking requires independently verified provider ownership", () => {
  it("cannot claim an arbitrary Google identity using only a valid wallet linking token", async () => {
    const response = await linkGoogle(new NextRequest("http://localhost/api/auth/link-google", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost" },
      body: JSON.stringify({ existingUserId: owner, googleId: "another-persons-google-subject", linkingToken: createLinkingToken(owner, wallet) }),
    }));
    expect(response.status).toBe(401);
    expect(state.db.rows("users")[0].google_id).toBeUndefined();
  });
});
