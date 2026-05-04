"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import {
  useProfileData,
  useUserStories,
  useUserBooksCount,
} from "@/lib/queries/hooks";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { toast } from "react-hot-toast";

import { useApp } from "../../components/Provider";
import { useAuth } from "../../components/AuthProvider";
import { emailService } from "../utils/emailService";
import { useStoryNFT } from "../hooks/useStoryNFT";
import { useWalletGuard } from "../hooks/useWalletGuard";
import { supabaseClient } from "../utils/supabase/supabaseClient";
import { ipfsService } from "../utils/ipfsService";
import { useBackgroundMode } from "@/contexts/BackgroundContext";
import { useSignMessage } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { VaultSettings } from "@/components/vault/VaultSettings";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

import {
  User,
  Settings,
  Award,
  Link,
  Wallet,
  Check,
  Chrome,
  Heart,
  Eye,
  BookOpen,
  Coins,
  Save,
  Trophy,
  Target,
  Clock,
  Zap,
  Shield,
  Loader2,
  Edit3,
  Sparkles,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { BrandedLoader } from "@/components/ui/branded-loader";

import { WeeklyReflectionSection } from "@/components/WeeklyReflection";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// --- Types ---
interface UserProfileData {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatar: string | null;
  created_at?: string;
  notification_preferences?: {
    email_notifications?: boolean;
    public_profile?: boolean;
    ai_enhancement?: boolean;
    re_engagement_emails?: boolean;
  } | null;
}

type ProfileFormData = {
  name: string;
  username: string;
  bio: string;
  location: string;
  website: string;
  avatar: string;
  email: string;
};

// Helper for truncation
const truncateAddress = (addr: string | undefined | null) => {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

// Helper for Heatmap color - uses growth color scale
const getHeatmapColor = (count: number) => {
  if (count === 0) return "bg-gray-100 dark:bg-gray-800";
  if (count === 1) return "bg-[hsl(var(--growth-200))] dark:bg-[hsl(var(--growth-900)/0.6)]";
  if (count <= 3) return "bg-[hsl(var(--growth-400))] dark:bg-[hsl(var(--growth-700))]";
  return "bg-[hsl(var(--growth-600))] dark:bg-[hsl(var(--growth-500))]";
};

export default function ProfilePage() {
  const { user: wagmiUser, isConnected } = useApp();
  const { address } = useAccount();
  const { profile: authInfo, signInWithGoogle, refreshProfile, getAccessToken, isLoading: isAuthLoading } = useAuth();
  const supabase = supabaseClient;
  const { signMessageAsync } = useSignMessage();
  const { openConnectModal } = useConnectModal();

  // Set background mode for this page
  useBackgroundMode('profile');

  const { mintBook, isPending: isMinting } = useStoryNFT();
  const { requireWallet } = useWalletGuard();

  const queryClient = useQueryClient();

  // React Query hooks
  const {
    data: profileQueryData,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useProfileData(authInfo?.id || "");
  const {
    data: storiesData,
    isLoading: isStoriesLoading,
    isError: isStoriesError,
  } = useUserStories();
  const {
    data: booksCount,
    isLoading: isBooksCountLoading,
    isError: isBooksError,
  } = useUserBooksCount(authInfo?.id || "");

  const profileData = profileQueryData as UserProfileData | null;
  const stories = useMemo(() => storiesData?.stories || [], [storiesData]);

  // Derived stats & activity
  const {
    stats,
    activityData,
    heatmapData,
    achievements,
    todaysStories,
  } = useMemo(() => {
    const now = new Date();
    const totalLikes = stories.reduce((sum, s) => sum + (s.likes || 0), 0);

    const activityMap = new Map<string, number>();
    stories.forEach((s) => {
      const date = new Date(s.created_at).toISOString().split("T")[0];
      activityMap.set(date, (activityMap.get(date) || 0) + 1);
    });

    // Monthly Stories
    const monthlyStories = stories.filter((s) => {
      const d = new Date(s.created_at);
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }).length;

    // Streak Logic
    let currentStreak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      if (activityMap.has(dateStr)) {
        currentStreak++;
      } else if (
        i > 0 &&
        activityMap.has(new Date().toISOString().split("T")[0]) === false
      ) {
        if (i > 1) break;
      } else {
        break;
      }
    }

    const computedStats = {
      stories: stories.length,
      books: booksCount || 0,
      likes: totalLikes,
      views: stories.reduce((sum, s) => sum + ((s as any).view_count || 0), 0),
      monthlyStories,
      streak: currentStreak,
    };

    // Activity List Data (Last 14 Days)
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - i);
      return d.toISOString().split("T")[0];
    });

    const listData = last14Days
      .map((date) => {
        const dayStories = stories.filter((s) =>
          s.created_at.startsWith(date)
        );
        const likes = dayStories.reduce(
          (acc, s) => acc + (s.likes || 0),
          0
        );
        const entries = dayStories.length;
        const views = dayStories.reduce(
          (acc, s) => acc + ((s as any).view_count || 0),
          0
        );
        return { date, entries, likes, views };
      })
      .filter((d) => d.entries > 0);

    // Heatmap Data (Last ~52 weeks)
    const heatmap = [];
    for (let i = 371; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      heatmap.push({
        date: dateStr,
        count: activityMap.get(dateStr) || 0,
      });
    }

    // Achievements
    const computedAchievements = [
      {
        id: 1,
        name: "First Story",
        description: "Recorded your first journal entry",
        earned: stories.length > 0,
        date: stories[stories.length - 1]?.created_at,
      },
      {
        id: 2,
        name: "Prolific Writer",
        description: "Recorded 10+ stories",
        earned: stories.length >= 10,
        date: null,
      },
      {
        id: 3,
        name: "Community Star",
        description: "Received 50+ total likes",
        earned: totalLikes >= 50,
        date: null,
      },
      {
        id: 4,
        name: "Book Author",
        description: "Compiled your first digital book",
        earned: (booksCount || 0) > 0,
        date: null,
      },
      {
        id: 5,
        name: "Daily Grinder",
        description: "Wrote 3 stories in one day",
        earned: Math.max(...Array.from(activityMap.values()), 0) >= 3,
        date: null,
      },
      {
        id: 6,
        name: "Vocalist",
        description: "Recorded a story with audio",
        earned: stories.some((s) => s.audio_url),
        date: null,
      },
    ];

    // Today's Stories
    const todayStr = now.toISOString().split("T")[0];
    const todays = stories.filter((s) => s.created_at.startsWith(todayStr));

    return {
      stats: computedStats,
      activityData: listData,
      heatmapData: heatmap,
      achievements: computedAchievements,
      todaysStories: todays,
    };
  }, [stories, booksCount]);

  const [formData, setFormData] = useState<ProfileFormData>({
    name: "",
    username: "",
    bio: "",
    location: "",
    website: "",
    avatar: "",
    email: "",
  });

  // Preferences State (Local UI state for now)
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    publicProfile: true,
    aiEnhancement: true,
    reEngagementEmails: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [currentTab, setCurrentTab] = useState("overview");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const isLoading = isAuthLoading || isProfileLoading || isStoriesLoading || isBooksCountLoading;
  const isDataError = isProfileError || isStoriesError || isBooksError;

  // Track intent to link wallet — when user clicks "Connect Wallet" and
  // the RainbowKit modal opens, we need to auto-continue after they connect
  const pendingWalletLinkRef = useRef(false);

  const performWalletLink = async () => {
    if (!authInfo?.id || !address) return;
    setIsLinkingWallet(true);
    try {
      const message = `Link wallet ${address.toLowerCase()} to eStories account ${authInfo.id}`;
      const signature = await signMessageAsync({ message });
      const token = await getAccessToken();
      const res = await fetch("/api/auth/link-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: authInfo.id,
          walletAddress: address,
          signature,
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Linking failed");
      toast.success("Wallet linked successfully!");
      await refreshProfile();
    } catch (err: any) {
      if (err.message?.includes("User rejected")) {
        toast.error("Signature rejected");
      } else {
        toast.error(err.message || "Failed to link wallet");
      }
    } finally {
      setIsLinkingWallet(false);
    }
  };

  const handleLinkWallet = async () => {
    if (!authInfo?.id) return toast.error("Sign in required");
    if (!address) {
      // No wallet connected yet — open modal and remember intent
      pendingWalletLinkRef.current = true;
      openConnectModal?.();
      return;
    }
    await performWalletLink();
  };

  // Auto-continue wallet linking after user connects via RainbowKit modal
  useEffect(() => {
    if (pendingWalletLinkRef.current && address && authInfo?.id) {
      pendingWalletLinkRef.current = false;
      performWalletLink();
    }
  }, [address, authInfo?.id]);

  const handleLinkGoogle = async () => {
    if (!authInfo?.id || !address) {
      toast.error("Wallet must be connected to link Google");
      return;
    }

    setIsLinkingGoogle(true);
    try {
      // Step 1: Sign message to prove wallet ownership
      const message = `Link Google account to eStories wallet ${address.toLowerCase()}\n\nTimestamp: ${Date.now()}`;
      const signature = await signMessageAsync({ message });

      // Step 2: Get secure linking token from server
      const res = await fetch("/api/auth/initiate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authInfo.id,
          walletAddress: address,
          signature,
          message,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate linking");
      }

      // Step 3: Store token in sessionStorage for AuthProvider to use after OAuth
      sessionStorage.setItem("googleLinkingToken", data.linkingToken);
      sessionStorage.setItem("googleLinkingUserId", authInfo.id);

      // Step 4: Start OAuth flow
      await signInWithGoogle();
      // OAuth redirect will handle the rest
    } catch (err: any) {
      sessionStorage.removeItem("googleLinkingToken");
      sessionStorage.removeItem("googleLinkingUserId");
      if (err.message?.includes("User rejected") || err.code === "ACTION_REJECTED") {
        toast.error("Signature rejected");
      } else {
        toast.error(err.message || "Failed to start Google linking");
      }
      setIsLinkingGoogle(false);
    }
  };

  // --- Sync Form + Preferences ---
  useEffect(() => {
    if (profileData) {
      setFormData({
        name: profileData.name || "",
        username: profileData.username || "",
        bio: profileData.bio || "",
        location: profileData.location || "",
        website: profileData.website || "",
        avatar: profileData.avatar || "",
        email: profileData.email || "",
      });
      // Load notification preferences from DB (with fallbacks)
      const dbPrefs = profileData.notification_preferences;
      if (dbPrefs && typeof dbPrefs === "object") {
        setPreferences({
          emailNotifications: dbPrefs.email_notifications ?? true,
          publicProfile: dbPrefs.public_profile ?? true,
          aiEnhancement: dbPrefs.ai_enhancement ?? true,
          reEngagementEmails: dbPrefs.re_engagement_emails ?? true,
        });
      }
    }
  }, [profileData]);

  // --- Actions ---

  const handleSaveProfile = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!supabase || !authInfo?.id) return toast.error("Not authenticated");

  setIsSaving(true);
  try {
    const { error } = await supabase
      .from("users")
      .update(formData)
      .eq("id", authInfo.id);

    if (error) throw error;

    // --- NEW: Check if we should send a welcome email ---
    // Logic: If email is present AND different from what we had (or it's first setup)
    if (formData.email && formData.email !== profileData?.email && preferences.emailNotifications) {
       toast.promise(
         emailService.sendWelcomeEmail(formData.email, formData.name || "Writer", await getAccessToken()),
         {
           loading: 'Sending confirmation email...',
           success: 'Profile saved & Email sent!',
           error: 'Profile saved, but email failed.',
         }
       );
    } else {
       toast.success("Profile updated!");
    }
    // ---------------------------------------------------

    queryClient.invalidateQueries({ queryKey: queryKeys.user.profile(authInfo.id) });
    setCurrentTab("overview");
  } catch (err: any) {
    toast.error(`Save failed: ${err.message}`);
  } finally {
    setIsSaving(false);
  }
};

  const togglePreference = async (key: keyof typeof preferences) => {
    const newPrefs = { ...preferences, [key]: !preferences[key] };
    setPreferences(newPrefs);

    // Persist to database
    if (supabase && authInfo?.id) {
      const dbPrefs = {
        email_notifications: newPrefs.emailNotifications,
        public_profile: newPrefs.publicProfile,
        ai_enhancement: newPrefs.aiEnhancement,
        re_engagement_emails: newPrefs.reEngagementEmails,
      };
      const { error } = await supabase
        .from("users")
        .update({ notification_preferences: dbPrefs })
        .eq("id", authInfo.id);

      if (error) {
        console.error("[PROFILE] Preference save error:", error);
        // Revert on failure
        setPreferences(preferences);
        toast.error("Failed to save preference");
        return;
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile(authInfo.id) });
    }
    toast.success("Preference updated");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setIsDeleting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not authenticated");
        return;
      }
      const res = await fetch("/api/user", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete account");
        return;
      }
      toast.success("Account deleted successfully");
      setDeleteConfirmOpen(false);
      // Sign out and redirect
      window.localStorage.clear();
      window.location.href = "/";
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCompileDailyJournal = async () => {
    if (!requireWallet("mint a Daily Journal NFT")) return;
    if (todaysStories.length < 2) return toast.error("Need at least 2 stories today to compile.");
    if (!authInfo?.id || !supabase) return;

    const toastId = toast.loading("Compiling Daily Journal...");

    try {
       // 1. Create Metadata
       const dateStr = new Date().toLocaleDateString();
       const metadata = {
           name: `Daily Journal - ${dateStr}`,
           description: `A collection of ${todaysStories.length} moments captured on ${dateStr}.`,
           external_url: "https://estories.app",
           attributes: [
               { trait_type: "Author", value: authInfo.name },
               { trait_type: "Date", value: dateStr },
               { trait_type: "Type", value: "Daily Journal" }
           ],
           stories: todaysStories.map(s => ({ title: s.title, content: s.content, date: s.created_at }))
       };

       // 2. Upload to IPFS
       const ipfsResult = await ipfsService.uploadMetadata(metadata, await getAccessToken());
       if(!ipfsResult?.hash) throw new Error("IPFS upload failed");
       
       // 3. Mint
       await mintBook(`ipfs://${ipfsResult.hash}`);

       // 4. Save to DB
       const bookData = {
           author_id: authInfo.id,
           author_wallet: authInfo.wallet_address,
           title: `Daily Journal - ${dateStr}`,
           description: `Reflections from ${dateStr}`,
           story_ids: todaysStories.map(s => s.id),
           ipfs_hash: ipfsResult.hash,
       };

       const { error } = await supabase.from("books").insert([bookData]);
       if (error) throw error;

       toast.success("Daily Journal Minted!", { id: toastId });

       // Refresh stats
       queryClient.invalidateQueries({ queryKey: queryKeys.library.books(authInfo.id) });

    } catch (err: any) {
        console.error(err);
        const msg = err.message || "Failed";
        if (msg.includes("User rejected")) toast.error("Minting cancelled", { id: toastId });
        else toast.error("Failed to compile journal", { id: toastId });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  // --- Render ---

  if (!isConnected && !authInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <User className="w-12 h-12 text-[hsl(var(--memory-500))]" />
        <h2 className="text-2xl font-semibold">Sign In to View Profile</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          Connect your wallet or sign in with Google to view or edit your profile.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <BrandedLoader size="md" message="Loading your profile..." />
      </div>
    );
  }

  if (isDataError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500" />
        <h2 className="text-2xl font-semibold">Failed to Load Profile</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          We couldn&apos;t load your profile data. This may be due to a session issue. Try refreshing the page or signing in again.
        </p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Refresh Page
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 mx-auto bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] rounded-full flex items-center justify-center shadow-lg"
        >
          <User className="w-8 h-8 text-white" />
        </motion.div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
          Profile & <span className="text-gradient-memory">Settings</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Manage your account, track your progress, and view your achievements
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 sticky">
          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-0 shadow-xl top-24">
            <CardHeader className="text-center">
              <Avatar className="h-24 w-24 mx-auto">
                <AvatarImage
                  src={profileData?.avatar || "/default-avatar.jpg"}
                  alt={profileData?.name || "User"}
                />
                <AvatarFallback>
                  {profileData?.name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="flex flex-col items-center space-y-3">
                <>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {profileData?.name || "Unnamed User"}
                  </h2>
                  {profileData?.bio && (
                    <p className="text-sm text-muted-foreground text-center max-w-xs">
                      {profileData?.bio}
                    </p>
                  )}
                  {profileData?.location && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      📍 {profileData?.location}
                    </p>
                  )}
                  {profileData?.website && (
                    <a
                      href={profileData?.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline"
                    >
                      🌐 Website
                    </a>
                  )}
                </>
              </div>
              
              <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Wallet</span>
                  <span className="text-sm font-mono text-gray-900 dark:text-white">
                    {truncateAddress(address)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Balance</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {wagmiUser?.balance || "0"} ETH
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Member Since</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {profileData?.created_at
                      ? new Date(profileData.created_at).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
              </div>

              <Button
                onClick={() => setCurrentTab("settings")}
                className="w-full bg-linear-to-r from-purple-600 to-indigo-600"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="mt-6 bg-linear-to-r from-emerald-500/10 to-teal-500/10 border-emerald-200 dark:border-emerald-800">
            <CardHeader>
              <CardTitle className="text-lg">Your Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center space-y-1">
                    <BookOpen className="w-5 h-5 mx-auto text-purple-600" />
                    <div className="text-lg font-bold">{stats.stories}</div>
                    <div className="text-xs text-gray-500">Stories</div>
                </div>
                <div className="text-center space-y-1">
                    <Heart className="w-5 h-5 mx-auto text-red-500" />
                    <div className="text-lg font-bold">{stats.likes}</div>
                    <div className="text-xs text-gray-500">Likes</div>
                </div>
                <div className="text-center space-y-1">
                    <Eye className="w-5 h-5 mx-auto text-blue-600" />
                    <div className="text-lg font-bold">{stats.views}</div>
                    <div className="text-xs text-gray-500">Views</div>
                </div>
                <div className="text-center space-y-1">
                    <Coins className="w-5 h-5 mx-auto text-emerald-600" />
                    <div className="text-lg font-bold">{stats.books}</div>
                    <div className="text-xs text-gray-500">Books</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <div className="lg:col-span-2">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="achievements">Achievements</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* 1. Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Daily Journal Compilation Feature */}
              {todaysStories.length > 1 && (
                 <Card className="bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-dashed border-purple-300">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                            <Sparkles className="w-5 h-5" /> Daily Recap Available
                        </CardTitle>
                        <CardDescription>
                            You have recorded <strong>{todaysStories.length} stories</strong> today. Would you like to bundle them into a Daily Journal NFT?
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            disabled
                            className="w-full bg-purple-600/50 text-white cursor-not-allowed"
                            title="NFT minting coming to mainnet"
                        >
                            <BookOpen className="w-4 h-4 mr-2"/>
                            Compile Daily Journal (Coming to Mainnet)
                        </Button>
                    </CardContent>
                 </Card>
              )}

              <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="w-5 h-5" />
                    <span>Writing Goals</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Daily Writing Streak</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{stats.streak} days</span>
                    </div>
                    <Progress value={Math.min((stats.streak / 7) * 100, 100)} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Monthly Stories</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{stats.monthlyStories}/10 stories</span>
                    </div>
                    <Progress value={Math.min((stats.monthlyStories / 10) * 100, 100)} className="h-2" />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Community Engagement</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{stats.likes}/100 likes</span>
                    </div>
                    <Progress value={Math.min((stats.likes / 100) * 100, 100)} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Reflection Section */}
              <ErrorBoundary fallbackMessage="Unable to load weekly reflection">
                <WeeklyReflectionSection />
              </ErrorBoundary>
            </TabsContent>

            {/* 2. Achievements Tab */}
            <TabsContent value="achievements" className="space-y-6">
              <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <span>Your Achievements</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {achievements.map((achievement) => (
                      <div
                        key={achievement.id}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          achievement.earned
                            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
                            : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60"
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${achievement.earned ? "bg-emerald-100 dark:bg-emerald-900" : "bg-gray-200 dark:bg-gray-700"}`}>
                            <Award className={`w-5 h-5 ${achievement.earned ? "text-emerald-600" : "text-gray-400"}`} />
                          </div>
                          <div>
                            <h4 className="font-medium">{achievement.name}</h4>
                            <p className="text-xs text-gray-500">{achievement.description}</p>
                            {achievement.earned && achievement.date && <p className="text-[10px] text-emerald-600 mt-1">Earned: {new Date(achievement.date).toLocaleDateString()}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          {/* 3. Activity Tab (With Heatmap & List) */}
            <TabsContent value="activity" className="space-y-6">
              <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="w-5 h-5" />
                    <span>Contribution Heatmap</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Heatmap Grid - GitHub Style */}
                  <div className="flex flex-col space-y-2 mb-8">
                    {/* Dynamic Month Labels */}
                    <div className="flex justify-between px-8 text-xs text-gray-400 select-none">
                      {(() => {
                        const today = new Date();
                        const labels = [];
                        // Show 12 months spanning the grid range
                        for (let i = 11; i >= 0; i--) {
                          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                          const label = d.toLocaleDateString('en-US', { month: 'short' });
                          // Show year on Jan or first label
                          const showYear = d.getMonth() === 0 || i === 11;
                          labels.push(
                            <span key={i} className="text-center">
                              {label}{showYear ? ` '${String(d.getFullYear()).slice(2)}` : ''}
                            </span>
                          );
                        }
                        return labels;
                      })()}
                    </div>

                    <div className="flex gap-1 sm:gap-2 items-start overflow-x-auto pb-2">
                      {/* Weekday Labels */}
                      <div className="grid grid-rows-7 gap-[3px] sm:gap-1 text-[10px] text-gray-400 leading-2.5 pt-0.5 select-none shrink-0">
                        <span className="h-2 sm:h-2.5"></span>
                        <span className="h-2 sm:h-2.5">Mon</span>
                        <span className="h-2 sm:h-2.5"></span>
                        <span className="h-2 sm:h-2.5">Wed</span>
                        <span className="h-2 sm:h-2.5"></span>
                        <span className="h-2 sm:h-2.5">Fri</span>
                        <span className="h-2 sm:h-2.5"></span>
                      </div>

                      {/* Grid Container */}
                      <div className="grid grid-rows-7 grid-flow-col gap-[3px] sm:gap-1">
                        {(() => {
                          // 1. Generate a calendar for the last ~365 days aligned to Sunday
                          const today = new Date();
                          const days = [];
                          
                          // Start roughly 52 weeks ago
                          const startDate = new Date(today);
                          startDate.setDate(today.getDate() - 364);
                          
                          // Rewind start date to the previous Sunday to align with grid rows (Row 1 = Sun)
                          while (startDate.getDay() !== 0) {
                            startDate.setDate(startDate.getDate() - 1);
                          }

                          // Fill array until today
                          const iterDate = new Date(startDate);
                          // Add a few extra days to finish the week if needed, or stop at today
                          while (iterDate <= today || iterDate.getDay() !== 0) { 
                             if (iterDate > today && iterDate.getDay() === 0) break;
                             days.push(new Date(iterDate));
                             iterDate.setDate(iterDate.getDate() + 1);
                          }

                          // 2. Map visual grid
                          return days.map((date, i) => {
                            const dateStr = date.toISOString().split('T')[0];
                            
                            // Find match in your existing heatmapData
                            // Assumes heatmapData has { date: "YYYY-MM-DD", count: number }
                            const match = heatmapData.find(d => d.date.startsWith(dateStr));
                            const count = match ? match.count : 0;

                            return (
                              <div
                                key={i}
                                title={`${date.toDateString()}: ${count} stories`}
                                className={`w-2 h-2 sm:w-3 sm:h-3 rounded-[4px] sm:rounded-[6px] ${getHeatmapColor(count)}`}
                              />
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Recent List */}
                  <h3 className="text-sm font-semibold mb-4 text-gray-500">Recent Activity</h3>
                  <div className="space-y-4">
                    {activityData.length > 0 ? (
                      activityData.map((day) => (
                        <div
                          key={day.date}
                          className="border-l-4 border-purple-200 dark:border-purple-800 pl-4 py-2"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {new Date(day.date).toLocaleDateString("en-US", {
                                  weekday: "long",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </h4>
                              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                                <span className="flex items-center space-x-1">
                                  <BookOpen className="w-3 h-3" />
                                  <span>{day.entries} entries</span>
                                </span>
                                <span className="flex items-center space-x-1">
                                  <Heart className="w-3 h-3" />
                                  <span>{day.likes} likes</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-gray-500 py-4">
                        No recent activity recorded.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 4. Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>Profile Settings</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveProfile} className="space-y-4 mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Display Name</Label>
                            <Input id="name" value={formData.name} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input id="username" value={formData.username} onChange={handleInputChange} />
                        </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea id="bio" value={formData.bio} onChange={handleInputChange} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input id="location" value={formData.location} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="website">Website</Label>
                            <Input id="website" value={formData.website} onChange={handleInputChange} />
                        </div>
                    </div>
                    <Button type="submit" disabled={isSaving} className="w-full bg-linear-to-r from-purple-600 to-indigo-600">
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Changes
                    </Button>
                  </form>
                  
                  {/* Linked Accounts Section */}
                  <div className="space-y-4 border-t pt-6 dark:border-gray-700">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Link className="w-5 h-5" /> Linked Accounts
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Link both Google and Web3 wallet for a unified experience.
                      </p>

                      {/* Google Account */}
                      {(() => {
                        // Check actual linked status from google_id field (more reliable than auth_provider)
                        const isGoogleLinked = Boolean(authInfo?.google_id) || authInfo?.auth_provider === "google" || authInfo?.auth_provider === "both";
                        return (
                          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isGoogleLinked
                                  ? "bg-green-100 dark:bg-green-900/30"
                                  : "bg-gray-200 dark:bg-gray-700"
                              }`}>
                                <Chrome className={`w-5 h-5 ${
                                  isGoogleLinked ? "text-green-600" : "text-gray-400"
                                }`} />
                              </div>
                              <div>
                                <p className="font-medium text-sm">Google Account</p>
                                {isGoogleLinked ? (
                                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Linked{authInfo?.email && !authInfo.email.endsWith("@wallet.local") ? ` (${authInfo.email})` : ""}
                                  </p>
                                ) : (
                                  <p className="text-xs text-gray-500">Not linked</p>
                                )}
                              </div>
                            </div>
                            {!isGoogleLinked && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleLinkGoogle}
                                disabled={isLinkingGoogle || !address}
                                title={!address ? "Connect wallet first" : undefined}
                              >
                                {isLinkingGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link Google"}
                              </Button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Web3 Wallet */}
                      {(() => {
                        // Check actual linked status from wallet_address field (more reliable than auth_provider)
                        const isWalletLinked = Boolean(authInfo?.wallet_address) || authInfo?.auth_provider === "wallet" || authInfo?.auth_provider === "both";
                        return (
                          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isWalletLinked
                                  ? "bg-green-100 dark:bg-green-900/30"
                                  : "bg-gray-200 dark:bg-gray-700"
                              }`}>
                                <Wallet className={`w-5 h-5 ${
                                  isWalletLinked ? "text-green-600" : "text-gray-400"
                                }`} />
                              </div>
                              <div>
                                <p className="font-medium text-sm">Web3 Wallet</p>
                                {isWalletLinked ? (
                                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Linked ({truncateAddress(authInfo?.wallet_address || address)})
                                  </p>
                                ) : (
                                  <p className="text-xs text-gray-500">Not linked</p>
                                )}
                              </div>
                            </div>
                            {!isWalletLinked && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleLinkWallet}
                                disabled={isLinkingWallet}
                              >
                                {isLinkingWallet ? <Loader2 className="w-4 h-4 animate-spin" /> : !address ? "Connect Wallet" : "Link Wallet"}
                              </Button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Show success message when both are truly linked */}
                      {Boolean(authInfo?.google_id) && Boolean(authInfo?.wallet_address) && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Both accounts linked. You can sign in with either Google or wallet.
                          </p>
                        </div>
                      )}
                  </div>

                  {/* Local Vault Section */}
                  <div className="space-y-4 border-t pt-6 dark:border-gray-700">
                    <VaultSettings />
                  </div>

                  {/* Preferences Section */}
                  <div className="space-y-4 border-t pt-6 dark:border-gray-700">
                      <h3 className="text-lg font-semibold">Preferences</h3>

                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="space-y-0.5">
                              <Label className="text-base">Email Notifications</Label>
                              <p className="text-xs text-gray-500">Receive updates about new followers and tips.</p>
                          </div>
                          <Button variant={preferences.emailNotifications ? "default" : "outline"} onClick={() => togglePreference("emailNotifications")} size="sm">
                             {preferences.emailNotifications ? "Enabled" : "Disabled"}
                          </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="space-y-0.5">
                              <Label className="text-base">Public Profile</Label>
                              <p className="text-xs text-gray-500">Allow others to see your stories on the social feed.</p>
                          </div>
                          <Button variant={preferences.publicProfile ? "default" : "outline"} onClick={() => togglePreference("publicProfile")} size="sm">
                             {preferences.publicProfile ? <Eye className="w-4 h-4 mr-2"/> : <Shield className="w-4 h-4 mr-2"/>}
                             {preferences.publicProfile ? "Public" : "Private"}
                          </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="space-y-0.5">
                              <Label className="text-base">AI Enhancements</Label>
                              <p className="text-xs text-gray-500">Automatically suggest improvements for your stories.</p>
                          </div>
                          <Button variant={preferences.aiEnhancement ? "default" : "outline"} onClick={() => togglePreference("aiEnhancement")} size="sm">
                             {preferences.aiEnhancement ? <Zap className="w-4 h-4 mr-2 fill-current"/> : "Disabled"}
                             {preferences.aiEnhancement ? "On" : "Off"}
                          </Button>
                      </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="space-y-4 border-t border-red-200 dark:border-red-900/50 pt-6">
                    <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Danger Zone
                    </h3>
                    <div className="p-4 border border-red-200 dark:border-red-900/50 rounded-lg bg-red-50/50 dark:bg-red-950/20">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">Delete Account</p>
                          <p className="text-xs text-muted-foreground">
                            Permanently delete your account and all associated data.
                            On-chain data (NFTs, transactions) will persist on the blockchain.
                          </p>
                        </div>
                        <Dialog open={deleteConfirmOpen} onOpenChange={(open) => {
                          setDeleteConfirmOpen(open);
                          if (!open) setDeleteConfirmText("");
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Account
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2 text-red-600">
                                <AlertTriangle className="w-5 h-5" />
                                Delete Account
                              </DialogTitle>
                              <DialogDescription>
                                This action cannot be undone. This will permanently delete your
                                account, stories, collections, and all associated data.
                                On-chain data (NFTs, transactions, verified metrics) will persist
                                on the blockchain.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2 py-4">
                              <Label htmlFor="delete-confirm" className="text-sm">
                                Type <strong>DELETE</strong> to confirm:
                              </Label>
                              <Input
                                id="delete-confirm"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="DELETE"
                                className="font-mono"
                              />
                            </div>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setDeleteConfirmOpen(false)}
                                disabled={isDeleting}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={handleDeleteAccount}
                                disabled={deleteConfirmText !== "DELETE" || isDeleting}
                              >
                                {isDeleting ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  "Permanently Delete"
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}