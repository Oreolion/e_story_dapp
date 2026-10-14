// eStories Mobile - Shared TypeScript Types
// Ported from web app/types/index.ts (mock data removed, moodColors adapted for RN)

export interface AuthorProfile {
  id?: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  wallet_address: string | null;
  badges: string[] | null;
  followers: number;
  isFollowing: boolean;
}

export interface StoryDataType {
  id: string;
  numeric_id: number;
  author: AuthorProfile;
  author_wallet: AuthorProfile;
  title: string;
  content: string;
  teaser?: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  hasAudio: boolean;
  audio_url?: string;
  isLiked: boolean;
  mood: string;
  tags: string[];
  paywallAmount: number;
  isPaid?: boolean;
  is_public: boolean;
  story_date: string;
  created_at: string;
  parent_story_id?: string | null;
}

export interface StoryCardProps {
  story: StoryDataType;
  onLike?: (id: string) => void;
  onFollow?: (username: string) => void;
  onShare?: (id: string) => void;
  onUnlock?: (id: string) => void;
}

export interface FeaturedWriterType {
  name: string;
  username: string;
  avatar: string;
  followers: number;
  stories: number;
  speciality: string;
}

export interface CommentDataTypes {
  id: string;
  content: string;
  created_at: string;
  author: {
    id: string;
    name: string | null;
    avatar: string | null;
    wallet_address: string | null;
  };
}

// Mobile-specific mood colors (hex values for expo-linear-gradient)
export const moodColors: Record<string, { from: string; to: string }> = {
  peaceful: { from: "#4ade80", to: "#059669" },
  inspiring: { from: "#facc15", to: "#f97316" },
  adventurous: { from: "#60a5fa", to: "#06b6d4" },
  nostalgic: { from: "#c084fc", to: "#ec4899" },
  thoughtful: { from: "#818cf8", to: "#a855f7" },
  exciting: { from: "#f87171", to: "#ea580c" },
  neutral: { from: "#9ca3af", to: "#64748b" },
  unknown: { from: "#9ca3af", to: "#64748b" },
};

// === Phase 1: Cognitive Layer Types ===

export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

export type EmotionalTone =
  | "reflective"
  | "joyful"
  | "anxious"
  | "hopeful"
  | "melancholic"
  | "grateful"
  | "frustrated"
  | "peaceful"
  | "excited"
  | "uncertain"
  | "neutral";

export type LifeDomain =
  | "work"
  | "relationships"
  | "health"
  | "identity"
  | "growth"
  | "creativity"
  | "spirituality"
  | "family"
  | "adventure"
  | "learning"
  | "general";

export interface StoryMetadata {
  id: string;
  story_id: string;
  themes: string[];
  emotional_tone: EmotionalTone;
  life_domain: LifeDomain;
  intensity_score: number;
  significance_score: number;
  is_canonical: boolean;
  ai_readable: boolean;
  people_mentioned: string[];
  places_mentioned: string[];
  time_references: string[];
  brief_insight: string | null;
  actionable_advice: string | null;
  analysis_status?: AnalysisStatus;
  created_at: string;
  updated_at: string;
}

export interface NarrativeObject extends StoryDataType {
  metadata?: StoryMetadata | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type:
    | "like"
    | "comment"
    | "tip"
    | "follow"
    | "book_published"
    | "story_mentioned";
  title: string;
  message: string;
  is_read: boolean;
  story_id?: string;
  from_user_id?: string;
  related_user_id?: string;
  link?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// === Phase 2: Patterns & Discovery Types ===

export interface StoryWithMetadata extends StoryDataType {
  story_metadata: StoryMetadata | null;
}

export interface ThemeGroup {
  theme: string;
  stories: StoryWithMetadata[];
  count: number;
  latestDate: string;
}

export interface DomainGroup {
  domain: LifeDomain;
  stories: StoryWithMetadata[];
  count: number;
  dominantTone: EmotionalTone | null;
}

export interface MonthlySummary {
  month: string;
  year: number;
  storyCount: number;
  canonicalCount: number;
  topThemes: string[];
  dominantDomain: LifeDomain | null;
  dominantTone: EmotionalTone | null;
  avgSignificance: number;
}

export interface DomainConfig {
  icon: string;
  bgColor: string;
  textColor: string;
  label: string;
}

export interface ThemeConfig {
  bgColor: string;
  textColor: string;
}

// === Phase 3: Weekly Reflections Types ===

export interface WeeklyReflection {
  id: string;
  user_id: string;
  user_wallet: string;
  reflection_text: string;
  stories_analyzed: string[];
  themes_identified: string[];
  dominant_tone: EmotionalTone | null;
  dominant_domain: LifeDomain | null;
  week_start: string;
  week_end: string;
  canonical_weight: number;
  created_at: string;
}

export interface ReflectionResponse {
  success: boolean;
  reflection: WeeklyReflection;
  message?: string;
}

export interface ReflectionRequest {
  userId: string;
  userWallet: string;
}

// === Story Collections Types ===

export interface StoryCollection {
  id: string;
  title: string;
  description: string | null;
  author_id: string;
  cover_image_url: string | null;
  is_public: boolean;
  story_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionStory {
  id: string;
  collection_id: string;
  story_id: string;
  position: number;
  added_at: string;
}

export interface CollectionWithStories extends StoryCollection {
  stories: StoryDataType[];
}

// === Dual Authentication Types ===

export interface OnboardingData {
  name: string;
  username: string;
  email: string;
}

export interface SignupData {
  name: string;
  username: string;
  email: string;
  password: string;
}

// === Tracker Types ===

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  category: string;
  target_frequency: string;
  created_at: string;
}

export interface DailyLog {
  id?: string;
  user_id: string;
  date: string;
  completed_habit_ids: string[];
  mood: string;
  notes: string;
}

// === Mobile-specific Types ===

export interface PushTokenData {
  token: string;
  platform: "ios" | "android";
  device_id: string;
}
