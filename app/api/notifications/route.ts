import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";

// Lazy Supabase Admin Client (avoids build-time initialization)
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

let _supabase: ReturnType<typeof getSupabase> | null = null;
function supabase() {
  if (!_supabase) _supabase = getSupabase();
  return _supabase;
}

// ============================================
// Types
// ============================================

interface NotificationPayload {
  user_id: string;
  type:
    | "like"
    | "comment"
    | "tip"
    | "follow"
    | "book_published"
    | "story_mentioned"
    | "subscription";
  title: string;
  message: string;
  related_user_id?: string;
  story_id?: string;
  link?: string;
  metadata?: Record<string, any>;
}

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_user_id?: string;
  story_id?: string;
  link?: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, any>;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get user from wallet address
 */
async function getUserIdFromWallet(
  walletAddress: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase()
      .from("users")
      .select("id")
      .eq("wallet_address", walletAddress.toLowerCase())
      .single();

    if (error) {
      console.error("Error fetching user:", error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error("Error in getUserIdFromWallet:", error);
    return null;
  }
}

/**
 * Create a notification
 */
async function createNotification(
  payload: NotificationPayload
): Promise<Notification | null> {
  try {
    const { data, error } = await supabase()
      .from("notifications")
      .insert([
        {
          user_id: payload.user_id,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          related_user_id: payload.related_user_id,
          story_id: payload.story_id,
          link: payload.link,
          read: false,
          metadata: payload.metadata || {},
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating notification:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in createNotification:", error);
    return null;
  }
}

/**
 * Get user notifications
 */
async function getUserNotifications(
  userId: string,
  limit = 20,
  offset = 0,
  unreadOnly = false
): Promise<{ notifications: Notification[]; total: number } | null> {
  try {
    let query = supabase()
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId);

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { notifications: [], total: 0 };
      }
      console.error("Error fetching notifications:", error);
      return null;
    }

    return {
      notifications: data || [],
      total: count || 0,
    };
  } catch (error) {
    console.error("Error in getUserNotifications:", error);
    return null;
  }
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(
  notificationId: string
): Promise<boolean> {
  try {
    const { error } = await supabase()
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in markNotificationAsRead:", error);
    return false;
  }
}

/**
 * Mark all notifications as read
 */
async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase()
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) {
      console.error("Error marking all notifications as read:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in markAllNotificationsAsRead:", error);
    return false;
  }
}

/**
 * Delete a notification
 */
async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase()
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (error) {
      console.error("Error deleting notification:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in deleteNotification:", error);
    return false;
  }
}

/**
 * Delete all notifications for user
 */
async function deleteAllNotifications(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase()
      .from("notifications")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting all notifications:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in deleteAllNotifications:", error);
    return false;
  }
}

/**
 * Get unread notification count
 */
async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase()
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return 0;
      }
      console.error("Error getting unread count:", error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error("Error in getUnreadCount:", error);
    return 0;
  }
}

// ============================================
// API Route Handlers
// ============================================

/**
 * GET /api/notifications
 * Fetch user notifications
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(request);
    if (isAuthError(authResult)) return authResult;
    const userId = authResult;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const getCount = searchParams.get("count") === "true";

    if (getCount) {
      const count = await getUnreadCount(userId);
      return NextResponse.json(
        {
          success: true,
          unreadCount: count,
        },
        { status: 200 }
      );
    }

    const result = await getUserNotifications(
      userId,
      limit,
      offset,
      unreadOnly
    );

    if (!result) {
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.notifications,
        pagination: {
          limit,
          offset,
          total: result.total,
          hasMore: offset + limit < result.total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications — RETIRED
 *
 * Previously allowed any authenticated user to create a notification for
 * any other user (via wallet_address targeting), which is abusable as a
 * notification-spam vector.
 *
 * Notifications are now created server-side only, from the specific
 * routes that produce them (social/like, social/follow, social/comment,
 * subscription, cre/callback, etc.) using the admin Supabase client.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Creating notifications from the client is no longer allowed. Notifications are produced server-side by the action that generated them.",
    },
    { status: 410 }
  );
}

/**
 * PUT /api/notifications/:id
 * Mark notification as read or update notification
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(request);
    if (isAuthError(authResult)) return authResult;
    const userId = authResult;

    const body = await request.json();
    const { notificationId, read, markAllAsRead } = body;

    // Mark all notifications as read
    if (markAllAsRead) {
      const success = await markAllNotificationsAsRead(userId);
      if (!success) {
        return NextResponse.json(
          { error: "Failed to mark notifications as read" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: "All notifications marked as read",
        },
        { status: 200 }
      );
    }

    // Mark specific notification as read
    if (!notificationId) {
      return NextResponse.json(
        { error: "Missing notificationId" },
        { status: 400 }
      );
    }

    // Verify notification belongs to user
    const { data: notification, error: fetchError } = await supabase()
      .from("notifications")
      .select("user_id")
      .eq("id", notificationId)
      .single();

    if (fetchError || !notification || notification.user_id !== userId) {
      return NextResponse.json(
        { error: "Notification not found or unauthorized" },
        { status: 404 }
      );
    }

    const success =
      read === undefined || read === true
        ? await markNotificationAsRead(notificationId)
        : true;

    if (!success) {
      return NextResponse.json(
        { error: "Failed to update notification" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Notification updated",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PUT /api/notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(request);
    if (isAuthError(authResult)) return authResult;
    const userId = authResult;

    const body = await request.json();
    const { notificationId, deleteAll } = body;

    // Delete all notifications
    if (deleteAll) {
      const success = await deleteAllNotifications(userId);
      if (!success) {
        return NextResponse.json(
          { error: "Failed to delete notifications" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: "All notifications deleted",
        },
        { status: 200 }
      );
    }

    // Delete specific notification
    if (!notificationId) {
      return NextResponse.json(
        { error: "Missing notificationId" },
        { status: 400 }
      );
    }

    // Verify notification belongs to user
    const { data: notification, error: fetchError } = await supabase()
      .from("notifications")
      .select("user_id")
      .eq("id", notificationId)
      .single();

    if (fetchError || !notification || notification.user_id !== userId) {
      return NextResponse.json(
        { error: "Notification not found or unauthorized" },
        { status: 404 }
      );
    }

    const success = await deleteNotification(notificationId);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete notification" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Notification deleted",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
