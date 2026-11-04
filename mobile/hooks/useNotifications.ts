// Hook: Notifications CRUD and polling with subscribe/unsubscribe.
import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { apiGet, apiPut, apiDelete } from "../lib/api";
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

export interface PushRegistrationResult {
  enabled: boolean;
  reason: "unavailable" | "failed";
  message: string;
}

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  try {
    if (Device.isDevice && Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "eStories notifications",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#7c3aed",
      });
    }

    // The push registration backend is unavailable. Do not prompt for a permission
    // that cannot enable delivery, or collect a token without a registration service.
    return { enabled: false, reason: "unavailable", message: "Push notifications are not available yet. In-app notifications remain available." };
  } catch {
    return { enabled: false, reason: "failed", message: "Unable to configure notifications on this device." };
  }
}

type ApiNotification = Omit<Notification, "is_read"> & { read: boolean };

export function useNotifications() {
  const { isAuthenticated, user } = useAuthStore();
  const ownerKey = isAuthenticated ? user?.id ?? "" : "";
  const identity = useRef({ key: ownerKey, generation: 0 });
  if (identity.current.key !== ownerKey) identity.current = { key: ownerKey, generation: identity.current.generation + 1 };
  const [snapshotOwner, setSnapshotOwner] = useState(ownerKey);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notificationsRef = useRef<Notification[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subscribedRef = useRef(false);
  const updateNotifications = useCallback((update: (previous: Notification[]) => Notification[]) => {
    notificationsRef.current = update(notificationsRef.current);
    setNotifications(notificationsRef.current);
  }, []);

  const fetchNotifications = useCallback(
    async (params?: FetchParams) => {
      if (!ownerKey) return;
      const generation = identity.current.generation;
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams();
        if (params?.limit) query.set("limit", String(params.limit));
        if (params?.offset) query.set("offset", String(params.offset));
        if (params?.unreadOnly) query.set("unreadOnly", "true");

        const qs = query.toString();
        const path = `/api/notifications${qs ? `?${qs}` : ""}`;
        const [res, count] = await Promise.all([
          apiGet<{ success: boolean; data: ApiNotification[]; pagination: { hasMore: boolean } }>(path),
          apiGet<{ success: boolean; unreadCount: number }>("/api/notifications?count=true"),
        ]);
        if (identity.current.generation !== generation) return;
        if (!res.ok || !res.data?.success || !Array.isArray(res.data.data)) throw new Error(res.error || "Unable to load notifications.");
        const rows = res.data.data.map(({ read, ...notification }) => ({ ...notification, is_read: read }));
        updateNotifications(previous => params?.offset && params.offset > 0
          ? [...previous, ...rows.filter(row => !previous.some(existing => existing.id === row.id))]
          : rows);
        setHasMore(res.data.pagination?.hasMore ?? false);
        if (!count.ok || !count.data?.success || !Number.isInteger(count.data.unreadCount) || count.data.unreadCount < 0) throw new Error(count.error || "Unable to load the unread notification count.");
        setUnreadCount(count.data.unreadCount);
      } catch (err) {
        if (identity.current.generation === generation) setError(err instanceof Error ? err.message : "Unable to load notifications.");
      } finally {
        if (identity.current.generation === generation) setLoading(false);
      }
    },
    [ownerKey, updateNotifications]
  );

  const markAsRead = async (id: string) => {
    if (!ownerKey) return false;
    const generation = identity.current.generation;
    setError(null);
    try {
      const res = await apiPut("/api/notifications", { notificationId: id, read: true });
      if (identity.current.generation !== generation) return false;
      if (!res.ok) throw new Error(res.error || "Unable to mark the notification as read.");
      const wasUnread = notificationsRef.current.some(n => n.id === id && !n.is_read);
      updateNotifications(previous => previous.map(n => n.id === id ? { ...n, is_read: true } : n));
      if (wasUnread) setUnreadCount(previous => Math.max(0, previous - 1));
      return true;
    } catch (err) {
      if (identity.current.generation === generation) setError(err instanceof Error ? err.message : "Unable to mark the notification as read.");
      return false;
    }
  };

  const markAllAsRead = async () => {
    if (!ownerKey) return false;
    const generation = identity.current.generation;
    setError(null);
    try {
      const res = await apiPut("/api/notifications", { markAllAsRead: true });
      if (identity.current.generation !== generation) return false;
      if (!res.ok) throw new Error(res.error || "Unable to mark notifications as read.");
      updateNotifications(previous => previous.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      return true;
    } catch (err) {
      if (identity.current.generation === generation) setError(err instanceof Error ? err.message : "Unable to mark notifications as read.");
      return false;
    }
  };

  const deleteNotification = async (id: string) => {
    if (!ownerKey) return false;
    const generation = identity.current.generation;
    setError(null);
    try {
      const res = await apiDelete("/api/notifications", { notificationId: id });
      if (identity.current.generation !== generation) return false;
      if (!res.ok) throw new Error(res.error || "Unable to delete the notification.");
      const wasUnread = notificationsRef.current.some(n => n.id === id && !n.is_read);
      updateNotifications(previous => previous.filter(n => n.id !== id));
      if (wasUnread) setUnreadCount(previous => Math.max(0, previous - 1));
      return true;
    } catch (err) {
      if (identity.current.generation === generation) setError(err instanceof Error ? err.message : "Unable to delete the notification.");
      return false;
    }
  };

  const subscribe = useCallback(() => {
    if (subscribedRef.current || !ownerKey) return;
    subscribedRef.current = true;
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 30000);
  }, [ownerKey, fetchNotifications]);

  const unsubscribe = useCallback(() => {
    subscribedRef.current = false;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Auto-subscribe when authenticated
  useEffect(() => {
    updateNotifications(() => []);
    setSnapshotOwner(ownerKey);
    setUnreadCount(0); setHasMore(false); setError(null); setLoading(false);
    if (ownerKey) {
      subscribe();
    } else {
      unsubscribe();
    }
    return unsubscribe;
  }, [ownerKey, subscribe, unsubscribe, updateNotifications]);

  return {
    notifications: snapshotOwner === ownerKey ? notifications : [],
    unreadCount: snapshotOwner === ownerKey ? unreadCount : 0,
    loading,
    hasMore,
    error: snapshotOwner === ownerKey ? error : null,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    subscribe,
    unsubscribe,
  };
}
