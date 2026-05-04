import { describe, it, expect, beforeEach } from "vitest";
import {
  setupVault,
  unlockVault,
  lockVault,
  isVaultSetup,
  isVaultUnlocked,
  getDEK,
  changePin,
  clearAllKeys,
  getWrappedKeyMaterial,
} from "@/lib/vault/keyManager";
import { resetVaultDb } from "@/lib/vault/db";
import { encryptString, decryptString } from "@/lib/vault/crypto";

const TEST_USER = "test-user-123";
const PIN = "123456";
const NEW_PIN = "654321";

describe("Vault Key Manager", () => {
  beforeEach(async () => {
    clearAllKeys();
    await resetVaultDb();
    // Re-import db to get fresh instance
    const { getVaultDb } = await import("@/lib/vault/db");
    const db = getVaultDb();
    if (!db) throw new Error("Vault DB unavailable in test environment");
    await db.vaultKeys.clear();
    await db.stories.clear();
  });

  // --- Setup ---

  it("sets up a new vault", async () => {
    expect(await isVaultSetup(TEST_USER)).toBe(false);

    await setupVault(TEST_USER, PIN);

    expect(await isVaultSetup(TEST_USER)).toBe(true);
    expect(isVaultUnlocked(TEST_USER)).toBe(true);
  });

  it("throws if vault already exists", async () => {
    await setupVault(TEST_USER, PIN);

    await expect(setupVault(TEST_USER, PIN)).rejects.toThrow(
      "Vault already exists"
    );
  });

  // --- Lock / Unlock ---

  it("locks the vault (clears DEK from memory)", async () => {
    await setupVault(TEST_USER, PIN);
    expect(isVaultUnlocked(TEST_USER)).toBe(true);

    lockVault(TEST_USER);
    expect(isVaultUnlocked(TEST_USER)).toBe(false);
  });

  it("unlocks with correct PIN", async () => {
    await setupVault(TEST_USER, PIN);
    lockVault(TEST_USER);

    const success = await unlockVault(TEST_USER, PIN);
    expect(success).toBe(true);
    expect(isVaultUnlocked(TEST_USER)).toBe(true);
  });

  it("rejects wrong PIN", async () => {
    await setupVault(TEST_USER, PIN);
    lockVault(TEST_USER);

    const success = await unlockVault(TEST_USER, "000000");
    expect(success).toBe(false);
    expect(isVaultUnlocked(TEST_USER)).toBe(false);
  });

  it("throws when unlocking non-existent vault", async () => {
    await expect(unlockVault("no-user", PIN)).rejects.toThrow(
      "No vault found"
    );
  });

  // --- getDEK ---

  it("returns DEK when unlocked", async () => {
    await setupVault(TEST_USER, PIN);
    const dek = getDEK(TEST_USER);
    expect(dek).toBeDefined();
    expect(dek.type).toBe("secret");
  });

  it("throws when vault is locked", async () => {
    await setupVault(TEST_USER, PIN);
    lockVault(TEST_USER);

    expect(() => getDEK(TEST_USER)).toThrow("Vault is locked");
  });

  // --- Change PIN ---

  it("changes PIN successfully", async () => {
    await setupVault(TEST_USER, PIN);

    // Encrypt something with current DEK
    const dek = getDEK(TEST_USER);
    const encrypted = await encryptString("secret data", dek);

    // Change PIN
    await changePin(TEST_USER, PIN, NEW_PIN);

    // Lock and re-unlock with new PIN
    lockVault(TEST_USER);
    const success = await unlockVault(TEST_USER, NEW_PIN);
    expect(success).toBe(true);

    // Data should still decrypt with the same DEK
    const newDek = getDEK(TEST_USER);
    const decrypted = await decryptString(
      encrypted.ciphertext,
      encrypted.iv,
      newDek
    );
    expect(decrypted).toBe("secret data");
  });

  it("rejects change with wrong old PIN", async () => {
    await setupVault(TEST_USER, PIN);

    await expect(changePin(TEST_USER, "wrong!", NEW_PIN)).rejects.toThrow(
      "Incorrect current PIN"
    );
  });

  it("old PIN no longer works after change", async () => {
    await setupVault(TEST_USER, PIN);
    await changePin(TEST_USER, PIN, NEW_PIN);
    lockVault(TEST_USER);

    const success = await unlockVault(TEST_USER, PIN);
    expect(success).toBe(false);
  });

  // --- clearAllKeys ---

  it("clears all in-memory DEKs", async () => {
    await setupVault(TEST_USER, PIN);
    await setupVault("user-2", "111111");

    clearAllKeys();

    expect(isVaultUnlocked(TEST_USER)).toBe(false);
    expect(isVaultUnlocked("user-2")).toBe(false);
  });

  // --- Wrapped Key Material ---

  it("returns wrapped key material for backup", async () => {
    await setupVault(TEST_USER, PIN);

    const material = await getWrappedKeyMaterial(TEST_USER);
    expect(material).not.toBeNull();
    expect(material!.salt).toBeDefined();
    expect(material!.wrappedDek).toBeDefined();
  });

  it("returns null for non-existent user", async () => {
    const material = await getWrappedKeyMaterial("no-user");
    expect(material).toBeNull();
  });

  // --- Full Lifecycle ---

  it("full lifecycle: setup → encrypt → lock → unlock → decrypt", async () => {
    // Setup
    await setupVault(TEST_USER, PIN);

    // Encrypt
    const dek = getDEK(TEST_USER);
    const encrypted = await encryptString("My journal entry", dek);

    // Lock
    lockVault(TEST_USER);
    expect(isVaultUnlocked(TEST_USER)).toBe(false);

    // Unlock
    const success = await unlockVault(TEST_USER, PIN);
    expect(success).toBe(true);

    // Decrypt
    const restoredDek = getDEK(TEST_USER);
    const decrypted = await decryptString(
      encrypted.ciphertext,
      encrypted.iv,
      restoredDek
    );
    expect(decrypted).toBe("My journal entry");
  });
});
