"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";

import { useApp } from "../../components/Provider";
import { useAuth } from "../../components/AuthProvider";
import { useStoryNFT } from "../hooks/useStoryNFT";
import { usePatterns } from "../hooks/usePatterns";
import {
  useUserStories,
  useUserBooks,
  useLibraryCollections,
  useCreateCollection,
  useDeleteCollection,
} from "@/lib/queries/hooks";
import { supabaseClient } from "../utils/supabase/supabaseClient";
import { ipfsService } from "../utils/ipfsService";
import { useBackgroundMode } from "@/contexts/BackgroundContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BookOpen,
  Search,
  Calendar,
  Heart,
  Eye,
  Download,
  Share2,
  Plus,
  Sparkles,
  FileText,
  Volume2,
  Loader2,
  CheckCircle2,
  X,
  Archive,
  Globe,
  Lock,
  Star,
  Tags,
  Compass,
  ChevronDown,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { BrandedLoader } from "@/components/ui/branded-loader";
import { moodColors, StoryWithMetadata, StoryCollection } from "../types/index";

// Import pattern components
import { ThemesView } from "@/components/patterns/ThemesView";
import { DomainsView } from "@/components/patterns/DomainsView";

// --- Types ---
interface BaseEntry {
  id: string;
  title: string;
  created_at: string;
  likes: number;
  views: number;
  mood?: string;
  tags?: string[];
}

interface StoryEntry extends BaseEntry {
  type: "entry";
  content: string;
  has_audio: boolean;
  audio_url: string | null;
  is_public: boolean;
  story_date: string;
}

interface BookEntry extends BaseEntry {
  type: "book";
  description: string;
  story_ids: string[];
  ipfs_hash?: string;
}

type LibraryItem = StoryEntry | BookEntry;

interface MonthGroup {
  key: string; // "2026-03"
  label: string; // "March 2026"
  entries: LibraryItem[];
  storyCount: number;
  bookCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getEntryDate(entry: LibraryItem): Date {
  if (entry.type === "entry") return new Date(entry.story_date);
  return new Date(entry.created_at);
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function groupByMonth(entries: LibraryItem[]): MonthGroup[] {
  const map = new Map<string, LibraryItem[]>();
  entries.forEach((entry) => {
    const date = getEntryDate(entry);
    const key = getMonthKey(date);
    const arr = map.get(key) || [];
    arr.push(entry);
    map.set(key, arr);
  });

  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) // newest months first
    .map(([key, items]) => {
      const date = getEntryDate(items[0]);
      return {
        key,
        label: getMonthLabel(date),
        entries: items,
        storyCount: items.filter((e) => e.type === "entry").length,
        bookCount: items.filter((e) => e.type === "book").length,
      };
    });
}

function isCurrentMonth(key: string): boolean {
  const now = new Date();
  return key === getMonthKey(now);
}

// ─── Main Component ───────────────────────────────────────────────────

export default function LibraryPage() {
  const { isConnected } = useApp();
  const { profile: authInfo, getAccessToken, isLoading: isAuthLoading } = useAuth();
  const supabase = supabaseClient;
  const router = useRouter();

  useBackgroundMode("library");

  // Blockchain Hook
  const { mintBook, isPending: isMinting } = useStoryNFT();

  // Patterns Hook
  const {
    stories: patternStories,
    themeGroups,
    domainGroups,
    canonicalStories,
    isLoading: patternsLoading,
  } = usePatterns();

  // React Query data hooks
  const { data: storiesData, isLoading: isStoriesLoading } = useUserStories();
  const { data: booksData, isLoading: isBooksLoading } = useUserBooks(authInfo?.id || "");
  const { data: collectionsData, isLoading: isCollectionsLoading } = useLibraryCollections();
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();
  const qc = useQueryClient();

  const isLoading = isStoriesLoading || isBooksLoading || isAuthLoading;

  const entries = useMemo<LibraryItem[]>(() => {
    const formattedStories: StoryEntry[] = (storiesData?.stories || []).map((s: any) => ({
      type: "entry",
      id: s.id,
      title: s.title || "Untitled Story",
      content: s.content || "",
      created_at: s.created_at,
      story_date: s.story_date || s.created_at,
      is_public: s.is_public || false,
      likes: s.likes || 0,
      views: s.view_count ?? s.views ?? 0,
      has_audio: s.has_audio,
      audio_url: s.audio_url,
      mood: s.mood || "neutral",
      tags: s.tags || [],
    }));

    const formattedBooks: BookEntry[] = (booksData || []).map((b: any) => ({
      type: "book",
      id: b.id,
      title: b.title || "Untitled Book",
      description: b.description || "",
      created_at: b.created_at,
      likes: b.likes || 0,
      views: b.views || 0,
      story_ids: b.story_ids || [],
      ipfs_hash: b.ipfs_hash,
      mood: "excited",
      tags: ["compilation"],
    }));

    return [...formattedStories, ...formattedBooks].sort(
      (a, b) => getEntryDate(b).getTime() - getEntryDate(a).getTime()
    );
  }, [storiesData, booksData]);

  const collections = collectionsData?.collections || [];

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  // Compilation State
  const [isCompiling, setIsCompiling] = useState(false);
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(new Set());
  const [isBookDialogOpen, setIsBookDialogOpen] = useState(false);

  // New Book Form State
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookDesc, setNewBookDesc] = useState("");
  const [isSavingBook, setIsSavingBook] = useState(false);

