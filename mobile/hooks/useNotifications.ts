// Hook: Notifications CRUD + push token registration + polling with subscribe/unsubscribe
import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { apiGet, apiPost, apiPut, apiDelete } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import type { Notification } from "../types";

(Notifications as unknown as {
  setNotificationHandler: (handler: {
    handleNotification: () => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
      shouldShowBanner: boolean;
      shouldShowList: boolean;
    }>;
  }) => void;
}).setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface FetchParams {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export async function registerForPushNotifications(
  requestPermission: boolean
): Promise<boolean> {
  if (!Device.isDevice) return false;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "eStories notifications",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#7c3aed",
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted" && requestPermission) {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }
    if (finalStatus !== "granted") return false;

    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error("[useNotifications] EAS project ID is not configured");
      return false;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const response = await apiPost("/api/notifications", {
      type: "push_token",
      token: tokenData.data,
      platform: Platform.OS,
    });
    return response.ok;
  } catch (err) {
    console.error("[useNotifications] Push token registration failed:", err);
    return false;
  }
}

export function useNotifications() {
  const { isAuthenticated } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subscribedRef = useRef(false);

  const fetchNotifications = useCallback(
    async (params?: FetchParams) => {
      if (!isAuthenticated) return;
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (params?.limit) query.set("limit", String(params.limit));
        if (params?.offset) query.set("offset", String(params.offset));
        if (params?.unreadOnly) query.set("unreadOnly", "true");

        const qs = query.toString();
        const path = `/api/notifications${qs ? `?${qs}` : ""}`;
        const res = await apiGet<{
          notifications: Notification[];
          unreadCount?: number;
          hasMore?: boolean;
        }>(path);

        if (res.ok && res.data?.notifications) {
          if (params?.offset && params.offset > 0) {
            // Append for pagination
            setNotifications((prev) => [...prev, ...res.data!.notifications]);
          } else {
            setNotifications(res.data.notifications);
          }
          if (typeof res.data.unreadCount === "number") {
            setUnreadCount(res.data.unreadCount);
          } else {
            setUnreadCount(
              res.data.notifications.filter((n) => !n.is_read).length
            );
          }
          setHasMore(res.data.hasMore ?? false);
        }
      } catch (err) {
        console.error("[useNotifications] Fetch failed:", err);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated]
  );

  const markAsRead = async (id: string) => {
    await apiPut("/api/notifications", { id, is_read: true });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await apiPut("/api/notifications", { mark_all_read: true });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string) => {
    await apiDelete("/api/notifications", { id });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const subscribe = useCallback(() => {
    if (subscribedRef.current || !isAuthenticated) return;
    subscribedRef.current = true;
    fetchNotifications();
    // Register silently only when the user has already granted permission.
    // The system permission prompt is triggered from an explicit profile action.
    void registerForPushNotifications(false);
    pollRef.current = setInterval(fetchNotifications, 30000);
  }, [isAuthenticated, fetchNotifications]);

  const unsubscribe = useCallback(() => {
    subscribedRef.current = false;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Auto-subscribe when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      subscribe();
    } else {
      unsubscribe();
    }
    return unsubscribe;
  }, [isAuthenticated, subscribe, unsubscribe]);

  return {
    notifications,
    unreadCount,
    loading,
    hasMore,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    subscribe,
    unsubscribe,
  };
}
