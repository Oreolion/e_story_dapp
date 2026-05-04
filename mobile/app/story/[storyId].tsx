// Story Detail Screen - Content, audio, like, share, tip, paywall, CRE badge, metadata, canonical toggle
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Share,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Coins,
  Lock,
  Play,
  Pause,
  Star,
  Share2,
  UserPlus,
  UserCheck,
  Send,
  Briefcase,
  Activity,
  Brain,
  Compass,
  Palette,
  Sparkles,
  GraduationCap,
  Lightbulb,
  Users,
  TreePine,
  ShieldCheck,
  ExternalLink,
  FileText,
} from "lucide-react-native";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../../stores/authStore";
import { apiGet, apiPost, apiPatch } from "../../lib/api";
import { useVerifiedMetrics, getEmotionalDepthLabel } from "../../hooks/useVerifiedMetrics";
import { useStoryProtocol } from "../../hooks/useStoryProtocol";
import { useAccount } from "wagmi";
import type { StoryDataType, CommentDataTypes, StoryMetadata } from "../../types";
import {
  GlassCard,
  GradientButton,
  AnimatedListItem,
  Badge,
  Avatar,
  SkeletonLoader,
  GRADIENTS,
} from "../../components/ui";
import { TestnetBanner } from "../../components/TestnetBanner";

const DOMAIN_ICONS: Record<string, React.ComponentType<any>> = {
  work: Briefcase,
  relationships: Users,
  health: Activity,
  identity: Brain,
  growth: Sparkles,
  creativity: Palette,
  spirituality: Lightbulb,
  family: Users,
  adventure: Compass,
  learning: GraduationCap,
  general: TreePine,
};

const DOMAIN_COLORS: Record<string, string> = {
  work: "#60a5fa", relationships: "#f472b6", health: "#4ade80",
  identity: "#a78bfa", growth: "#facc15", creativity: "#fb923c",
  spirituality: "#c084fc", family: "#f87171", adventure: "#22d3ee",
  learning: "#34d399", general: "#94a3b8",
};

const TONE_COLORS: Record<string, string> = {
  reflective: "#818cf8", joyful: "#facc15", anxious: "#f87171",
  hopeful: "#4ade80", melancholic: "#a78bfa", grateful: "#34d399",
  frustrated: "#fb923c", peaceful: "#22d3ee", excited: "#f472b6",
  uncertain: "#94a3b8", neutral: "#64748b",
};

const THEME_COLORS = ["#818cf8", "#f472b6", "#34d399", "#fbbf24", "#60a5fa"];

