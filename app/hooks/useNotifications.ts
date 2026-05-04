import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../components/AuthProvider";


// ============================================
// Types
// ============================================

export interface Notification {
  id: string;
  user_id: string;
  type:
    | "like"
    | "comment"
    | "tip"
    | "follow"
    | "book_published"
    | "story_mentioned";
  title: string;
  message: string;
  related_user_id?: string;
  story_id?: string;
  link?: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, any>;
}

interface FetchNotificationsParams {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  fetchNotifications: (params?: FetchNotificationsParams) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  createNotification: (
    payload: Omit<Notification, "id" | "user_id" | "read" | "created_at">
  ) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
}

// ============================================
// Hook Implementation
// ============================================

export function useNotifications(): UseNotificationsReturn {
  const { getAccessToken, profile, isLoading: isAuthLoading } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch notifications from API
   */
  const fetchNotifications = useCallback(
    async (params: FetchNotificationsParams = {}) => {
      if (isAuthLoading || !profile?.id) {
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { limit = 20, offset = 0, unreadOnly = false } = params;

        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          offset: offset.toString(),
          unreadOnly: unreadOnly.toString(),
        });

        const response = await fetch(`/api/notifications?${queryParams}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch notifications: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          setNotifications(
            offset === 0 ? data.data : [...notifications, ...data.data]
          );
          setHasMore(data.pagination.hasMore);
          setCurrentPage(offset / limit + 1);
        } else {
          setError(data.error || "Failed to fetch notifications");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("Error fetching notifications:", err);
      } finally {
        setLoading(false);
      }
    },
    [isAuthLoading, profile?.id, getAccessToken, notifications]
  );

  /**
   * Fetch unread notification count
   */
  const fetchUnreadCount = useCallback(async () => {
    if (isAuthLoading || !profile?.id) return;

    const token = await getAccessToken();
    if (!token) return;

    try {
      const response = await fetch("/api/notifications?count=true", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUnreadCount(data.unreadCount);
        }
      }
    } catch (err) {
      console.error("Error fetching unread count:", err);
    }
  }, [isAuthLoading, profile?.id, getAccessToken]);

  /**
   * Create a new notification
   */
  const createNotification = useCallback(
    async (
      payload: Omit<Notification, "id" | "user_id" | "read" | "created_at">
    ) => {
      const token = await getAccessToken();
      if (!token) {
        setError("No auth token found");
        return;
      }

      try {
        const response = await fetch("/api/notifications", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed to create notification: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          setNotifications([data.data, ...notifications]);
          toast.success("Notification created");
        } else {
          setError(data.error);
          toast.error(data.error || "Failed to create notification");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("Error creating notification:", err);
        toast.error(message);
      }
    },
    [getAccessToken, notifications]
  );

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback(
    async (notificationId: string) => {
      const token = await getAccessToken();
      if (!token) {
        setError("No auth token found");
        return;
      }

      try {
        const response = await fetch("/api/notifications", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notificationId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update notification: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          setNotifications(
            notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n
            )
          );
          setUnreadCount(Math.max(0, unreadCount - 1));
        } else {
          setError(data.error);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("Error marking notification as read:", err);
      }
    },
    [getAccessToken, notifications, unreadCount]
  );

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setError("No auth token found");
      return;
    }

    try {
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markAllAsRead: true }),
      });

      if (!response.ok) {
        throw new Error(`Failed to mark all as read: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setNotifications(notifications.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
        toast.success("All notifications marked as read");
      } else {
        setError(data.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("Error marking all as read:", err);
    }
  }, [getAccessToken, notifications]);

  /**
   * Delete a notification
   */
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      const token = await getAccessToken();
      if (!token) {
        setError("No auth token found");
        return;
      }

      try {
        const response = await fetch("/api/notifications", {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notificationId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to delete notification: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          setNotifications(
            notifications.filter((n) => n.id !== notificationId)
          );
          toast.success("Notification deleted");
        } else {
          setError(data.error);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("Error deleting notification:", err);
      }
    },
    [getAccessToken, notifications]
  );

  /**
   * Delete all notifications
   */
  const deleteAllNotifications = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setError("No auth token found");
      return;
    }

    try {
      const response = await fetch("/api/notifications", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deleteAll: true }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to delete all notifications: ${response.status}`
        );
      }

      const data = await response.json();

      if (data.success) {
        setNotifications([]);
        setUnreadCount(0);
        toast.success("All notifications deleted");
      } else {
        setError(data.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("Error deleting all notifications:", err);
    }
  }, [getAccessToken]);

  /**
   * Subscribe to real-time notifications (polling)
   */
  const subscribe = useCallback(() => {
    if (isAuthLoading || !profile?.id) return;

    fetchUnreadCount();
    fetchNotifications();
  }, [isAuthLoading, profile?.id, fetchNotifications, fetchUnreadCount]);

  /**
   * Unsubscribe from notifications
   */
  const unsubscribe = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Auto-fetch on mount when auth is ready, poll unread count on a stable interval
   */
  useEffect(() => {
    if (isAuthLoading || !profile?.id) return;

    // Initial fetch (once)
    fetchUnreadCount();
    fetchNotifications();

    // Poll unread count every 30 seconds — stable interval, no cascade
    pollingIntervalRef.current = setInterval(() => {
      getAccessToken().then((token) => {
        if (!token) return;
        fetch("/api/notifications?count=true", {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        })
          .then((res) => res.ok ? res.json() : null)
          .then((data) => { if (data?.success) setUnreadCount(data.unreadCount); })
          .catch(() => {});
      });
    }, 30000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // Only re-run when auth state truly changes, NOT when callbacks/state update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, profile?.id]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    hasMore,
    fetchNotifications,
    fetchUnreadCount,
    createNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    subscribe,
    unsubscribe,
  };
}
