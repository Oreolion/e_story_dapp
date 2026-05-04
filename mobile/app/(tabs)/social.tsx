// Social Feed - Stories from community
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { router } from "expo-router";
import { Search, Heart, MessageCircle, Share2, Lock, UserPlus, UserCheck } from "lucide-react-native";
import { Share } from "react-native";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../../stores/authStore";
import { apiGet, apiPost } from "../../lib/api";
import type { StoryDataType } from "../../types";
import {
  GlassCard,
  GradientButton,
  AnimatedListItem,
  Badge,
  Avatar,
  SkeletonLoader,
  GRADIENTS,
  ANIMATION,
} from "../../components/ui";

type FeedTab = "latest" | "trending" | "following";

function HeartButton({ isLiked, count, onPress }: { isLiked: boolean; count: number; onPress: () => void }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(1.3, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 10, stiffness: 200 })
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
    >
      <Animated.View style={animatedStyle}>
        <Heart
          size={18}
          color={isLiked ? "#ef4444" : "#64748b"}
          fill={isLiked ? "#ef4444" : "transparent"}
        />
      </Animated.View>
      <Text style={{ fontSize: 13, color: "#94a3b8" }}>{count}</Text>
    </TouchableOpacity>
  );
}

export default function SocialScreen() {
  const { isAuthenticated } = useAuthStore();
  const [stories, setStories] = useState<StoryDataType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FeedTab>("latest");

  const fetchStories = useCallback(async () => {
    try {
      const res = await apiGet<{ stories: StoryDataType[] }>("/api/stories");
      if (res.ok && res.data?.stories) {
        setStories(res.data.stories);
      }
    } catch (err) {
      console.error("[Social] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStories();
    setRefreshing(false);
  };

  const handleLike = async (storyId: number) => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    setStories((prev) =>
      prev.map((s) =>
        s.id === storyId
          ? { ...s, isLiked: !s.isLiked, likes: s.isLiked ? s.likes - 1 : s.likes + 1 }
          : s
      )
    );
    await apiPost("/api/social/like", { storyId });
  };

  const handleFollow = async (authorId: string) => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    setStories((prev) =>
      prev.map((s) =>
        (s.author as any).id === authorId || s.author.wallet_address === authorId
          ? { ...s, author: { ...s.author, isFollowing: !s.author.isFollowing } }
          : s
      )
    );
    await apiPost("/api/social/follow", { targetUserId: authorId });
  };

  const handleShare = async (story: StoryDataType) => {
    try {
      await Share.share({
        title: story.title,
        message: `"${story.title}" on eStories\n\nhttps://estories.app/story/${story.id}`,
      });
    } catch {}
  };

  const filteredStories = stories.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.content.toLowerCase().includes(search.toLowerCase())
  );

  const renderStory = ({ item, index }: { item: StoryDataType; index: number }) => (
    <AnimatedListItem index={index}>
      <TouchableOpacity
        onPress={() => router.push(`/story/${item.id}`)}
        activeOpacity={0.8}
      >
        <GlassCard intensity="light" style={{ padding: 16, marginBottom: 16 }}>
          {/* Author Row */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Avatar
              uri={item.author.avatar}
              name={item.author.name}
              size="md"
              withGradientBorder
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontWeight: "600", color: "#fff", fontSize: 14 }}>
                {item.author.name || "Anonymous"}
              </Text>
              <Text style={{ fontSize: 11, color: "#64748b" }}>{item.timestamp}</Text>
            </View>
            {isAuthenticated && !item.author.isFollowing && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  handleFollow((item.author as any).id || item.author.wallet_address || "");
                }}
                style={{ marginRight: 8 }}
              >
                <UserPlus size={16} color="#818cf8" />
              </TouchableOpacity>
            )}
            <Badge text={item.mood} />
          </View>

          {/* Content */}
          <Text style={{ marginBottom: 4, fontSize: 16, fontWeight: "600", color: "#fff" }}>
            {item.title}
          </Text>
          {item.paywallAmount > 0 && !item.isPaid ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Lock size={14} color="#64748b" />
              <Text style={{ fontSize: 13, fontStyle: "italic", color: "#94a3b8" }}>
                {item.teaser || "Premium content — unlock to read"}
              </Text>
            </View>
          ) : (
            <Text style={{ fontSize: 13, lineHeight: 20, color: "#cbd5e1" }} numberOfLines={3}>
              {item.content}
            </Text>
          )}

          {/* Actions */}
          <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 24 }}>
            <HeartButton
              isLiked={item.isLiked}
              count={item.likes}
              onPress={() => handleLike(item.id)}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MessageCircle size={18} color="#64748b" />
              <Text style={{ fontSize: 13, color: "#94a3b8" }}>{item.comments}</Text>
            </View>
            <TouchableOpacity
              onPress={() => handleShare(item)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Share2 size={18} color="#64748b" />
              <Text style={{ fontSize: 13, color: "#94a3b8" }}>Share</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      </TouchableOpacity>
    </AnimatedListItem>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      {/* Search Bar */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <GlassCard
          intensity="light"
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10 }}
        >
          <Search size={18} color="#64748b" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search stories..."
            style={{ marginLeft: 10, flex: 1, fontSize: 15, color: "#fff" }}
            placeholderTextColor="#64748b"
          />
        </GlassCard>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        {(["latest", "trending", "following"] as FeedTab[]).map((tab) => {
          const isActive = activeTab === tab;
          return isActive ? (
            <GradientButton
              key={tab}
              onPress={() => setActiveTab(tab)}
              title={tab}
              gradient={GRADIENTS.primary}
              size="sm"
            />
          ) : (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
            >
              <GlassCard
                intensity="light"
                style={{ paddingHorizontal: 16, paddingVertical: 8 }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "500",
                    color: "#94a3b8",
                    textTransform: "capitalize",
                  }}
                >
                  {tab}
                </Text>
              </GlassCard>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Feed */}
      <FlatList
        data={filteredStories}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderStory}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            {loading ? (
              <SkeletonLoader variant="card" count={3} />
            ) : (
              <Text style={{ color: "#94a3b8" }}>No stories yet</Text>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}
