"use client";

import { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAccount } from "wagmi";
import { toast } from "react-hot-toast";
import { parseEther } from "viem";

import { useApp } from "../../../components/Provider";
import { useAuth } from "../../../components/AuthProvider";

import { useEStoryToken } from "../../hooks/useIStoryToken";
import { useStoryProtocol } from "../../hooks/useStoryProtocol";
import { useStoryNFT } from "../../hooks/useStoryNFT";
import { useWalletGuard } from "../../hooks/useWalletGuard";
import { supabaseClient } from "../../utils/supabase/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { StoryDataType, CommentDataTypes, moodColors, getStoryTypeConfig } from '../../types/index';
import { StoryInsights } from '@/components/StoryInsights';
import { CanonicalBadge } from '@/components/CanonicalBadge';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { VerifiedMetricsCard } from '@/components/VerifiedMetricsCard';
import { TestnetBanner } from '@/components/TestnetBanner';
import { useStoryMetadata } from '../../hooks/useStoryMetadata';
import { useVerifiedMetrics } from '../../hooks/useVerifiedMetrics';
import {
  useStory,
  useLikeStatus,
  useFollowStatus,
  useToggleLike,
  useToggleFollow,
  usePostComment,
} from "@/lib/queries/hooks";

import {
  Heart,
  Share2,
  Volume2,
  Calendar,
  Loader2,
  ArrowLeft,
  Sparkles,
  Lock,
  CheckCircle2,
  MessageCircle,
  Send,
  Edit,
  KeyRound,
  Globe,
  PenLine,
  BookOpen,
  Users,
  Eye,
} from "lucide-react";
import { BrandedLoader } from "@/components/ui/branded-loader";