  // Collections UI State
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");

  const handleCreateCollection = async () => {
    if (!newCollectionTitle.trim()) return toast.error("Title is required");
    createCollection.mutate(
      { title: newCollectionTitle.trim(), description: newCollectionDesc.trim() || null },
      {
        onSuccess: () => {
          toast.success("Collection created!");
          setIsCreateCollectionOpen(false);
          setNewCollectionTitle("");
          setNewCollectionDesc("");
        },
        onError: (err: any) => {
          toast.error(err?.message || "Failed to create collection");
        },
      }
    );
  };

  const handleDeleteCollection = async (collectionId: string) => {
    deleteCollection.mutate(collectionId, {
      onSuccess: () => toast.success("Collection deleted"),
      onError: () => toast.error("Failed to delete collection"),
    });
  };

  // --- 2. Filtering & Grouping ---
  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          entry.title.toLowerCase().includes(q) ||
          (entry.type === "entry" && entry.content.toLowerCase().includes(q)) ||
          entry.tags?.some((tag) => tag.toLowerCase().includes(q))
        );
      }),
    [entries, searchQuery]
  );

  const monthGroups = useMemo(() => groupByMonth(filteredEntries), [filteredEntries]);
  const storyMonthGroups = useMemo(
    () => groupByMonth(filteredEntries.filter((e) => e.type === "entry")),
    [filteredEntries]
  );

  const toggleMonth = (key: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // --- 3. Event Handlers ---
  const toggleSelection = (id: string) => {
    const next = new Set(selectedStoryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStoryIds(next);
  };

  const handleStartCompile = () => {
    setIsCompiling(true);
    setActiveTab("all");
    setSelectedStoryIds(new Set());
    toast("Select stories to add to your book", { icon: "\u{1F4DA}" });
  };

  const handleCancelCompile = () => {
    setIsCompiling(false);
    setSelectedStoryIds(new Set());
  };

  const handleOpenBookDialog = () => {
    if (selectedStoryIds.size < 2) return toast.error("Please select at least 2 stories.");
    setNewBookTitle("");
    setNewBookDesc("");
    setIsBookDialogOpen(true);
  };

  const handleCreateBook = async () => {
    if (!newBookTitle.trim()) return toast.error("Please enter a book title");
    if (!supabase || !authInfo?.id) return;

    setIsSavingBook(true);
    try {
      const selectedStories = entries.filter(
        (e) => e.type === "entry" && selectedStoryIds.has(e.id)
      ) as StoryEntry[];

      const metadata = {
        name: newBookTitle,
        description: newBookDesc,
        external_url: "https://estories.app",
        attributes: [
          { trait_type: "Author", value: authInfo.name },
          { trait_type: "Stories", value: selectedStories.length },
        ],
        stories: selectedStories.map((s) => ({
          title: s.title,
          content: s.content,
          audio: s.audio_url,
          date: s.created_at,
        })),
      };

      toast.loading("Uploading Metadata...", { id: "book-toast" });
      const ipfsResult = await ipfsService.uploadMetadata(metadata, await getAccessToken());
      if (!ipfsResult?.hash) throw new Error("IPFS upload failed");
      const tokenURI = `ipfs://${ipfsResult.hash}`;

      toast.loading("Minting NFT...", { id: "book-toast" });
      await mintBook(tokenURI);

      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_id: authInfo.id,
          author_wallet: authInfo.wallet_address,
          title: newBookTitle,
          description: newBookDesc,
          story_ids: Array.from(selectedStoryIds),
          ipfs_hash: ipfsResult.hash,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to create book");
      }

      toast.success("Book Created & Minted!", { id: "book-toast" });
      setIsBookDialogOpen(false);
      setIsCompiling(false);
      setSelectedStoryIds(new Set());
      // Invalidate queries to refresh the library
      qc.invalidateQueries({ queryKey: ["library", "books"] });
      qc.invalidateQueries({ queryKey: ["stories", "user"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create book";
      if (msg.includes("User rejected")) toast.error("Minting cancelled", { id: "book-toast" });
      else toast.error("Failed to create book", { id: "book-toast" });
    } finally {
      setIsSavingBook(false);
    }
  };

  const handleCardClick = (entry: LibraryItem) => {
    if (isCompiling && entry.type === "entry") {
      toggleSelection(entry.id);
    } else if (!isCompiling) {
      router.push(entry.type === "entry" ? `/story/${entry.id}` : `/books/${entry.id}`);
    }
  };

  // --- 4. Render ---

  if (!isConnected && !authInfo) {
    return (
      <div className="text-center space-y-8 py-16">
        <div className="w-24 h-24 mx-auto bg-[hsl(var(--memory-500)/0.15)] rounded-full flex items-center justify-center">
          <Archive className="w-12 h-12 text-[hsl(var(--memory-500))]" />
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Sign In to View Archive</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Connect your wallet or sign in with Google to access your personal story archive.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 mx-auto bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] rounded-full flex items-center justify-center shadow-lg"
        >
          <Archive className="w-8 h-8 text-white" />
        </motion.div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
          Your <span className="text-gradient-memory">Archive</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          All your story entries, patterns, and compiled books
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Stories", value: entries.filter((e) => e.type === "entry").length, icon: FileText },
          { label: "Key Moments", value: canonicalStories.length, icon: Star },
          { label: "Books Created", value: entries.filter((e) => e.type === "book").length, icon: BookOpen },
          { label: "Months Active", value: monthGroups.length, icon: Calendar },
        ].map((stat, index) => {
          const Icon = stat.icon;
          const iconColors = [
            "text-[hsl(var(--memory-500))]",
            "text-[hsl(var(--story-500))]",
            "text-[hsl(var(--insight-500))]",
            "text-[hsl(var(--growth-500))]",
          ];
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="card-elevated text-center rounded-xl">
                <CardContent className="pt-6">
                  <Icon className={`w-6 h-6 mx-auto mb-2 ${iconColors[index]}`} />
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Search Bar */}
      <Card className="card-elevated rounded-xl">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search your stories, tags, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 mb-6">
          <TabsTrigger value="all" className="text-xs sm:text-sm">
            <FileText className="w-4 h-4 mr-1 hidden sm:inline" /> All
          </TabsTrigger>
          <TabsTrigger value="stories" className="text-xs sm:text-sm">
            <Calendar className="w-4 h-4 mr-1 hidden sm:inline" /> Stories
          </TabsTrigger>
          <TabsTrigger value="collections" className="text-xs sm:text-sm">
            <FolderOpen className="w-4 h-4 mr-1 hidden sm:inline" /> Collections
          </TabsTrigger>
          <TabsTrigger value="books" className="text-xs sm:text-sm">
            <BookOpen className="w-4 h-4 mr-1 hidden sm:inline" /> Books
          </TabsTrigger>
          <TabsTrigger value="key" className="text-xs sm:text-sm">
            <Star className="w-4 h-4 mr-1 hidden sm:inline" /> Key Moments
          </TabsTrigger>
          <TabsTrigger value="themes" className="text-xs sm:text-sm">
            <Tags className="w-4 h-4 mr-1 hidden sm:inline" /> Themes
          </TabsTrigger>
          <TabsTrigger value="domains" className="text-xs sm:text-sm">
            <Compass className="w-4 h-4 mr-1 hidden sm:inline" /> Life Areas
          </TabsTrigger>
        </TabsList>

        {/* All Tab — Month-by-month timeline */}
        <TabsContent value="all">
          {isLoading ? (
            <LoadingSpinner />
          ) : monthGroups.length === 0 ? (
            <EmptyState searchQuery={searchQuery} />
          ) : (
            <div className="space-y-8">
              {monthGroups.map((group) => (
                <MonthSection
                  key={group.key}
                  group={group}
                  isCollapsed={collapsedMonths.has(group.key)}
                  onToggle={() => toggleMonth(group.key)}
                  isCompiling={isCompiling}
                  selectedStoryIds={selectedStoryIds}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Stories Tab — Month-by-month, stories only */}
        <TabsContent value="stories">
          {isLoading ? (
            <LoadingSpinner />
          ) : storyMonthGroups.length === 0 ? (
            <Card className="card-elevated rounded-xl">
              <CardContent className="py-12 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-[hsl(var(--memory-500)/0.15)] rounded-full flex items-center justify-center">
                  <FileText className="w-8 h-8 text-[hsl(var(--memory-500))]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No Stories Yet</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Start writing to see your stories here.
                  </p>
                </div>
                <Button
                  onClick={() => router.push("/record")}
                  className="bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))]"
                >
                  Record Your First Story
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {storyMonthGroups.map((group) => (
                <MonthSection
                  key={group.key}
                  group={group}
                  isCollapsed={collapsedMonths.has(group.key)}
                  onToggle={() => toggleMonth(group.key)}
                  isCompiling={isCompiling}
                  selectedStoryIds={selectedStoryIds}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Collections Tab */}
        <TabsContent value="collections">
          {isCollectionsLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-6">
              <div className="flex justify-end">
                <Button
                  onClick={() => setIsCreateCollectionOpen(true)}
                  className="bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))]"
                >
                  <Plus className="w-4 h-4 mr-2" /> New Collection
                </Button>
              </div>
              {collections.length === 0 ? (
                <Card className="card-elevated rounded-xl">
                  <CardContent className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto bg-[hsl(var(--memory-500)/0.15)] rounded-full flex items-center justify-center">
                      <FolderOpen className="w-8 h-8 text-[hsl(var(--memory-500))]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No Collections Yet</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Group related stories into collections — like a series or thematic anthology.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {collections.map((col, index) => (
                    <motion.div
                      key={col.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card
                        className="card-elevated rounded-xl cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group"
                        onClick={() => router.push(`/library/collections/${col.id}`)}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-[hsl(var(--memory-500)/0.1)] flex-shrink-0">
                              <FolderOpen className="w-4 h-4 text-[hsl(var(--memory-500))]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-[hsl(var(--memory-500))] transition-colors">
                                {col.title}
                              </h3>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                <span>{col.story_count} {col.story_count === 1 ? "story" : "stories"}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                <span>{new Date(col.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                                {col.is_public ? (
                                  <Globe className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Lock className="w-3 h-3 text-gray-400" />
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCollection(col.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                          {col.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                              {col.description}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Books Tab */}
        <TabsContent value="books">
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredEntries
                  .filter((e) => e.type === "book")
                  .map((entry, index) => (
                    <StoryCard
                      key={entry.id}
                      entry={entry}
                      index={index}
                      isCompiling={false}
                      isSelected={false}
                      onClick={() => handleCardClick(entry)}
                    />
                  ))}
              </AnimatePresence>
            </div>
          )}
          {!isLoading && filteredEntries.filter((e) => e.type === "book").length === 0 && (
            <Card className="card-elevated rounded-xl">
              <CardContent className="py-12 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-[hsl(var(--insight-500)/0.15)] rounded-full flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-[hsl(var(--insight-500))]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No Books Yet</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Compile your stories into beautiful digital books.
                  </p>
                </div>
                <Button
                  onClick={handleStartCompile}
                  variant="outline"
                  className="border-[hsl(var(--insight-500)/0.3)] text-[hsl(var(--insight-600))] dark:text-[hsl(var(--insight-400))] hover:bg-[hsl(var(--insight-500)/0.1)]"
                >
                  <Sparkles className="w-4 h-4 mr-2" /> Compile Your First Book
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Key Moments Tab */}
        <TabsContent value="key">
          {patternsLoading ? (
            <LoadingSpinner />
          ) : canonicalStories.length === 0 ? (
            <Card className="card-canonical rounded-xl bg-[hsl(var(--story-500)/0.05)]">
              <CardContent className="py-12 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-story rounded-full flex items-center justify-center">
                  <Star className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No Key Moments Yet</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Mark important stories as &quot;Key Moments&quot; to track the most significant events in your life.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {canonicalStories.map((story, index) => (
                  <CanonicalStoryCard
                    key={story.id}
                    story={story}
                    index={index}
                    onClick={() => router.push(`/story/${story.id}`)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* Themes Tab */}
        <TabsContent value="themes">
          <ThemesView themeGroups={themeGroups} isLoading={patternsLoading} />
        </TabsContent>

        {/* Life Areas Tab */}
        <TabsContent value="domains">
          <DomainsView domainGroups={domainGroups} isLoading={patternsLoading} totalStories={patternStories.length} />
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card className="card-elevated bg-[hsl(var(--memory-500)/0.05)] border-[hsl(var(--memory-500)/0.2)]">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Ready to create more stories?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Record new entries or compile existing ones into digital books
              </p>
            </div>
            <div className="flex gap-2">
              {isCompiling ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancelCompile}
                    className="border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <X className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                  <Button
                    onClick={handleOpenBookDialog}
                    className="bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))]"
                    disabled={selectedStoryIds.size < 2}
                  >
                    <Sparkles className="w-4 h-4 mr-2" /> Create Book ({selectedStoryIds.size})
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleStartCompile}
                    variant="outline"
                    className="border-[hsl(var(--memory-500)/0.3)] text-[hsl(var(--memory-600))] dark:text-[hsl(var(--memory-400))]"
                  >
                    <Sparkles className="w-4 h-4 mr-2" /> Compile Book
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-[hsl(var(--growth-600))] to-[hsl(var(--growth-500))]"
                    onClick={() => router.push("/record")}
                  >
                    <Plus className="w-4 h-4 mr-2" /> New Entry
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Book Dialog */}
      <Dialog open={isBookDialogOpen} onOpenChange={setIsBookDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Compile Digital Book</DialogTitle>
            <DialogDescription>
              Create a collection from your selected {selectedStoryIds.size} stories.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Book Title</Label>
              <Input
                id="title"
                placeholder="e.g., Summer Memories 2024"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                placeholder="What is this collection about?"
                value={newBookDesc}
                onChange={(e) => setNewBookDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBookDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateBook}
              disabled={isSavingBook || isMinting}
              className="bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))]"
            >
              {isSavingBook || isMinting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {isMinting ? "Minting NFT..." : "Create Collection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Collection Dialog */}
      <Dialog open={isCreateCollectionOpen} onOpenChange={setIsCreateCollectionOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New Collection</DialogTitle>
            <DialogDescription>
              Group related stories into a series or thematic collection.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="col-title">Collection Title</Label>
              <Input
                id="col-title"
                placeholder='e.g., "The History of West African Trade Routes"'
                value={newCollectionTitle}
                onChange={(e) => setNewCollectionTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="col-desc">Description (optional)</Label>
              <Textarea
                id="col-desc"
                placeholder="What connects these stories?"
                value={newCollectionDesc}
                onChange={(e) => setNewCollectionDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateCollectionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCollection}
              disabled={!newCollectionTitle.trim()}
              className="bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))]"
            >
              <FolderOpen className="w-4 h-4 mr-2" /> Create Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Month Section Component ──────────────────────────────────────────

function MonthSection({
  group,
  isCollapsed,
  onToggle,
  isCompiling,
  selectedStoryIds,
  onCardClick,
}: {
  group: MonthGroup;
  isCollapsed: boolean;
  onToggle: () => void;
  isCompiling: boolean;
  selectedStoryIds: Set<string>;
  onCardClick: (entry: LibraryItem) => void;
}) {
  const isCurrent = isCurrentMonth(group.key);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Month Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 mb-4 group cursor-pointer"
      >
        {/* Timeline dot */}
        <div
          className={`w-3 h-3 rounded-full flex-shrink-0 ring-4 ${
            isCurrent
              ? "bg-[hsl(var(--memory-500))] ring-[hsl(var(--memory-500)/0.2)]"
              : "bg-gray-400 dark:bg-gray-500 ring-gray-200 dark:ring-gray-700"
          }`}
        />
        {/* Timeline line */}
        <div className="flex-1 flex items-center gap-3">
          <h2
            className={`text-lg font-bold ${
              isCurrent
                ? "text-[hsl(var(--memory-600))] dark:text-[hsl(var(--memory-400))]"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            {group.label}
          </h2>
          <div className="flex items-center gap-2">
            {group.storyCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-[hsl(var(--void-surface))]">
                {group.storyCount} {group.storyCount === 1 ? "story" : "stories"}
              </Badge>
            )}
            {group.bookCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-[hsl(var(--insight-500)/0.1)] text-[hsl(var(--insight-600))] dark:text-[hsl(var(--insight-400))]">
                {group.bookCount} {group.bookCount === 1 ? "book" : "books"}
              </Badge>
            )}
          </div>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
              isCollapsed ? "-rotate-90" : ""
            }`}
          />
        </div>
      </button>

      {/* Month Content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.entries.map((entry, index) => (
                  <StoryCard
                    key={entry.id}
                    entry={entry}
                    index={index}
                    isCompiling={isCompiling}
                    isSelected={selectedStoryIds.has(entry.id)}
                    onClick={() => onCardClick(entry)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Story Card Component ─────────────────────────────────────────────

function StoryCard({
  entry,
  index,
  isCompiling,
  isSelected,
  onClick,
}: {
  entry: LibraryItem;
  index: number;
  isCompiling: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const entryDate = entry.type === "entry" ? entry.story_date : entry.created_at;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      layout
    >
      <Card
        className={`h-full card-elevated transition-all duration-200 relative overflow-hidden group rounded-xl
          ${
            isCompiling && entry.type === "entry"
              ? "cursor-pointer hover:ring-2 hover:ring-[hsl(var(--memory-500))]"
              : "cursor-pointer hover:shadow-lg hover:-translate-y-0.5"
          }
          ${isSelected ? "ring-2 ring-[hsl(var(--memory-600))] bg-[hsl(var(--memory-500)/0.1)]" : ""}
        `}
        onClick={onClick}
      >
        {/* Selection Indicator */}
        {isCompiling && entry.type === "entry" && (
          <div className="absolute top-3 right-3 z-10">
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
              ${
                isSelected
                  ? "bg-[hsl(var(--memory-600))] border-[hsl(var(--memory-600))]"
                  : "border-gray-300 bg-white/80 dark:bg-gray-800/80"
              }`}
            >
              {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
            </div>
          </div>
        )}

        <CardContent className="p-4 space-y-3">
          {/* Top row: icon + title + badges */}
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg flex-shrink-0 ${
                entry.type === "book"
                  ? "bg-[hsl(var(--insight-500)/0.1)]"
                  : "bg-[hsl(var(--memory-500)/0.1)]"
              }`}
            >
              {entry.type === "book" ? (
                <BookOpen className="w-4 h-4 text-[hsl(var(--insight-500))]" />
              ) : (
                <FileText className="w-4 h-4 text-[hsl(var(--memory-500))]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-[hsl(var(--memory-500))] transition-colors">
                {entry.title}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  {new Date(entryDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {entry.type === "entry" && entry.has_audio && (
                  <Volume2 className="w-3 h-3 text-[hsl(var(--growth-500))]" />
                )}
                {entry.type === "entry" && (
                  <>
                    {entry.is_public ? (
                      <Globe className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Lock className="w-3 h-3 text-gray-400" />
                    )}
                  </>
                )}
                {entry.type === "book" && (
                  <span className="text-[hsl(var(--insight-500))]">
                    {entry.story_ids.length} stories
                  </span>
                )}
              </div>
            </div>
            {entry.mood && entry.mood !== "neutral" && (
              <Badge variant="secondary" className={`text-xs ${moodColors[entry.mood] || ""}`}>
                {entry.mood}
              </Badge>
            )}
          </div>

          {/* Content preview */}
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
            {entry.type === "entry" ? entry.content : entry.description}
          </p>

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && entry.tags[0] !== "compilation" && (
            <div className="flex flex-wrap gap-1">
              {entry.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Footer stats */}
          {!isCompiling && (
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" /> {entry.views}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" /> {entry.likes}
              </span>
              <span className="flex-1" />
              <Share2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              {entry.type === "book" && (
                <Download className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-[hsl(var(--insight-500))]" />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Canonical Story Card ─────────────────────────────────────────────

function CanonicalStoryCard({
  story,
  index,
  onClick,
}: {
  story: StoryWithMetadata;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      layout
    >
      <Card
        className="h-full card-canonical transition-all duration-300 cursor-pointer hover-glow-canonical bg-[hsl(var(--story-500)/0.05)] rounded-xl"
        onClick={onClick}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Star className="w-5 h-5 text-[hsl(var(--story-500))] fill-[hsl(var(--story-500))]" />
                <Badge className="bg-[hsl(var(--story-500)/0.15)] text-[hsl(var(--story-600))] dark:text-[hsl(var(--story-400))] border border-[hsl(var(--story-500)/0.3)]">
                  Key Moment
                </Badge>
              </div>
              <CardTitle className="text-xl line-clamp-1 group-hover:text-[hsl(var(--story-500))] transition-colors">
                {story.title}
              </CardTitle>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>
                {new Date(story.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            {story.story_metadata?.life_domain && (
              <Badge variant="outline" className="capitalize">
                {story.story_metadata.life_domain}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300 line-clamp-3 min-h-18">{story.content}</p>
          {story.story_metadata?.themes && story.story_metadata.themes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {story.story_metadata.themes.slice(0, 3).map((theme) => (
                <Badge
                  key={theme}
                  variant="secondary"
                  className="bg-[hsl(var(--insight-500)/0.1)] text-[hsl(var(--insight-600))] dark:text-[hsl(var(--insight-400))]"
                >
                  {theme}
                </Badge>
              ))}
            </div>
          )}
          {story.story_metadata?.brief_insight && (
            <div className="p-3 bg-[hsl(var(--void-surface))] rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                &quot;{story.story_metadata.brief_insight}&quot;
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <BrandedLoader size="md" message="Loading your stories..." />
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────

function EmptyState({ searchQuery }: { searchQuery: string }) {
  const router = useRouter();
  return (
    <div className="text-center py-16 space-y-4">
      <div className="w-24 h-24 mx-auto bg-[hsl(var(--void-light))] rounded-full flex items-center justify-center">
        <Search className="w-12 h-12 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">No stories found</h3>
      <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
        {searchQuery ? `No matches for "${searchQuery}".` : "Start your journey by recording your first story!"}
      </p>
      {!searchQuery && (
        <Button
          onClick={() => router.push("/record")}
          className="bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))]"
        >
          Record Your First Story
        </Button>
      )}
    </div>
  );
}
