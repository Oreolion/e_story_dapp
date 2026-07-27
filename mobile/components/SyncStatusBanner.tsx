import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSyncStore } from "../stores/syncStore";

interface SyncStatusInput {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
}

export interface SyncStatus {
  label: string;
  backgroundColor: string;
  textColor: string;
}

export function getSyncStatus({
  isOnline,
  isSyncing,
  pendingCount,
  failedCount,
}: SyncStatusInput): SyncStatus | null {
  if (isSyncing) {
    return {
      label: `Syncing ${pendingCount} ${pendingCount === 1 ? "story" : "stories"}…`,
      backgroundColor: "#312e81",
      textColor: "#c7d2fe",
    };
  }

  if (!isOnline) {
    return {
      label:
        pendingCount > 0
          ? `Offline · ${pendingCount} ${pendingCount === 1 ? "story" : "stories"} waiting`
          : "Offline",
      backgroundColor: "#334155",
      textColor: "#e2e8f0",
    };
  }

  if (pendingCount > 0 && failedCount > 0) {
    return {
      label: `Sync needs attention · ${pendingCount} waiting`,
      backgroundColor: "#7c2d12",
      textColor: "#ffedd5",
    };
  }

  if (pendingCount > 0) {
    return {
      label: `${pendingCount} ${pendingCount === 1 ? "story" : "stories"} waiting to sync`,
      backgroundColor: "#164e63",
      textColor: "#cffafe",
    };
  }

  return null;
}

export function SyncStatusBanner() {
  const insets = useSafeAreaInsets();
  const isOnline = useSyncStore((state) => state.isOnline);
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const failedCount = useSyncStore(
    (state) => state.lastSyncResult?.failed ?? 0
  );
  const status = getSyncStatus({
    isOnline,
    isSyncing,
    pendingCount,
    failedCount,
  });

  if (!status) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityLabel={status.label}
      style={{
        position: "absolute",
        top: insets.top + 6,
        left: 16,
        right: 16,
        zIndex: 1000,
        alignItems: "center",
      }}
    >
      <View
        style={{
          backgroundColor: status.backgroundColor,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 7,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 5,
        }}
      >
        <Text
          style={{
            color: status.textColor,
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          {status.label}
        </Text>
      </View>
    </View>
  );
}
