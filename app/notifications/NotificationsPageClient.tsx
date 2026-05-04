"use client";

import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, Trash2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications, type Notification } from "@/app/hooks/useNotifications";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICONS: Record<string, string> = {
  like: "❤️",
  comment: "💬",
  tip: "🎁",
  follow: "👥",
  book_published: "📚",
  story_mentioned: "✨",
  subscription: "⭐",
};

const GRADIENTS: Record<string, string> = {
  like: "from-red-500 to-pink-500",
  comment: "from-blue-500 to-cyan-500",
  tip: "from-yellow-500 to-orange-500",
  follow: "from-green-500 to-emerald-500",
  book_published: "from-purple-500 to-indigo-500",
  story_mentioned: "from-violet-500 to-purple-500",
  subscription: "from-amber-500 to-yellow-500",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function NotificationsPageClient() {
  const router = useRouter();
  const { profile, isLoading: isAuthLoading } = useAuth();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  } = useNotifications();

  const handleOpen = async (n: Notification) => {
    if (!n.read) await markAsRead(n.id);
    if (n.link) router.push(n.link);
    else if (n.story_id) router.push(`/story/${n.story_id}`);
  };

  if (isAuthLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </main>
    );
  }

  if (!profile?.id) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
        <h1 className="text-xl font-semibold mb-2">Sign in to see notifications</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Follows, likes, tips, and comments on your stories will show up here.
        </p>
        <Button onClick={() => router.push("/")}>Go home</Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 sm:py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Bell className="w-6 h-6 text-purple-600" />
              Notifications
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}`
                : "You're all caught up"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                className="gap-1"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm("Delete all notifications? This can't be undone.")) {
                    deleteAllNotifications();
                  }
                }}
                className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear all</span>
              </Button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          {loading && notifications.length === 0 ? (
            <div className="py-16 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600 mx-auto" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center px-4">
              <Bell className="w-14 h-14 text-gray-300 dark:text-gray-700 mx-auto mb-3 opacity-60" />
              <h2 className="font-semibold mb-1">No notifications yet</h2>
              <p className="text-sm text-muted-foreground">
                When people like, follow, or tip you, it will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
              <AnimatePresence initial={false}>
                {notifications.map((n) => (
                  <motion.li
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={cn(
                      "px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer",
                      !n.read && "bg-purple-50/60 dark:bg-purple-900/10"
                    )}
                    onClick={() => handleOpen(n)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-11 h-11 rounded-full bg-gradient-to-br flex items-center justify-center flex-shrink-0 text-lg shadow-sm",
                          GRADIENTS[n.type] || "from-gray-500 to-gray-600"
                        )}
                      >
                        {ICONS[n.type] || "📢"}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm">{n.title}</p>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-purple-600 flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {n.message}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {formatTimestamp(n.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!n.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(n.id);
                            }}
                            className="p-1.5 h-auto text-gray-400 hover:text-purple-600"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="p-1.5 h-auto text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