function HeartButton({ isLiked, count, onPress }: { isLiked: boolean; count: number; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const handlePress = () => {
    scale.value = withSequence(
      withSpring(1.4, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 10, stiffness: 200 })
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };
  return (
    <TouchableOpacity onPress={handlePress} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Animated.View style={animatedStyle}>
        <Heart size={22} color={isLiked ? "#ef4444" : "#64748b"} fill={isLiked ? "#ef4444" : "transparent"} />
      </Animated.View>
      <Text style={{ fontSize: 13, color: "#94a3b8" }}>{count}</Text>
    </TouchableOpacity>
  );
}

export default function StoryDetailScreen() {
  const { storyId } = useLocalSearchParams<{ storyId: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const [story, setStory] = useState<StoryDataType | null>(null);
  const [metadata, setMetadata] = useState<StoryMetadata | null>(null);
  const [comments, setComments] = useState<CommentDataTypes[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCanonical, setIsCanonical] = useState(false);
  const [togglingCanonical, setTogglingCanonical] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState("0.001");
  const [tipping, setTipping] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const { isConnected } = useAccount();
  const { tipCreator, payPaywall } = useStoryProtocol();

  const isOwner =
    isAuthenticated && story && user &&
    (story.author.wallet_address === user.wallet_address || (story.author as any).id === user.id);

  const {
    metrics: verifiedMetrics,
    proof,
    isVerified: isCREVerified,
    isAuthor: isCREAuthor,
    isLoading: isVerifying,
    error: verifyError,
    triggerVerification,
  } = useVerifiedMetrics(storyId);

  useEffect(() => {
    const fetchStory = async () => {
      try {
        const res = await apiGet<{
          story: StoryDataType;
          comments: CommentDataTypes[];
          metadata?: StoryMetadata;
          story_metadata?: StoryMetadata;
        }>(`/api/stories/${storyId}`);
        if (res.ok && res.data) {
          setStory(res.data.story);
          setComments(res.data.comments || []);
          const meta = res.data.metadata || res.data.story_metadata ||
            (res.data.story as any).story_metadata || (res.data.story as any).metadata || null;
          setMetadata(meta);
          setIsCanonical(meta?.is_canonical === true);
          setIsFollowing(res.data.story.author.isFollowing || false);
        }
      } catch (err) {
        console.error("[StoryDetail] Fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };
    if (storyId) fetchStory();
    return () => { sound?.unloadAsync(); };
  }, [storyId]);

  const handleLike = async () => {
    if (!story || !isAuthenticated) return;
    setStory({
      ...story,
      isLiked: !story.isLiked,
      likes: story.isLiked ? story.likes - 1 : story.likes + 1,
    });
    await apiPost("/api/social/like", { storyId: story.id });
  };

  const handleComment = async () => {
    if (!newComment.trim() || !storyId) return;
    const res = await apiPost<{ comment: CommentDataTypes }>("/api/stories", {
      storyId, content: newComment,
    });
    if (res.ok && res.data?.comment) {
      setComments((prev) => [res.data!.comment, ...prev]);
      setNewComment("");
    }
  };

  const handleShare = async () => {
    if (!story) return;
    try {
      await Share.share({
        title: story.title,
        message: `"${story.title}" on eStories\n\nhttps://estories.app/story/${story.id}`,
      });
    } catch {}
  };

  const handleFollow = async () => {
    if (!story || !isAuthenticated) return;
    const authorId = (story.author as any).id || story.author.wallet_address;
    if (!authorId) return;
    setIsFollowing(!isFollowing);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await apiPost("/api/social/follow", { targetUserId: authorId });
  };

  const handleTip = async () => {
    if (!story || !isConnected) {
      Alert.alert("Wallet Required", "Connect your wallet to send tips.");
      return;
    }
    if (!story.author.wallet_address) {
      Alert.alert("Cannot Tip", "This author hasn't connected a wallet.");
      return;
    }
    setTipping(true);
    try {
      await tipCreator(story.author.wallet_address, tipAmount, story.id);
      setShowTipModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Toast already shown by hook
    } finally {
      setTipping(false);
    }
  };

  const handleUnlockPaywall = async () => {
    if (!story || !isConnected) {
      Alert.alert("Wallet Required", "Connect your wallet to unlock content.");
      return;
    }
    if (!story.author.wallet_address) return;
    setUnlocking(true);
    try {
      await payPaywall(story.author.wallet_address, String(story.paywallAmount), story.id);
      setStory({ ...story, isPaid: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Toast already shown by hook
    } finally {
      setUnlocking(false);
    }
  };

  const toggleCanonical = async () => {
    if (!storyId || togglingCanonical) return;
    setTogglingCanonical(true);
    const newValue = !isCanonical;
    try {
      const res = await apiPatch(`/api/stories/${storyId}/metadata`, { is_canonical: newValue });
      if (res.ok) {
        setIsCanonical(newValue);
        setMetadata((prev) => (prev ? { ...prev, is_canonical: newValue } : prev));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err) {
      console.error("[StoryDetail] Toggle canonical failed:", err);
    } finally {
      setTogglingCanonical(false);
    }
  };

  const playAudio = async () => {
    if (!story?.audio_url) return;
    try {
      if (sound) {
        if (isPlaying) { await sound.pauseAsync(); setIsPlaying(false); }
        else { await sound.playAsync(); setIsPlaying(true); }
        return;
      }
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: story.audio_url }, { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) setIsPlaying(false);
      });
    } catch (err) {
      console.error("[StoryDetail] Audio play failed:", err);
    }
  };

  if (loading || !story) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a", paddingHorizontal: 16 }}>
        <View style={{ paddingVertical: 16 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <SkeletonLoader variant="title" />
        <View style={{ marginTop: 16 }}>
          <SkeletonLoader variant="line" count={6} />
        </View>
      </SafeAreaView>
    );
  }

  const DomainIcon = metadata?.life_domain ? DOMAIN_ICONS[metadata.life_domain] || TreePine : null;
  const domainColor = metadata?.life_domain ? DOMAIN_COLORS[metadata.life_domain] || "#94a3b8" : "#94a3b8";
  const toneColor = metadata?.emotional_tone ? TONE_COLORS[metadata.emotional_tone] || "#64748b" : "#64748b";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <AnimatedListItem index={0}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: "600", color: "#fff" }} numberOfLines={1}>
              {story.title}
            </Text>
            {isOwner && (
              <TouchableOpacity onPress={toggleCanonical} disabled={togglingCanonical}>
                <Star size={24} color={isCanonical ? "#facc15" : "#64748b"} fill={isCanonical ? "#facc15" : "transparent"} />
              </TouchableOpacity>
            )}
          </View>
        </AnimatedListItem>

        {/* Continuation indicator */}
        {story.parent_story_id && (
          <TouchableOpacity
            onPress={() => router.push(`/story/${story.parent_story_id}`)}
            activeOpacity={0.8}
          >
            <GlassCard intensity="light" style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, marginBottom: 8 }}>
              <FileText size={14} color="#a78bfa" />
              <Text style={{ fontSize: 12, color: "#a78bfa" }}>Continuation of a previous story — tap to view</Text>
            </GlassCard>
          </TouchableOpacity>
        )}

        {/* Author */}
        <AnimatedListItem index={1}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <Avatar
              uri={story.author.avatar}
              name={story.author.name}
              size="lg"
              withGradientBorder
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontWeight: "600", color: "#fff", fontSize: 15 }}>
                {story.author.name || "Anonymous"}
              </Text>
              <Text style={{ fontSize: 12, color: "#64748b" }}>{story.timestamp}</Text>
            </View>
            {isAuthenticated && !isOwner && (
              <TouchableOpacity
                onPress={handleFollow}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: isFollowing ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor: isFollowing ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.1)",
                }}
              >
                {isFollowing ? (
                  <UserCheck size={14} color="#818cf8" />
                ) : (
                  <UserPlus size={14} color="#94a3b8" />
                )}
                <Text style={{ fontSize: 12, fontWeight: "500", color: isFollowing ? "#818cf8" : "#94a3b8" }}>
                  {isFollowing ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </AnimatedListItem>

        {/* Audio Player */}
        {story.hasAudio && story.audio_url && (
          <AnimatedListItem index={2}>
            <TouchableOpacity onPress={playAudio} activeOpacity={0.8}>
              <GlassCard
                intensity="light"
                style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, marginBottom: 16 }}
              >
                <LinearGradient
                  colors={GRADIENTS.primary}
                  style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}
                >
                  {isPlaying ? <Pause size={20} color="#fff" /> : <Play size={20} color="#fff" />}
                </LinearGradient>
                <Text style={{ color: "#cbd5e1", fontSize: 14 }}>
                  {isPlaying ? "Playing..." : "Listen to audio"}
                </Text>
              </GlassCard>
            </TouchableOpacity>
          </AnimatedListItem>
        )}

        {/* Paywall or Content */}
        <AnimatedListItem index={3}>
          {story.paywallAmount > 0 && !story.isPaid ? (
            <GlassCard intensity="medium" style={{ padding: 24, marginBottom: 16 }}>
              <Lock size={32} color="#a78bfa" />
              <Text style={{ marginTop: 8, fontSize: 17, fontWeight: "600", color: "#fff" }}>
                Premium Content
              </Text>
              <Text style={{ marginTop: 4, fontSize: 13, color: "#94a3b8" }}>
                {story.teaser || "Unlock this story for"} {story.paywallAmount} $STORY
              </Text>
              <View style={{ marginTop: 16 }}>
                <GradientButton
                  onPress={handleUnlockPaywall}
                  title={unlocking ? "Unlocking..." : `Unlock for ${story.paywallAmount} $STORY`}
                  gradient={GRADIENTS.primary}
                  fullWidth
                  loading={unlocking}
                  disabled={unlocking}
                />
              </View>
            </GlassCard>
          ) : (
            <Text style={{ marginBottom: 24, fontSize: 15, lineHeight: 26, color: "#e2e8f0" }}>
              {story.content}
            </Text>
          )}
        </AnimatedListItem>

        {/* Metadata Section */}
        {metadata && (
          <AnimatedListItem index={4}>
            <GlassCard intensity="light" style={{ padding: 16, marginBottom: 16 }}>
              {/* Themes */}
              {metadata.themes && metadata.themes.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ marginBottom: 6, fontSize: 10, fontWeight: "600", color: "#64748b", letterSpacing: 1 }}>
                    THEMES
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {metadata.themes.map((theme, i) => (
                      <Badge
                        key={theme}
                        text={theme}
                        color={THEME_COLORS[i % 5]}
                        bgColor={THEME_COLORS[i % 5] + "25"}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Domain + Tone Row */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {metadata.life_domain && DomainIcon && (
                  <Badge text={metadata.life_domain} color={domainColor} bgColor={domainColor + "20"} />
                )}
                {metadata.emotional_tone && (
                  <Badge text={metadata.emotional_tone} color={toneColor} bgColor={toneColor + "20"} />
                )}
                {metadata.significance_score > 0 && (
                  <Badge text={`Significance: ${metadata.significance_score}/10`} variant="warning" />
                )}
              </View>

              {/* Brief Insight */}
              {metadata.brief_insight && (
                <GlassCard intensity="light" withBorder={false} style={{ padding: 12 }}>
                  <Text style={{ fontSize: 12, fontStyle: "italic", lineHeight: 18, color: "#cbd5e1" }}>
                    "{metadata.brief_insight}"
                  </Text>
                </GlassCard>
              )}

              {/* Actionable Advice */}
              {metadata.actionable_advice && (
                <GlassCard intensity="light" withBorder={false} style={{ padding: 12, marginTop: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Lightbulb size={14} color="#facc15" />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#facc15" }}>Writing Advice</Text>
                  </View>
                  <Text style={{ fontSize: 12, lineHeight: 18, color: "#cbd5e1" }}>
                    {metadata.actionable_advice}
                  </Text>
                </GlassCard>
              )}
            </GlassCard>
          </AnimatedListItem>
        )}

        {/* Verified Metrics Section */}
        <AnimatedListItem index={5}>
          <TestnetBanner />
          {isVerifying ? (
            <GlassCard intensity="medium" style={{ padding: 20, marginBottom: 16, alignItems: "center" }}>
              <SkeletonLoader variant="line" count={3} />
              <Text style={{ marginTop: 12, fontSize: 13, color: "#eab308" }}>
                Chainlink CRE is verifying this story...
              </Text>
            </GlassCard>
          ) : isCREVerified && isCREAuthor && verifiedMetrics ? (
            <GlassCard intensity="light" style={{ padding: 16, marginBottom: 16, borderColor: "rgba(52,211,153,0.3)", borderWidth: 1 }}>
              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={18} color="#34d399" />
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#34d399" }}>Verified Metrics</Text>
                </View>
                {verifiedMetrics.on_chain_tx_hash && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <ExternalLink size={12} color="#64748b" />
                    <Text style={{ fontSize: 11, color: "#64748b" }}>
                      {verifiedMetrics.on_chain_tx_hash.slice(0, 6)}...{verifiedMetrics.on_chain_tx_hash.slice(-4)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Score Bars */}
              <View style={{ gap: 10, marginBottom: 14 }}>
                {/* Significance */}
                <View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Star size={12} color="#94a3b8" />
                      <Text style={{ fontSize: 12, color: "#94a3b8" }}>Significance</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#e2e8f0" }}>{verifiedMetrics.significance_score}/100</Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(100,116,139,0.3)" }}>
                    <LinearGradient
                      colors={["#818cf8", "#a78bfa"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ height: 6, borderRadius: 3, width: `${verifiedMetrics.significance_score}%` }}
                    />
                  </View>
                </View>

                {/* Quality */}
                <View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Sparkles size={12} color="#94a3b8" />
                      <Text style={{ fontSize: 12, color: "#94a3b8" }}>Quality</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#e2e8f0" }}>{verifiedMetrics.quality_score}/100</Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(100,116,139,0.3)" }}>
                    <LinearGradient
                      colors={["#34d399", "#22d3ee"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ height: 6, borderRadius: 3, width: `${verifiedMetrics.quality_score}%` }}
                    />
                  </View>
                </View>
              </View>

              {/* Emotional Depth + Word Count */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                <Badge
                  text={`${getEmotionalDepthLabel(verifiedMetrics.emotional_depth)} Depth`}
                  color="#f472b6"
                  bgColor="rgba(244,114,182,0.15)"
                />
                <Badge
                  text={`${verifiedMetrics.word_count.toLocaleString()} words`}
                  color="#94a3b8"
                  bgColor="rgba(148,163,184,0.15)"
                />
                {proof && (
                  <Badge
                    text={`Tier ${proof.qualityTier}`}
                    color={proof.meetsQualityThreshold ? "#34d399" : "#f59e0b"}
                    bgColor={proof.meetsQualityThreshold ? "rgba(52,211,153,0.15)" : "rgba(245,158,11,0.15)"}
                  />
                )}
              </View>

              {/* Verified Themes */}
              {verifiedMetrics.verified_themes && verifiedMetrics.verified_themes.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {verifiedMetrics.verified_themes.map((theme, i) => (
                    <Badge
                      key={theme}
                      text={theme}
                      color="#34d399"
                      bgColor="rgba(52,211,153,0.12)"
                    />
                  ))}
                </View>
              )}

              {/* Footer */}
              <View style={{ borderTopWidth: 1, borderTopColor: "rgba(100,116,139,0.2)", paddingTop: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <ShieldCheck size={11} color="#64748b" />
                  <Text style={{ fontSize: 10, color: "#64748b" }}>Verified by Chainlink CRE</Text>
                </View>
              </View>
            </GlassCard>
          ) : isCREVerified && proof ? (
            /* Non-author: proof-only badge */
            <GlassCard intensity="light" style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, marginBottom: 16, borderColor: "rgba(52,211,153,0.2)", borderWidth: 1 }}>
              <ShieldCheck size={18} color="#34d399" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#34d399" }}>Verified Story</Text>
                <Text style={{ fontSize: 11, color: "#94a3b8" }}>Quality Tier {proof.qualityTier}/5</Text>
              </View>
              {proof.meetsQualityThreshold && (
                <Badge text="Quality" color="#34d399" bgColor="rgba(52,211,153,0.15)" />
              )}
            </GlassCard>
          ) : isOwner && !isCREVerified ? (
            /* Owner: verify button */
            <View style={{ marginBottom: 16 }}>
              <GradientButton
                onPress={triggerVerification}
                title="Verify with Chainlink CRE"
                icon={<ShieldCheck size={18} color="#fff" />}
                gradient={GRADIENTS.success}
                fullWidth
              />
              {verifyError && (
                <Text style={{ marginTop: 6, fontSize: 12, color: "#ef4444", textAlign: "center" }}>
                  {verifyError}
                </Text>
              )}
            </View>
          ) : null}
        </AnimatedListItem>

        {/* Key Moment Toggle (owner only) */}
        {isOwner && (
          <AnimatedListItem index={6}>
            <TouchableOpacity onPress={toggleCanonical} disabled={togglingCanonical} activeOpacity={0.8}>
              <GlassCard
                intensity="light"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 12,
                  marginBottom: 16,
                  ...(isCanonical && { backgroundColor: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.3)" }),
                }}
              >
                <Star size={18} color={isCanonical ? "#facc15" : "#64748b"} fill={isCanonical ? "#facc15" : "transparent"} />
                <Text style={{ fontSize: 13, fontWeight: "500", color: isCanonical ? "#fbbf24" : "#94a3b8" }}>
                  {isCanonical ? "Key Moment" : "Mark as Key Moment"}
                </Text>
              </GlassCard>
            </TouchableOpacity>
          </AnimatedListItem>
        )}

        {/* Tags */}
        {story.tags.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {story.tags.map((tag) => (
              <Badge key={tag} text={`#${tag}`} />
            ))}
          </View>
        )}

        {/* Actions */}
        <AnimatedListItem index={7}>
          <GlassCard
            intensity="light"
            style={{ flexDirection: "row", alignItems: "center", gap: 20, padding: 16, marginBottom: 16 }}
          >
            <HeartButton isLiked={story.isLiked} count={story.likes} onPress={handleLike} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MessageCircle size={22} color="#64748b" />
              <Text style={{ fontSize: 13, color: "#94a3b8" }}>{comments.length}</Text>
            </View>
            {!isOwner && (
              <TouchableOpacity
                onPress={() => setShowTipModal(true)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Coins size={22} color="#facc15" />
                <Text style={{ fontSize: 13, color: "#facc15" }}>Tip</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleShare}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Share2 size={22} color="#64748b" />
              <Text style={{ fontSize: 13, color: "#94a3b8" }}>Share</Text>
            </TouchableOpacity>
          </GlassCard>
        </AnimatedListItem>

        {/* Tip Modal */}
        <Modal visible={showTipModal} transparent animationType="fade">
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.7)" }}>
            <GlassCard intensity="heavy" style={{ width: 300, padding: 24 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 4 }}>
                Send a Tip
              </Text>
              <Text style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
                Support {story.author.name || "this creator"} with $STORY tokens
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {["0.001", "0.01", "0.1"].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => setTipAmount(amt)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: "center",
                      backgroundColor: tipAmount === amt ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.05)",
                      borderWidth: 1,
                      borderColor: tipAmount === amt ? "rgba(250,204,21,0.4)" : "rgba(255,255,255,0.1)",
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: tipAmount === amt ? "#facc15" : "#94a3b8" }}>
                      {amt} ETH
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <GlassCard intensity="light" style={{ padding: 0, marginBottom: 16 }}>
                <TextInput
                  value={tipAmount}
                  onChangeText={setTipAmount}
                  placeholder="Custom amount (ETH)"
                  keyboardType="decimal-pad"
                  style={{ padding: 14, fontSize: 15, color: "#fff" }}
                  placeholderTextColor="#64748b"
                />
              </GlassCard>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setShowTipModal(false)}
                  style={{ flex: 1, paddingVertical: 12, alignItems: "center" }}
                >
                  <Text style={{ fontSize: 14, color: "#94a3b8" }}>Cancel</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <GradientButton
                    onPress={handleTip}
                    title={tipping ? "Sending..." : "Send Tip"}
                    icon={<Send size={16} color="#fff" />}
                    gradient={GRADIENTS.accent}
                    fullWidth
                    size="sm"
                    loading={tipping}
                    disabled={tipping || !tipAmount}
                  />
                </View>
              </View>
            </GlassCard>
          </View>
        </Modal>

        {/* Comments */}
        <View style={{ marginTop: 8 }}>
          <Text style={{ marginBottom: 12, fontSize: 17, fontWeight: "600", color: "#fff" }}>
            Comments ({comments.length})
          </Text>

          {isAuthenticated && (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              <GlassCard intensity="light" style={{ flex: 1, padding: 0 }}>
                <TextInput
                  value={newComment}
                  onChangeText={setNewComment}
                  placeholder="Write a comment..."
                  style={{ paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: "#fff" }}
                  placeholderTextColor="#64748b"
                />
              </GlassCard>
              <GradientButton
                onPress={handleComment}
                title="Post"
                gradient={GRADIENTS.primary}
                size="sm"
              />
            </View>
          )}

          {comments.map((c, idx) => (
            <AnimatedListItem key={c.id} index={idx}>
              <GlassCard intensity="light" style={{ padding: 12, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Avatar uri={null} name={c.author.name} size="sm" />
                  <Text style={{ fontSize: 13, fontWeight: "500", color: "#fff" }}>
                    {c.author.name || "Anonymous"}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#64748b" }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={{ marginTop: 6, fontSize: 13, color: "#cbd5e1", lineHeight: 18 }}>
                  {c.content}
                </Text>
              </GlassCard>
            </AnimatedListItem>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
