import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearQueue } from "./offline";

const LEGACY_RECORD_DRAFT_KEY = "estories_record_draft";

export function getRecordDraftKey(ownerId: string): string {
  return `${LEGACY_RECORD_DRAFT_KEY}:${ownerId}`;
}

/**
 * Remove data that belongs to the authenticated user.
 * Device-level preferences, such as the dismissed testnet banner, are retained.
 */
export async function clearUserLocalData(options?: {
  ownerId?: string;
  preserveDraft?: boolean;
}): Promise<void> {
  const operations: Promise<void>[] = [
    clearQueue(),
    // Remove drafts from the legacy global key so another account cannot load them.
    AsyncStorage.removeItem(LEGACY_RECORD_DRAFT_KEY),
  ];
  if (!options?.preserveDraft && options?.ownerId) {
    operations.push(
      AsyncStorage.removeItem(getRecordDraftKey(options.ownerId))
    );
  }

  const results = await Promise.allSettled(operations);

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[UserData] Failed to clear local user data");
    }
  }
}
