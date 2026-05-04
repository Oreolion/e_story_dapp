/**
 * React Query keys — centralized to prevent invalidation bugs.
 *
 * Rules:
 *   - Every query must use a key from this file
 *   - Keys are hierarchical arrays: invalidating a parent invalidates children
 *   - Always include entity IDs in the key when fetching a single item
 */

export const queryKeys = {
  auth: {
    profile: ["auth", "profile"] as const,
    session: ["auth", "session"] as const,
  },
  stories: {
    feed: ["stories", "feed"] as const,
    detail: (id: string) => ["stories", "detail", id] as const,
    metadata: (id: string) => ["stories", "metadata", id] as const,
    user: (userId: string) => ["stories", "user", userId] as const,
  },
  social: {
    likeStatus: (storyId: string) => ["social", "like", storyId] as const,
    followStatus: (userId: string) => ["social", "follow", userId] as const,
    comments: (storyId: string) => ["social", "comments", storyId] as const,
    followers: (userId: string) => ["social", "followers", userId] as const,
  },
  library: {
    collections: ["library", "collections"] as const,
    collection: (id: string) => ["library", "collection", id] as const,
    saved: ["library", "saved"] as const,
    books: (userId: string) => ["library", "books", userId] as const,
    book: (id: string) => ["library", "book", id] as const,
    bookChapters: (ids: string[]) => ["library", "chapters", ids.join(",")] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    unread: ["notifications", "unread"] as const,
  },
  user: {
    profile: (userId?: string) =>
      userId ? (["user", "profile", userId] as const) : (["user", "profile"] as const),
  },
  payments: {
    status: ["payments", "status"] as const,
  },
} as const;
