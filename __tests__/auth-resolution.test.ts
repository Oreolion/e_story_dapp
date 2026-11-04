import { beforeEach, describe, expect, it, vi } from "vitest";
import { FixtureDatabase } from "../evals/support/database";

const state = vi.hoisted(() => ({ db: null as unknown as FixtureDatabase, getUserById: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
  from: (table: string) => state.db.from(table),
  auth: { admin: { getUserById: state.getUserById } },
}) }));
import { resolvePrincipalId, resolveUserId } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

const actor = "00000000-0000-4000-8000-000000000011";
const linked = "00000000-0000-4000-8000-000000000012";
const wallet = "0x" + "2".repeat(40);
beforeEach(() => {
  state.db = new FixtureDatabase();
  state.getUserById.mockReset().mockResolvedValue({ data: { user: null }, error: null });
});
describe("authenticated profile resolution", () => {
  it("preserves direct wallet and OAuth profile identities", async () => {
    state.db.rows("users").push({ id: actor, wallet_address: wallet });
    expect(await resolveUserId(actor)).toBe(actor);
    expect(state.getUserById).not.toHaveBeenCalled();
  });
  it("cannot select another profile through user-editable wallet metadata", async () => {
    state.db.rows("users").push({ id: linked, wallet_address: wallet });
    state.getUserById.mockResolvedValue({ data: { user: { user_metadata: { wallet_address: wallet } } }, error: null });
    expect(await resolveUserId(actor)).toBe(actor);
  });
  it("resolves a verified Supabase principal through the server-only mapping", async () => {
    state.db.rows("users").push({ id: linked, wallet_address: wallet });
    state.db.rows("auth_identity_links").push({ auth_user_id: actor, user_id: linked });
    expect(await resolvePrincipalId({ kind: "supabase", subject: actor, user: { id: actor } as User })).toBe(linked);
    expect(await resolveUserId(linked)).toBe(linked);
  });
  it("never applies a Supabase mapping to a wallet/domain principal", async () => {
    state.db.rows("auth_identity_links").push({ auth_user_id: actor, user_id: linked });
    expect(await resolvePrincipalId({ kind: "wallet", subject: actor, wallet })).toBe(actor);
  });
  it("uses the verified mapping even when an empty direct profile exists", async () => {
    state.db.rows("users").push({ id: actor }, { id: linked });
    state.db.rows("auth_identity_links").push({ auth_user_id: actor, user_id: linked });
    expect(await resolvePrincipalId({ kind: "supabase", subject: actor, user: { id: actor } as User })).toBe(linked);
  });
  it.each([undefined, "invalid", "00000000-0000-4000-8000-000000000099"])("does not use absent, malformed or deleted bindings: %s", async binding => {
    state.getUserById.mockResolvedValue({ data: { user: { app_metadata: { istory_user_id: binding } } }, error: null });
    expect(await resolveUserId(actor)).toBe(actor);
  });
});
