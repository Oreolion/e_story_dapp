/**
 * Vault Key Manager
 *
 * Manages the lifecycle of vault encryption keys:
 *   setupVault  — first-time: generate DEK, derive KEK, wrap, store
 *   unlockVault — derive KEK from PIN, unwrap DEK, hold in memory
 *   lockVault   — clear DEK from memory
 *   changePin   — re-wrap DEK with new KEK
 *
 * The DEK is held in memory ONLY while the vault is unlocked.
 * PIN never persists anywhere.
 */

import {
  derivePinKey,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  generateSalt,
  hashPin,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "./crypto";
import { getVaultDb, type VaultKeyRecord } from "./db";

// In-memory DEK store (userId → CryptoKey)
const dekMap = new Map<string, CryptoKey>();

/**
 * Set up a new vault for a user. Generates DEK, wraps it with PIN-derived KEK.
 */
export async function setupVault(userId: string, pin: string): Promise<void> {
  const db = getVaultDb();
  if (!db) throw new Error("Local vault is not supported in this browser");

  // Check if vault already exists
  const existing = await db.vaultKeys.get(userId);
  if (existing) {
    throw new Error("Vault already exists for this user");
  }

  // Generate fresh salt and DEK
  const salt = generateSalt();
  const dek = await generateDEK();

  // Derive KEK from PIN
  const kek = await derivePinKey(pin, salt);

  // Wrap DEK with KEK
  const wrappedDek = await wrapDEK(dek, kek);

  // Hash PIN for quick verification
  const pinHash = await hashPin(pin, salt);

  // Store in IndexedDB
  const record: VaultKeyRecord = {
    userId,
    salt: arrayBufferToBase64(salt.buffer),
    wrapped_dek: arrayBufferToBase64(wrappedDek),
    pin_hash: pinHash,
    created_at: new Date().toISOString(),
  };

  await db.vaultKeys.put(record);

  // Hold DEK in memory (vault is now unlocked)
  dekMap.set(userId, dek);
}

/**
 * Unlock the vault by deriving KEK from PIN and unwrapping DEK.
 * Returns true on success, false on wrong PIN.
 */
export async function unlockVault(
  userId: string,
  pin: string
): Promise<boolean> {
  const db = getVaultDb();
  if (!db) throw new Error("Local vault is not supported in this browser");

  const record = await db.vaultKeys.get(userId);
  if (!record) {
    throw new Error("No vault found for this user");
  }

  const salt = new Uint8Array(base64ToArrayBuffer(record.salt));

  // Quick PIN check
  const enteredHash = await hashPin(pin, salt);
  if (enteredHash !== record.pin_hash) {
    return false;
  }

  try {
    // Derive KEK and unwrap DEK
    const kek = await derivePinKey(pin, salt);
    const wrappedDek = base64ToArrayBuffer(record.wrapped_dek);
    const dek = await unwrapDEK(wrappedDek, kek);

    // Store in memory
    dekMap.set(userId, dek);
    return true;
  } catch {
    // Unwrap failed (shouldn't happen if PIN hash matched, but be safe)
    return false;
  }
}

/**
 * Lock the vault by clearing the DEK from memory.
 */
export function lockVault(userId: string): void {
  dekMap.delete(userId);
}

/**
 * Check if a vault has been set up for this user.
 */
export async function isVaultSetup(userId: string): Promise<boolean> {
  const db = getVaultDb();
  if (!db) return false;
  try {
    const record = await db.vaultKeys.get(userId);
    return !!record;
  } catch (err) {
    console.warn("[vault] isVaultSetup read failed:", err);
    return false;
  }
}

/**
 * Check if the vault is currently unlocked (DEK in memory).
 */
export function isVaultUnlocked(userId: string): boolean {
  return dekMap.has(userId);
}

/**
 * Get the in-memory DEK. Throws if vault is locked.
 */
export function getDEK(userId: string): CryptoKey {
  const dek = dekMap.get(userId);
  if (!dek) {
    throw new Error("Vault is locked — unlock with PIN first");
  }
  return dek;
}

/**
 * Change the vault PIN. Re-wraps DEK with new KEK.
 * Requires vault to be unlocked (DEK in memory).
 */
export async function changePin(
  userId: string,
  oldPin: string,
  newPin: string
): Promise<void> {
  const db = getVaultDb();
  if (!db) throw new Error("Local vault is not supported in this browser");

  const record = await db.vaultKeys.get(userId);
  if (!record) {
    throw new Error("No vault found for this user");
  }

  // Verify old PIN
  const salt = new Uint8Array(base64ToArrayBuffer(record.salt));
  const oldHash = await hashPin(oldPin, salt);
  if (oldHash !== record.pin_hash) {
    throw new Error("Incorrect current PIN");
  }

  // Get current DEK from memory
  const dek = getDEK(userId);

  // Generate new salt for new PIN
  const newSalt = generateSalt();
  const newKek = await derivePinKey(newPin, newSalt);
  const newWrappedDek = await wrapDEK(dek, newKek);
  const newPinHash = await hashPin(newPin, newSalt);

  // Update record
  await db.vaultKeys.put({
    userId,
    salt: arrayBufferToBase64(newSalt.buffer),
    wrapped_dek: arrayBufferToBase64(newWrappedDek),
    pin_hash: newPinHash,
    created_at: record.created_at,
  });
}

/**
 * Get wrapped key material for cloud backup (used when enabling cloud sync).
 */
export async function getWrappedKeyMaterial(
  userId: string
): Promise<{ salt: string; wrappedDek: string } | null> {
  const db = getVaultDb();
  if (!db) return null;
  const record = await db.vaultKeys.get(userId);
  if (!record) return null;
  return {
    salt: record.salt,
    wrappedDek: record.wrapped_dek,
  };
}

/**
 * Import wrapped key material from cloud (used for new device recovery).
 */
export async function importWrappedKeyMaterial(
  userId: string,
  salt: string,
  wrappedDek: string,
  pin: string
): Promise<void> {
  const pinHash = await hashPin(
    pin,
    new Uint8Array(base64ToArrayBuffer(salt))
  );

  const db = getVaultDb();
  if (!db) throw new Error("Local vault is not supported in this browser");
  await db.vaultKeys.put({
    userId,
    salt,
    wrapped_dek: wrappedDek,
    pin_hash: pinHash,
    created_at: new Date().toISOString(),
  });
}

/**
 * Clear all DEKs from memory (call on page unload).
 */
export function clearAllKeys(): void {
  dekMap.clear();
}
