"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";
import { supabaseClient } from "@/app/utils/supabase/supabaseClient";
import { queryKeys } from "./keys";

/* ==========================================================================
   Auth / Profile
   ========================================================================== */

export function useUserProfile() {
  const { getAccessToken, isLoading: isAuthLoading } = useAuth();
  return useQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: async () => {
      const token = await getAccessToken();
      return apiGet<{ user: any }>(token, "/api/user/profile");
    },
    enabled: !isAuthLoading,
    staleTime: 60_000,
    retry: (count, err) => {
      if (err instanceof ApiError && err.status === 401) return false;
      return count < 2;
    },
  });
}

export function useProfileData(userId: string) {
  const supabase = supabaseClient;
  return useQuery({
    queryKey: queryKeys.user.profile(userId),
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase not available");
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/* ==========================================================================
   Stories
   ========================================================================== */

export interface Story {
  id: string;
  numeric_id: number;
  title: string;
  content: string;
  teaser?: string;
  created_at: string;
  story_date?: string;
  is_public: boolean;
  likes: number;
  shares: number;
  comments_count: number;
  has_audio: boolean;
  audio_url: string | null;
  mood?: string;
  tags?: string[];
  paywall_amount?: number;
  story_type?: string;
  author_id: string;
  author_wallet?: string;
  view_count: number;
  author?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar: string | null;
    wallet_address: string | null;
    followers_count: number;
    badges: string[];
  } | null;
}

export function useStoriesFeed() {
  const { getAccessToken, isLoading: isAuthLoading } = useAuth();
  return useQuery({
    queryKey: queryKeys.stories.feed,
    queryFn: async () => {
      const token = await getAccessToken();
      return apiGet<{ stories: Story[] }>(token, "/api/stories/feed");
    },
    enabled: !isAuthLoading,
    staleTime: 30_000,
  });
}

export function useUserStories() {
  const { getAccessToken, isLoading: isAuthLoading } = useAuth();
  return useQuery({
    queryKey: queryKeys.stories.user("me"),
    queryFn: async () => {
      const token = await getAccessToken();
      return apiGet<{ stories: Story[] }>(token, "/api/stories");
    },
    enabled: !isAuthLoading,
    staleTime: 30_000,
  });
}

export function useStory(storyId: string) {
  const { getAccessToken, isLoading: isAuthLoading } = useAuth();
  return useQuery({
    queryKey: queryKeys.stories.detail(storyId),
    queryFn: async () => {
      const token = await getAccessToken();
      return apiGet<{
        story: Story & { parentStory?: { id: string; title: string } | null };
        comments: any[];
      }>(token, `/api/stories/${storyId}`);
    },
    enabled: !!storyId && !isAuthLoading,
    staleTime: 30_000,
  });
}

export function useStoryMetadata(storyId: string) {
  const { getAccessToken, isLoading: isAuthLoading } = useAuth();
  return useQuery({
    queryKey: queryKeys.stories.metadata(storyId),
    queryFn: async () => {
      const token = await getAccessToken();
      return apiGet<any>(token, `/api/stories/${storyId}/metadata`);
    },
    enabled: !!storyId && !isAuthLoading,
    staleTime: 60_000,
  });
}

/* ==========================================================================
   Social (Likes, Follows, Comments)
   ========================================================================== */

export function useLikeStatus(storyId: string) {
  const { getAccessToken, isLoading: isAuthLoading } = useAuth();
  return useQuery({
    queryKey: queryKeys.social.likeStatus(storyId),
    queryFn: async () => {
      const token = await getAccessToken();
      const data = await apiGet<{ liked: Record<string, boolean> }>(
        token,
        `/api/social/like/status?story_ids=${storyId}`
      );
      return { liked: data.liked[storyId] ?? false };
    },
    enabled: !!storyId && !isAuthLoading,
    staleTime: 10_000,
  });
}

export function useToggleLike() {
  const { getAccessToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["social", "like", "toggle"],
    mutationFn: async (storyId: string) => {
      const token = await getAccessToken();
      return apiPost<{
        success: boolean;
        data: { isLiked: boolean; totalLikes: number };
      }>(token, "/api/social/like", { storyId });
    },
    onSuccess: (_data, storyId) => {
      qc.invalidateQueries({ queryKey: queryKeys.social.likeStatus(storyId) });
      qc.invalidateQueries({ queryKey: queryKeys.stories.feed });
      qc.invalidateQueries({ queryKey: queryKeys.stories.detail(storyId) });
    },
  });
}

export function useFollowStatus(userId: string) {
  const { getAccessToken, isLoading: isAuthLoading } = useAuth();
  return useQuery({
    queryKey: queryKeys.social.followStatus(userId),
    queryFn: async () => {
      const token = await getAccessToken();
      const data = await apiGet<{ following: Record<string, boolean> }>(
        token,
        `/api/social/follow?followed_ids=${userId}`
      );
      return { following: data.following[userId] ?? false };
    },
    enabled: !!userId && !isAuthLoading,
    staleTime: 10_000,
  });
}

export function useToggleFollow() {
  const { getAccessToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["social", "follow", "toggle"],
    mutationFn: async (userId: string) => {
      const token = await getAccessToken();
      return apiPost<{ isFollowing: boolean; followers_count: number }>(
        token,
        "/api/social/follow",
        { followed_id: userId }
      );
    },
    onSuccess: (_data, userId) => {
      qc.invalidateQueries({ queryKey: queryKeys.social.followStatus(userId) });
      qc.invalidateQueries({ queryKey: queryKeys.user.profile() });
    },
  });
}

