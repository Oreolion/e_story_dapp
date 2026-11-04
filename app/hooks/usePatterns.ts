"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabaseClient } from "../utils/supabase/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import {
  StoryWithMetadata,
  ThemeGroup,
  DomainGroup,
  MonthlySummary,
  StoryMetadata,
  EmotionalTone,
  LifeDomain,
} from "../types";

interface UsePatternData {
  stories: StoryWithMetadata[];
  themeGroups: ThemeGroup[];
  domainGroups: DomainGroup[];
  canonicalStories: StoryWithMetadata[];
  monthlySummary: MonthlySummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePatterns(): UsePatternData {
  const { profile: authInfo } = useAuth();
  const supabase = supabaseClient;

  const [stories, setStories] = useState<StoryWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatterns = useCallback(async () => {
    if (!authInfo?.id || !supabase) {
      setStories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch stories with their metadata
      const { data, error: fetchError } = await supabase
        .from("stories")
        .select(`
          *,
          story_metadata (*)
        `)
        .eq("author_id", authInfo.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        // Handle case where story_metadata table doesn't exist
        if (fetchError.code === "42P01" || fetchError.message?.includes("does not exist")) {
          console.warn("story_metadata table does not exist yet");
          // Fetch stories without metadata
          const { data: storiesOnly, error: storiesError } = await supabase
            .from("stories")
            .select("*")
            .eq("author_id", authInfo.id)
            .order("created_at", { ascending: false });

          if (storiesError) throw storiesError;

          const formattedStories: StoryWithMetadata[] = (storiesOnly || []).map((s) => ({
            ...formatStory(s),
            story_metadata: null,
          }));

          setStories(formattedStories);
          return;
        }
        throw fetchError;
      }

      // Format stories with metadata
      const formattedStories: StoryWithMetadata[] = (data || []).map((s) => ({
        ...formatStory(s),
        story_metadata: (() => { const meta = s.story_metadata?.[0] || s.story_metadata || null; return meta?.source_revision === 0 || meta?.source_revision != null && meta.source_revision !== s.revision ? null : meta; })(),
      }));

      setStories(formattedStories);
    } catch (err) {
      console.error("Error fetching patterns:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch patterns");
    } finally {
      setIsLoading(false);
    }
  }, [authInfo?.id, supabase]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  // Compute theme groups
  const themeGroups = useMemo(() => {
    const themeMap = new Map<string, StoryWithMetadata[]>();

    stories.forEach((story) => {
      const themes = story.story_metadata?.themes || [];
      themes.forEach((theme) => {
        const existing = themeMap.get(theme) || [];
        existing.push(story);
        themeMap.set(theme, existing);
      });
    });

    const groups: ThemeGroup[] = Array.from(themeMap.entries())
      .map(([theme, storyList]) => ({
        theme,
        stories: storyList,
        count: storyList.length,
        latestDate: storyList.length > 0
          ? storyList.reduce((latest, s) =>
              new Date(s.created_at) > new Date(latest) ? s.created_at : latest,
              storyList[0].created_at
            )
          : "",
      }))
      .sort((a, b) => b.count - a.count);

    return groups;
  }, [stories]);

  // Compute domain groups
  const domainGroups = useMemo(() => {
    const domainMap = new Map<LifeDomain, StoryWithMetadata[]>();

    stories.forEach((story) => {
      const domain = story.story_metadata?.life_domain || "general";
      const existing = domainMap.get(domain) || [];
      existing.push(story);
      domainMap.set(domain, existing);
    });

    const groups: DomainGroup[] = Array.from(domainMap.entries())
      .map(([domain, storyList]) => {
        // Calculate dominant tone
        const toneCounts = new Map<EmotionalTone, number>();
        storyList.forEach((s) => {
          const tone = s.story_metadata?.emotional_tone;
          if (tone) {
            toneCounts.set(tone, (toneCounts.get(tone) || 0) + 1);
          }
        });

        let dominantTone: EmotionalTone | null = null;
        let maxCount = 0;
        toneCounts.forEach((count, tone) => {
          if (count > maxCount) {
            maxCount = count;
            dominantTone = tone;
          }
        });

        return {
          domain,
          stories: storyList,
          count: storyList.length,
          dominantTone,
        };
      })
      .sort((a, b) => b.count - a.count);

    return groups;
  }, [stories]);

  // Compute canonical stories
  const canonicalStories = useMemo(() => {
    return stories.filter((s) => s.story_metadata?.is_canonical === true);
  }, [stories]);

  // Compute monthly summary for current month
  const monthlySummary = useMemo((): MonthlySummary | null => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const monthStories = stories.filter((s) => {
      const storyDate = new Date(s.created_at);
      return storyDate.getMonth() === currentMonth && storyDate.getFullYear() === currentYear;
    });

    if (monthStories.length === 0) {
      return {
        month: monthNames[currentMonth],
        year: currentYear,
        storyCount: 0,
        canonicalCount: 0,
        topThemes: [],
        dominantDomain: null,
        dominantTone: null,
        avgSignificance: 0,
      };
    }

    // Count canonical stories
    const canonicalCount = monthStories.filter(
      (s) => s.story_metadata?.is_canonical === true
    ).length;

    // Calculate top themes
    const themeCounts = new Map<string, number>();
    monthStories.forEach((s) => {
      s.story_metadata?.themes?.forEach((theme) => {
        themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
      });
    });
    const topThemes = Array.from(themeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([theme]) => theme);

    // Calculate dominant domain
    const domainCounts = new Map<LifeDomain, number>();
    monthStories.forEach((s) => {
      const domain = s.story_metadata?.life_domain;
      if (domain) {
        domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
      }
    });
    let dominantDomain: LifeDomain | null = null;
    let maxDomainCount = 0;
    domainCounts.forEach((count, domain) => {
      if (count > maxDomainCount) {
        maxDomainCount = count;
        dominantDomain = domain;
      }
    });

    // Calculate dominant tone
    const toneCounts = new Map<EmotionalTone, number>();
    monthStories.forEach((s) => {
      const tone = s.story_metadata?.emotional_tone;
      if (tone) {
        toneCounts.set(tone, (toneCounts.get(tone) || 0) + 1);
      }
    });
    let dominantTone: EmotionalTone | null = null;
    let maxToneCount = 0;
    toneCounts.forEach((count, tone) => {
      if (count > maxToneCount) {
        maxToneCount = count;
        dominantTone = tone;
      }
    });

    // Calculate average significance
    const significances = monthStories
      .map((s) => s.story_metadata?.significance_score)
      .filter((s): s is number => s !== undefined && s !== null);
    const avgSignificance =
      significances.length > 0
        ? significances.reduce((a, b) => a + b, 0) / significances.length
        : 0;

    return {
      month: monthNames[currentMonth],
      year: currentYear,
      storyCount: monthStories.length,
      canonicalCount,
      topThemes,
      dominantDomain,
      dominantTone,
      avgSignificance,
    };
  }, [stories]);

  return {
    stories,
    themeGroups,
    domainGroups,
    canonicalStories,
    monthlySummary,
    isLoading,
    error,
    refetch: fetchPatterns,
  };
}

// Helper to format story data from Supabase response
function formatStory(s: any): Omit<StoryWithMetadata, "story_metadata"> {
  return {
    id: s.id,
    numeric_id: s.numeric_id || s.id,
    author: {
      id: s.author_id,
      name: null,
      username: null,
      avatar: null,
      wallet_address: s.author_wallet,
      badges: [],
      followers: 0,
      isFollowing: false,
    },
    author_wallet: {
      id: s.author_id,
      name: null,
      username: null,
      avatar: null,
      wallet_address: s.author_wallet,
      badges: [],
      followers: 0,
      isFollowing: false,
    },
    title: s.title || "Untitled",
    content: s.content || "",
    teaser: s.teaser,
    timestamp: s.created_at,
    likes: s.likes || 0,
    comments: 0,
    shares: s.shares || 0,
    hasAudio: s.has_audio || false,
    audio_url: s.audio_url,
    isLiked: false,
    mood: s.mood || "neutral",
    tags: s.tags || [],
    paywallAmount: s.paywall_amount || 0,
    isPaid: false,
    is_public: s.is_public || false,
    story_date: s.story_date || s.created_at,
    created_at: s.created_at,
  };
}