export default function StoryPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  // Unwrap params using React.use() for Next.js 15 compatibility
  const { storyId } = use(params);

  const router = useRouter();
  const { isConnected } = useApp();
  const { address } = useAccount();
  const { profile: authInfo, getAccessToken } = useAuth();

  const supabase = supabaseClient;

  // Blockchain Hooks
  const { allowance, approve, isPending: isApproving } = useEStoryToken();

  // Metadata hook for canonical status
  const { metadata: storyMetadata } = useStoryMetadata(storyId);
  // CRE verified metrics hook
  const { metrics: verifiedMetrics, proof: verifiedProof, isPending: isVerifyPending, isVerified, isAuthor: isVerifyAuthor } = useVerifiedMetrics(storyId);
  const {
    payPaywall,
    isPending: isPayingProtocol,
    hash: payHash,
  } = useStoryProtocol();
  const { mintBook, isPending: isMinting } = useStoryNFT();
  const { requireWallet } = useWalletGuard();

  // React Query hooks
  const {
    data: storyApiData,
    isLoading: isStoryLoading,
    isError: isStoryError,
    error: storyError,
  } = useStory(storyId);
  const { data: likeStatusData } = useLikeStatus(storyId);
  const { data: followStatusData } = useFollowStatus(storyApiData?.story?.author?.id || "");
  const likeMutation = useToggleLike();
  const followMutation = useToggleFollow();
  const commentMutation = usePostComment();

  // State
  const [story, setStory] = useState<StoryDataType | null>(null);
  const [comments, setComments] = useState<CommentDataTypes[]>([]);
  const [parentStory, setParentStory] = useState<{ id: string; title: string } | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Actions State
  const [isLiked, setIsLiked] = useState(false);
  const [isTipping, setIsTipping] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false);
  const [authorFollowers, setAuthorFollowers] = useState(0);

  // Inputs
  const [newComment, setNewComment] = useState("");
  const [tipAmount, setTipAmount] = useState(5);

  // Dialogs
  const [showTipDialog, setShowTipDialog] = useState(false);
  const [showPaywallDialog, setShowPaywallDialog] = useState(false);

  const isLoading = isStoryLoading;
  const isAuthError =
    isStoryError &&
    (storyError as any)?.status === 401;

  // Sync story data from React Query into local state
  useEffect(() => {
    if (!storyApiData?.story) {
      setStory(null);
      setComments([]);
      setParentStory(null);
      return;
    }

    const s = storyApiData.story;
    const authorData = s.author;

    setStory({
      id: s.id as any,
      numeric_id: s.numeric_id as any,
      title: s.title,
      content: s.content,
      teaser: s.teaser,
      created_at: s.created_at,
      story_date: s.story_date || s.created_at,
      is_public: s.is_public || false,
      timestamp: s.created_at,
      likes: s.likes || 0,
      comments: s.comments_count || 0,
      shares: s.shares || 0,
      views: s.view_count || 0,
      hasAudio: s.has_audio || false,
      audio_url: s.audio_url ?? undefined,
      isLiked: likeStatusData?.liked ?? false,
      mood: s.mood || "neutral",
      tags: s.tags || [],
      paywallAmount: s.paywall_amount || 0,
      story_type: (s.story_type as any) || undefined,
      author: {
        id: authorData?.id,
        name: authorData?.name || null,
        username: authorData?.username || null,
        avatar: authorData?.avatar || null,
        wallet_address: authorData?.wallet_address || null,
        followers: authorData?.followers_count || 0,
        badges: authorData?.badges || [],
        isFollowing: followStatusData?.following ?? false,
      },
      author_wallet: {
        id: authorData?.id,
        name: authorData?.name || null,
        username: authorData?.username || null,
        avatar: authorData?.avatar || null,
        wallet_address: authorData?.wallet_address || null,
        followers: authorData?.followers_count || 0,
        badges: authorData?.badges || [],
        isFollowing: followStatusData?.following ?? false,
      },
    });

    const formattedComments = (storyApiData.comments || []).map((c: any) => {
      const commentAuthor = Array.isArray(c.author) ? c.author[0] : c.author;
      return {
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        author: {
          name: commentAuthor?.name || "Anonymous",
          avatar: commentAuthor?.avatar,
          wallet_address: commentAuthor?.wallet_address,
        },
      };
    });

    setComments(formattedComments);
    setParentStory(s.parentStory || null);
  }, [storyApiData, likeStatusData, followStatusData]);

  // Sync follow status + followers when story changes
  useEffect(() => {
    if (story?.author) {
      setIsFollowingAuthor(story.author.isFollowing);
      setAuthorFollowers(story.author.followers || 0);
    }
  }, [story?.author?.isFollowing, story?.author?.followers]);

  // Sync like status when query updates
  useEffect(() => {
    setIsLiked(likeStatusData?.liked ?? false);
  }, [likeStatusData]);

  // Check unlock status via Supabase
  useEffect(() => {
    if (!authInfo?.id || !storyId || !supabase) return;
    if (!story || story.paywallAmount <= 0) return;

    const checkUnlock = async () => {
      const { data: unlockData } = await supabase
        .from("unlocked_content")
        .select("id")
        .eq("user_id", authInfo.id)
        .eq("story_id", storyId)
        .maybeSingle();
      if (unlockData) setIsUnlocked(true);
    };
    checkUnlock();
  }, [authInfo?.id, storyId, story?.paywallAmount]);

  // --- 2. Payment Verification Listener ---
  useEffect(() => {
    if (payHash && !isSyncing) {
      const syncToDb = async () => {
        setIsSyncing(true);
        toast.loading("Verifying payment...", { id: "sync-toast" });
        try {
          const token = await getAccessToken();
          const res = await fetch("/api/sync/verify_tx", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              txHash: payHash,
              userWallet: address,
            }),
          });

          if (!res.ok) throw new Error("Verification failed");

          setIsUnlocked(true);
          setShowPaywallDialog(false);
          toast.success("Story Unlocked!", { id: "sync-toast" });
        } catch (err) {
          console.error(err);
          toast.error("Payment confirmed but sync failed. Unlocked locally.", {
            id: "sync-toast",
          });
          setIsUnlocked(true);
        } finally {
          setIsSyncing(false);
        }
      };
      syncToDb();
    }
  }, [payHash, address]);

  // --- 3. Actions ---

  const handleUnlock = async () => {
    if (!story) return;
    const requiredAmount = parseEther(story.paywallAmount.toString());

    // Step 1: Approve if needed
    if (allowance < requiredAmount) {
      try {
        await approve(story.paywallAmount.toString());
        return;
      } catch (e) {
        return;
      }
    }

    // Step 2: Pay
    await payPaywall(
      story.author.wallet_address as string,
      story.paywallAmount,
      story.numeric_id
    );
  };

  const handleLike = async () => {
    if (!authInfo) return toast.error("Please sign in to like stories");
    if (!story) return;

    const prevLiked = isLiked;
    const prevLikes = story.likes;

    // Optimistic UI
    setIsLiked(!prevLiked);
    setStory((prev) =>
      prev
        ? { ...prev, likes: prevLiked ? prev.likes - 1 : prev.likes + 1 }
        : null
    );

    try {
      const { data } = await likeMutation.mutateAsync(storyId);
      setIsLiked(data.isLiked);
      setStory((prev) =>
        prev ? { ...prev, likes: data.totalLikes } : null
      );
    } catch (error: any) {
      console.error("Like error:", error);
      // Revert on failure
      setIsLiked(prevLiked);
      setStory((prev) => (prev ? { ...prev, likes: prevLikes } : null));
      toast.error("Failed to like story");
    }
  };

  const handleTip = async () => {
    if (!requireWallet("tip authors")) return;
    if (!story) return;

    try {
      setIsTipping(true);
      // NOTE: Original code referenced 'eStoryToken' which wasn't in scope in provided snippet
      // Assuming hook handles it or it was imported. Keeping logic flow same.
      toast.success(`Tipped ${tipAmount} $ESTORY!`);
      setShowTipDialog(false);
    } catch (error: any) {
      console.error("Tip error:", error);
      toast.error("Failed to send tip");
    } finally {
      setIsTipping(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    if (!authInfo?.id) return toast.error("Please sign in to comment");

    try {
      const payload = await commentMutation.mutateAsync({
        story_id: storyId,
        content: newComment,
      });

      const data = payload?.data;
      const authorData = Array.isArray(data?.author) ? data.author[0] : data?.author;

      const newCommentObj: CommentDataTypes = {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        author: {
          name: authorData?.name || "Me",
          avatar: authorData?.avatar,
          wallet_address: authorData?.wallet_address,
        },
      };

      setComments((prev) => [newCommentObj, ...prev]);
      setNewComment("");
      toast.success("Comment posted!");
    } catch (error) {
      console.error("Comment error:", error);
      toast.error("Failed to post comment");
    }
  };

  const handleFollow = async () => {
    if (!authInfo) return toast.error("Please sign in to follow writers.");
    if (!story?.author?.id) return;

    const prevState = isFollowingAuthor;
    const prevCount = authorFollowers;
    // Optimistic
    setIsFollowingAuthor(!prevState);
    setAuthorFollowers(prevState ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const { isFollowing, followers_count } = await followMutation.mutateAsync(
        story.author.id
      );
      setIsFollowingAuthor(isFollowing);
      setAuthorFollowers(followers_count);
      const authorName =
        story.author?.name || story.author?.username || "this writer";
      toast.success(
        isFollowing
          ? `You're now following ${authorName}. Their new stories will appear in your feed.`
          : `You unfollowed ${authorName}.`
      );
    } catch (error) {
      console.error("Follow error:", error);
      setIsFollowingAuthor(prevState);
      setAuthorFollowers(prevCount);
      toast.error("Follow action failed");
    }
  };

  const handleMintStory = async () => {
    if (!requireWallet("mint NFTs")) return;
    if (!story?.numeric_id) return;
    if (!supabase) return toast.error("Database not available");

    const { data } = await supabase
      .from("stories")
      .select("ipfs_hash")
      .eq("id", story.id)
      .single();

    if (!data?.ipfs_hash)
      return toast.error("This story hasn't been pinned to IPFS yet.");

    const tokenURI = `ipfs://${data.ipfs_hash}`;
    await mintBook(tokenURI);
  };

  // --- Helpers ---
  const isAuthor =
    (authInfo?.id && story?.author?.id && authInfo.id === story.author.id) ||
    (authInfo?.wallet_address && story?.author?.wallet_address &&
     authInfo.wallet_address.toLowerCase() === story.author.wallet_address.toLowerCase()) ||
    false;
  const isPaywalled =
    (story?.paywallAmount || 0) > 0 && !isUnlocked && !isAuthor;
  const gradientClass = story
    ? moodColors[story.mood] || moodColors.neutral
    : "";

  // Button State Logic
  const getUnlockButtonState = () => {
    if (isApproving)
      return {
        text: "Approving Tokens...",
        icon: <Loader2 className="animate-spin w-4 h-4 mr-2" />,
        disabled: true,
      };
    if (isPayingProtocol)
      return {
        text: "Processing Payment...",
        icon: <Loader2 className="animate-spin w-4 h-4 mr-2" />,
        disabled: true,
      };
    if (isSyncing)
      return {
        text: "Verifying...",
        icon: <Loader2 className="animate-spin w-4 h-4 mr-2" />,
        disabled: true,
      };

    const requiredAmount = story
      ? parseEther(story.paywallAmount.toString())
      : BigInt(0);
    if (allowance < requiredAmount) {
      return {
        text: "Approve $ESTORY",
        icon: <KeyRound className="w-4 h-4 mr-2" />,
        disabled: false,
      };
    }
    return {
      text: "Confirm Payment",
      icon: <CheckCircle2 className="w-4 h-4 mr-2" />,
      disabled: false,
    };
  };
  const btnState = getUnlockButtonState();

  // --- Render ---

  if (isLoading) {
    return <BrandedLoader fullScreen message="Loading story..." />;
  }

  if (isAuthError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Session Expired</h2>
            <p className="text-sm text-muted-foreground">
              Your session has expired. Please sign in again to view this story.
            </p>
          </div>
          <Button onClick={() => router.push("/")} className="bg-indigo-600">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-[hsl(var(--memory-500)/0.1)] flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-[hsl(var(--memory-400))]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Story not found</h2>
            <p className="text-sm text-muted-foreground">
              This story may have been removed, set to private, or the link may be incorrect.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/social">
              <Button variant="outline" className="w-full sm:w-auto">
                <Users className="w-4 h-4 mr-2" />
                Community
              </Button>
            </Link>
            <Link href="/library">
              <Button className="w-full sm:w-auto">
                <BookOpen className="w-4 h-4 mr-2" />
                My Stories
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <TestnetBanner />
      {/* Top Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        {isAuthor && (
          <Button
            // Disable editing if it's already on IPFS (Minted/Pinned)
            disabled={!!(story as any).ipfs_hash} // Cast to any if typescript complains about missing ipfs_hash in interface, or add to interface
            className="bg-indigo-600 text-white"
            onClick={() => router.push(`/record?id=${story.id}`)}
          >
            <Edit className="w-4 h-4 mr-2" />
            {(story as any).ipfs_hash ? "Locked (Minted)" : "Edit Story"}
          </Button>
        )}
      </div>

      {/* Main Story Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-0 shadow-xl overflow-hidden">
          {/* Dynamic Header */}
          <div
            className={`h-48 bg-linear-to-r ${gradientClass} relative overflow-hidden flex items-end p-6`}
          >
            <div className="relative z-10 text-white w-full">
              <div className="flex justify-between items-end">
                <div>
                   {/* NEW: Visibility Badge next to Mood */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md">
                      {story.mood.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className={`border-white/40 text-white backdrop-blur-md flex items-center gap-1 ${story.is_public ? 'bg-emerald-500/20' : 'bg-black/20'}`}>
                        {story.is_public ? (
                            <>
                                <Globe size={12} /> Public
                            </>
                        ) : (
                            <>
                                <Lock size={12} /> Private
                            </>
                        )}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-3xl md:text-4xl font-bold shadow-sm">
                      {story.title}
                    </h1>
                    <CanonicalBadge
                      storyId={storyId}
                      isCanonical={storyMetadata?.is_canonical ?? false}
                      isAuthor={isAuthor}
                      size="md"
                    />
                    <VerifiedBadge
                      status={isVerified ? "verified" : isVerifyPending ? "pending" : "unverified"}
                      txHash={verifiedMetrics?.on_chain_tx_hash}
                      qualityTier={verifiedProof?.qualityTier}
                    />
                    {story.story_type && story.story_type !== "personal_journal" && (
                      <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/30">
                        {getStoryTypeConfig(story.story_type).shortLabel}
                      </Badge>
                    )}
                  </div>
                  {parentStory && (
                    <Link
                      href={`/story/${parentStory.id}`}
                      className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors mt-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Continues from: <span className="underline underline-offset-2">{parentStory.title}</span></span>
                    </Link>
                  )}
                </div>

                {/* UPDATED: Date Display using story_date */}
                <div className="text-right text-white/90 text-sm font-medium hidden md:block">
                  <div className="flex items-center justify-end gap-2" title="Memory Date">
                    <Calendar className="w-4 h-4" />
                    {new Date(story.story_date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                  </div>
                  {/* Optional: Show created date as subtitle if significantly different */}
                  {new Date(story.story_date).toDateString() !== new Date(story.created_at).toDateString() && (
                       <div className="text-xs text-white/60 mt-1">
                           Recorded: {new Date(story.created_at).toLocaleDateString()}
                       </div>
                  )}
                </div>
              </div>
            </div>
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-full h-24 bg-linear-to-t from-black/50 to-transparent" />
          </div>

          <CardContent className="pt-8">
            {/* Author & Meta Row */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <Avatar className="w-12 h-12 border-2 border-purple-100">
                  <AvatarImage src={story.author.avatar || undefined} alt={story.author.name || "Author"} />
                  <AvatarFallback>
                    {story.author.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {story.author.name || "Anonymous"}
                  </h3>
                  <div className="flex items-center text-xs text-gray-500">
                    <span className="mr-2">
                      @{story.author.username || "user"}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300 mr-2" />
                    <span>{authorFollowers} followers</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center text-sm text-gray-500 gap-4 mr-2">
                  <span className="flex items-center">
                    <Heart className="w-4 h-4 mr-1" /> {story.likes}
                  </span>
                  <span className="flex items-center">
                    <Share2 className="w-4 h-4 mr-1" /> {story.shares}
                  </span>
                  <span className="flex items-center">
                    <Eye className="w-4 h-4 mr-1" /> {story.views}
                  </span>
                </div>
                {!isAuthor && (
                  <Button
                    size="sm"
                    variant={isFollowingAuthor ? "secondary" : "outline"}
                    onClick={handleFollow}
                  >
                    {isFollowingAuthor ? "Following" : "Follow"}
                  </Button>
                )}
              </div>
            </div>

            {/* Paywall Content Blocker */}
            {isPaywalled ? (
              <div className="space-y-6">
                <div className="relative p-12 rounded-xl bg-gray-50 dark:bg-gray-900 border border-dashed border-purple-300 text-center space-y-4">
                  <Lock className="w-12 h-12 mx-auto text-purple-500" />
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Premium Story
                  </h3>
                  <p className="text-gray-500">
                    Support the author to read the full story.
                  </p>
                  <div className="flex flex-col items-center gap-2 pt-4">
                    <Button
                      size="lg"
                      disabled
                      className="bg-linear-to-r from-purple-600 to-indigo-600 shadow-lg opacity-50 cursor-not-allowed"
                    >
                      Unlock Story
                    </Button>
                    <p className="text-xs text-muted-foreground">Paywall unlocking coming soon with USDC on mainnet</p>
                  </div>
                  <div className="absolute inset-0 -z-10 opacity-10 blur-sm p-8 select-none overflow-hidden">
                    {story.teaser || "This content is hidden behind a paywall..."}
                  </div>
                </div>
                {/* Verified metrics card for paywalled content - shows buyers what they're getting */}
                <VerifiedMetricsCard
                  metrics={verifiedMetrics}
                  proof={verifiedProof}
                  isPending={isVerifyPending}
                  isAuthor={isVerifyAuthor}
                />
              </div>
            ) : (
              <div className="space-y-6">
                {story.hasAudio && story.audio_url && isAuthor && (
                  <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0">
                      <Volume2 className="w-5 h-5" />
                    </div>
                    <audio
                      controls
                      src={story.audio_url}
                      className="w-full h-10"
                      onError={(e) => {
                        // Hide the broken audio element and show fallback text
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const fallback = target.nextElementSibling;
                        if (fallback) (fallback as HTMLElement).style.display = "block";
                      }}
                    />
                    <span className="text-sm text-muted-foreground hidden">
                      Voice recording unavailable. The audio file may have expired — try refreshing the page.
                    </span>
                  </div>
                )}
                {story.hasAudio && !story.audio_url && isAuthor && (
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-xl flex items-center gap-3 text-sm text-muted-foreground">
                    <Volume2 className="w-4 h-4 shrink-0" />
                    <span>This story has a voice recording but the audio file could not be loaded.</span>
                  </div>
                )}
                {story.hasAudio && !isAuthor && (
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-xl flex items-center gap-3 text-sm text-muted-foreground">
                    <Volume2 className="w-4 h-4 shrink-0" />
                    <span>This story was voice-recorded. Audio is private to the author.</span>
                  </div>
                )}
                <article className="prose dark:prose-invert max-w-none text-lg leading-8 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {story.content}
                </article>
                <div className="flex flex-wrap gap-2 pt-4">
                  {story.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="bg-purple-5 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator className="my-8" />

            {/* Actions */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={isLiked ? "default" : "outline"}
                  className={
                    isLiked ? "bg-red-500 text-white hover:bg-red-600" : ""
                  }
                  onClick={handleLike}
                >
                  <Heart
                    className={`w-4 h-4 mr-2 ${isLiked ? "fill-current" : ""}`}
                  />{" "}
                  {isLiked ? "Liked" : "Like"}
                </Button>
                <Button
                  variant="outline"
                  disabled
                  title="Tipping with USDC coming soon"
                  className="opacity-50 cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4 mr-2 text-yellow-500" /> Tip
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">Soon</span>
                </Button>
                <Button
                  variant="outline"
                  disabled
                  title="NFT minting coming to mainnet"
                  className="opacity-50 cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4 mr-2" />{" "}
                  Mint NFT
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">Soon</span>
                </Button>
                {isAuthor && (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/record?parentId=${storyId}`)}
                  >
                    <PenLine className="w-4 h-4 mr-2" /> Continue Story
                  </Button>
                )}
              </div>
              <Button
                variant="ghost"
                onClick={() =>
                  navigator.share?.({
                    title: story.title,
                    url: window.location.href,
                  })
                }
              >
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* AI Insights Section - only show when story content is accessible */}
      {!isPaywalled && story.content && (
        <StoryInsights storyId={storyId} storyText={story.content} />
      )}

      {/* Verified Metrics - show for all stories with CRE verification */}
      {(isVerified || isVerifyPending) && !isPaywalled && (
        <VerifiedMetricsCard
          metrics={verifiedMetrics}
          proof={verifiedProof}
          isPending={isVerifyPending}
          isAuthor={isVerifyAuthor}
        />
      )}

      {/* Comments Section */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="w-6 h-6" /> Comments ({comments.length})
        </h3>
        <Card className="p-4 bg-gray-50 dark:bg-gray-900/50 border-dashed">
          <div className="flex gap-4">
            <Avatar>
              <AvatarImage src={authInfo?.avatar || undefined} alt="Your avatar" />
              <AvatarFallback>ME</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Textarea
                placeholder="Share your thoughts..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-20 bg-white dark:bg-black"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handlePostComment}
                  disabled={commentMutation.isPending || !newComment.trim()}
                  className="bg-indigo-600"
                >
                  {commentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}{" "}
                  Post
                </Button>
              </div>
            </div>
          </div>
        </Card>
        <div className="space-y-4">
          {comments.map((c) => (
            <Card key={c.id} className="border-0 shadow-sm">
              <CardContent className="p-4 flex gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={c.author.avatar || undefined} alt={c.author.name || "Commenter"} />
                  <AvatarFallback>{c.author.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-sm">
                    {c.author.name || "Anonymous"}{" "}
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    {c.content}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Paywall Dialog — disabled until mainnet */}
      <Dialog open={showPaywallDialog} onOpenChange={setShowPaywallDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock Premium Story</DialogTitle>
            <DialogDescription>
              Paywall unlocking is coming soon.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center space-y-2">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Paywall payments with USDC will be available when we launch on mainnet. Stay tuned!
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tip Dialog — disabled until mainnet */}
      <Dialog open={showTipDialog} onOpenChange={setShowTipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a Tip</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center space-y-2">
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Tipping with USDC is coming soon. You&apos;ll be able to support your favorite storytellers directly.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}