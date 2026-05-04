/**
 * Vault — Barrel Export
 *
 * Re-exports all public APIs for clean `@/lib/vault` imports.
 */

// Crypto primitives
export {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  generateSalt,
  derivePinKey,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  encryptData,
  decryptData,
  encryptString,
  decryptString,
  hashPin,
} from "./crypto";
export type { EncryptedPayload } from "./crypto";

// IndexedDB schema & database
export {
  getVaultDb,
  isVaultAvailable,
  resetVaultDb,
} from "./db";
export type {
  LocalStoryRecord,
  VaultKeyRecord,
  SyncQueueRecord,
  SyncStatus,
  VaultDatabase,
} from "./db";

// Key lifecycle management
export {
  setupVault,
  unlockVault,
  lockVault,
  isVaultSetup,
  isVaultUnlocked,
  getDEK,
  changePin,
  getWrappedKeyMaterial,
  importWrappedKeyMaterial,
  clearAllKeys,
} from "./keyManager";
