"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useBackgroundMode } from "@/contexts/BackgroundContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BrandedLoader } from "@/components/ui/branded-loader";
import { toast } from "react-hot-toast";
import { apiGet, apiPost } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  User,
  BookOpen,
  Heart,
  Eye,
  MapPin,
  Globe,
  Calendar,
  Users,
  ArrowLeft,
  MessageCircle,
  Share2,
} from "lucide-react";

interface PublicUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  created_at: string;
  followers_count: number;
  badges: string[] | null;
}

interface PublicStory {
  id: string;
  numeric_id: string | null;
  title: string;
  content: string;
  created_at: string;
  likes: number;
  comments_count: number;
  shares: number;
  view_count: number;
  mood: string;
  tags: string[];
  has_audio: boolean;
  teaser: string | null;
  story_date: string | null;
}

interface Props {
  user: PublicUser;
  stories: PublicStory[];
  booksCount: number;
}

const MOOD_EMOJI: Record<string, string> = {
  happy: "😊",
  sad: "😢",
  excited: "🤩",
  calm: "😌",
  anxious: "😰",
  grateful: "🙏",
  angry: "😠",
  neutral: "😐",
};

export default function PublicProfileClient({ user, stories, booksCount }: Props) {
  const { getAccessToken, profile: currentUser, isLoading: isAuthLoading } = useAuth();
  const qc = useQueryClient();

  useBackgroundMode("profile");

  const isOwnProfile = currentUser?.id === user.id;

  // Compute stats
  const stats = useMemo(() => {
    const totalLikes = stories.reduce((sum, s) => sum + (s.likes || 0), 0);
    const totalViews = stories.reduce((sum, s) => sum + (s.view_count || 0), 0);
    return {
      stories: stories.length,
      likes: totalLikes,
      views: totalViews,
      books: booksCount,
      followers: user.followers_count || 0,
    };
  }, [stories, booksCount, user.followers_count]);

  // Check follow status
  const { data: followData, isLoading: isFollowLoading } = useQuery({
    queryKey: ["social", "follow", "batch", [user.id]],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return { following: {} };
      return apiGet<{ following: Record<string, boolean> }>(
        token,
        `/api/social/follow?followed_ids=${user.id}`
      );
    },
    enabled: !isAuthLoading && !!currentUser?.id && !isOwnProfile,
    staleTime: 10_000,
  });

  const isFollowing = followData?.following?.[user.id] || false;

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      return apiPost<{ isFollowing: boolean; followers_count: number }>(
        token,
        "/api/social/follow",
        { followed_id: user.id }
      );
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["social", "follow", "batch"] });
      toast.success(data.isFollowing ? "Following!" : "Unfollowed");
    },
    onError: () => {
      toast.error("Follow action failed");
    },
  });

  const handleFollow = () => {
    if (!currentUser?.id) {
      toast.error("Sign in to follow");
      return;
    }
    if (isOwnProfile) return;
    followMutation.mutate();
  };

  const handleShare = () => {
    const url = `${window.location.origin}/profile/${user.username}`;
    if (navigator.share) {
      navigator.share({ title: `${user.name || user.username} on eStories`, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    }
  };

  const displayName = user.name || user.username || "Anonymous Writer";
  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 px-4">
      {/* Back link */}
      <div className="pt-4">
        <Link
          href="/social"
          className="inline-flex items-center text-sm text-gray-500 hover:text-purple-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Social
        </Link>
      </div>

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-0 shadow-xl overflow-hidden">
          {/* Cover gradient */}
          <div className="h-32 bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))]" />

          <CardContent className="pt-0 pb-8">
            <div className="flex flex-col sm:flex-row items-start gap-6 -mt-12">
              {/* Avatar */}
              <Avatar className="h-24 w-24 border-4 border-white dark:border-gray-800 shadow-lg">
                <AvatarImage
                  src={user.avatar || "/default-avatar.jpg"}
                  alt={displayName}
                />
                <AvatarFallback className="text-2xl bg-purple-100 text-purple-700">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 min-w-0 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {displayName}
                    </h1>
                    {user.username && (
                      <p className="text-sm text-purple-600 dark:text-purple-400">
                        @{user.username}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!isOwnProfile && (
                      <Button
                        onClick={handleFollow}
                        disabled={isFollowLoading || followMutation.isPending || isAuthLoading}
                        variant={isFollowing ? "outline" : "default"}
                        className={
                          isFollowing
                            ? ""
                            : "bg-gradient-to-r from-purple-600 to-indigo-600"
                        }
                      >
                        <Users className="w-4 h-4 mr-2" />
                        {isFollowing ? "Following" : "Follow"}
                      </Button>
                    )}
                    <Button variant="outline" size="icon" onClick={handleShare}>
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Bio */}
                {user.bio && (
                  <p className="mt-3 text-gray-600 dark:text-gray-300 text-sm max-w-xl">
                    {user.bio}
                  </p>
                )}

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {user.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {user.location}
                    </span>
                  )}
                  {user.website && (
                    <a
                      href={user.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-purple-600 transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {user.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  )}
                  {joinDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Joined {joinDate}
                    </span>
                  )}
                </div>

                {/* Badges */}
                {user.badges && user.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {user.badges.map((badge) => (
                      <Badge
                        key={badge}
                        variant="secondary"
                        className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      >
                        {badge}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatItem icon={<BookOpen className="w-5 h-5" />} label="Stories" value={stats.stories} />
              <StatItem icon={<Heart className="w-5 h-5" />} label="Likes" value={stats.likes} />
              <StatItem icon={<Eye className="w-5 h-5" />} label="Views" value={stats.views} />
              <StatItem icon={<Users className="w-5 h-5" />} label="Followers" value={stats.followers} />
              <StatItem icon={<BookOpen className="w-5 h-5" />} label="Books" value={stats.books} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stories Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-purple-600" />
          Public Stories
        </h2>

        {stories.length === 0 ? (
          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="py-16 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                No public stories yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {stories.map((story, index) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * index }}
              >
                <Link href={`/story/${story.id}`}>
                  <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">
                              {MOOD_EMOJI[story.mood] || "📝"}
                            </span>
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                              {story.title}
                            </h3>
                            {story.has_audio && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                🎙️ Audio
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
                            {story.teaser || story.content}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(story.story_date || story.created_at).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              {story.likes || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              {story.comments_count || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {story.view_count || 0}
                            </span>
                          </div>

                          {story.tags && story.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {story.tags.slice(0, 5).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-[10px] bg-gray-100 dark:bg-gray-700"
                                >
                                  #{tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="text-center space-y-1">
      <div className="text-purple-600 dark:text-purple-400 flex justify-center">{icon}</div>
      <div className="text-xl font-bold text-gray-900 dark:text-white">
        {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}
