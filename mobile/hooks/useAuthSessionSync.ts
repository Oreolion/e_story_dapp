import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import type { AppStateStatus } from "react-native";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";

/**
 * Keeps the API client's bearer token aligned with Supabase token refreshes and
 * starts/stops automatic refresh with the native application lifecycle.
 */
export function useAuthSessionSync(): void {
  const syncSessionToken = useAuthStore((state) => state.syncSessionToken);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        void syncSessionToken(session.access_token);
      } else if (event === "SIGNED_OUT") {
        void syncSessionToken(null);
      }
    });

    let appStateSubscription: { remove: () => void } | undefined;

    if (Platform.OS !== "web") {
      const handleAppStateChange = (state: AppStateStatus) => {
        if (state === "active") {
          supabase.auth.startAutoRefresh();
        } else {
          supabase.auth.stopAutoRefresh();
        }
      };

      handleAppStateChange(AppState.currentState);
      appStateSubscription = AppState.addEventListener(
        "change",
        handleAppStateChange
      );
    }

    return () => {
      subscription.unsubscribe();
      appStateSubscription?.remove();
      if (Platform.OS !== "web") {
        supabase.auth.stopAutoRefresh();
      }
    };
  }, [syncSessionToken]);
}