export function usePostComment() {
  const { getAccessToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["social", "comment", "post"],
    mutationFn: async ({
      story_id,
      content,
    }: {
      story_id: string;
      content: string;
    }) => {
      const token = await getAccessToken();
      return apiPost<{ success: boolean; data: any }>(
        token,
        "/api/social/comment",
        { story_id, content }
      );
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: queryKeys.social.comments(variables.story_id),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.stories.detail(variables.story_id),
      });
    },
  });
}

/* ==========================================================================
   Library / Collections
   ========================================================================== */

export function useLibraryCollections() {
  const { getAccessToken, isLoading: isAuthLoading } = useAuth();
  return useQuery({
    queryKey: queryKeys.library.collections,
    queryFn: async () => {
      const token = await getAccessToken();
      return apiGet<{ collections: any[] }>(token, "/api/stories/collections");
    },
    enabled: !isAuthLoading,
    staleTime: 30_000,
  });
}

export function useCollection(collectionId: string) {
  const { getAccessToken, isLoading: isAuthLoading } = useAuth();
  return useQuery({
    queryKey: queryKeys.library.collection(collectionId),
    queryFn: async () => {
      const token = await getAccessToken();
      return apiGet<{ collection: any; stories: any[] }>(
        token,
        `/api/stories/collections/${collectionId}`
      );
    },
    enabled: !!collectionId && !isAuthLoading,
    staleTime: 30_000,
  });
}

export function useCreateCollection() {
  const { getAccessToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["library", "collection", "create"],
    mutationFn: async ({
      title,
      description,
    }: {
      title: string;
      description?: string | null;
    }) => {
      const token = await getAccessToken();
      return apiPost<{ success: boolean; collection: any }>(
        token,
        "/api/stories/collections",
        { title, description }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.library.collections });
    },
  });
}

export function useDeleteCollection() {
  const { getAccessToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["library", "collection", "delete"],
    mutationFn: async (collectionId: string) => {
      const token = await getAccessToken();
      return apiDelete<{ success: boolean }>(
        token,
        `/api/stories/collections/${collectionId}`
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.library.collections });
    },
  });
}

/* ==========================================================================
   Books (Supabase direct)
   ========================================================================== */

export function useUserBooks(userId: string) {
  const supabase = supabaseClient;
  return useQuery({
    queryKey: queryKeys.library.books(userId),
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase not available");
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("author_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useUserBooksCount(userId: string) {
  const supabase = supabaseClient;
  return useQuery({
    queryKey: [...queryKeys.library.books(userId), "count"],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase not available");
      const { count, error } = await supabase
        .from("books")
        .select("*", { count: "exact", head: true })
        .eq("author_id", userId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useBook(bookId: string) {
  const supabase = supabaseClient;
  return useQuery({
    queryKey: queryKeys.library.book(bookId),
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase not available");
      const { data, error } = await supabase
        .from("books")
        .select(`*, author:users!books_author_id_fkey (name, wallet_address, avatar)`)
        .eq("id", bookId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!bookId,
    staleTime: 60_000,
  });
}

export function useBookChapters(storyIds: string[]) {
  const supabase = supabaseClient;
  return useQuery({
    queryKey: queryKeys.library.bookChapters(storyIds),
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase not available");
      if (storyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("stories")
        .select("id, title, content, created_at")
        .in("id", storyIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: storyIds.length > 0,
    staleTime: 60_000,
  });
}

/* ==========================================================================
   Parent Story (Supabase direct — for story continuation)
   ========================================================================== */

export function useParentStory(storyId: string | null) {
  const supabase = supabaseClient;
  return useQuery({
    queryKey: ["stories", "parent", storyId],
    queryFn: async () => {
      if (!supabase || !storyId) throw new Error("Supabase not available");
      const { data, error } = await supabase
        .from("stories")
        .select("title")
        .eq("id", storyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storyId,
    staleTime: 60_000,
  });
}

/* ==========================================================================
   Notifications
   ========================================================================== */

export function useNotifications() {
  const { getAccessToken, isLoading: isAuthLoading } = useAuth();
  return useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: async () => {
      const token = await getAccessToken();
      return apiGet<{ notifications: any[]; unreadCount: number }>(
        token,
        "/api/notifications"
      );
    },
    enabled: !isAuthLoading,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const { getAccessToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["notifications", "markRead"],
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      return apiPatch(token, `/api/notifications/${id}`, { read: true });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

/* ==========================================================================
   Payments
   ========================================================================== */

export function usePaymentStatus() {
  const { getAccessToken, isLoading: isAuthLoading } = useAuth();
  return useQuery({
    queryKey: queryKeys.payments.status,
    queryFn: async () => {
      const token = await getAccessToken();
      return apiGet<{
        subscription_plan: string;
        subscription_expires_at: string | null;
      }>(token, "/api/payment/status");
    },
    enabled: !isAuthLoading,
    staleTime: 60_000,
  });
}
