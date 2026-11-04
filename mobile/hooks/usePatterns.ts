// usePatterns - Phase 2 Patterns & Discovery hook (mobile)
// Fetches stories with metadata via API and computes theme/domain groupings

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { apiGet } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import type {
  StoryWithMetadata,
  ThemeGroup,
  DomainGroup,
  MonthlySummary,
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
  const { isAuthenticated, user } = useAuthStore();
  const ownerKey = isAuthenticated ? user?.id ?? "" : "";
  const currentOwner = useRef(ownerKey); currentOwner.current = ownerKey;
  const sequence = useRef(0);
  const [dataOwner, setDataOwner] = useState(ownerKey);
  const [cachedStories, setStories] = useState<StoryWithMetadata[]>([]);
  const stories = dataOwner === ownerKey ? cachedStories : [];
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatterns = useCallback(async () => {
    const request = ++sequence.current;
    const isCurrent = () => request === sequence.current && currentOwner.current === ownerKey;
    if (!isAuthenticated || !user) {
      setStories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const collected: StoryWithMetadata[] = [];
      let offset: number | null = 0;
      for (let page = 0; page < 20 && offset !== null; page++) {
        const res: { ok: boolean; data?: { stories: StoryWithMetadata[]; nextOffset?: number | null }; error?: string } = await apiGet(`/api/stories?limit=100&offset=${offset}`);
        if (!isCurrent()) return;
        if (!res.ok || !res.data?.stories) throw new Error(res.error || "Failed to fetch patterns");
        collected.push(...res.data.stories);
        offset = res.data.nextOffset ?? null;
      }
      if (offset !== null) throw new Error("Library is too large to calculate all patterns in this view");
      if (!isCurrent()) return;
      setDataOwner(ownerKey);
      setStories(Array.from(new Map(collected.map(story => [story.id, story])).values()));
    } catch (err) {
      if (!isCurrent()) return;
      setStories([]);
      console.error("[usePatterns] Fetch failed");
      setError(err instanceof Error ? err.message : "Failed to fetch patterns");
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [isAuthenticated, user, ownerKey]);

  useEffect(() => {
    void fetchPatterns();
    return () => { sequence.current++; };
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

    return Array.from(themeMap.entries())
      .map(([theme, storyList]) => ({
        theme,
        stories: storyList,
        count: storyList.length,
        latestDate:
          storyList.length > 0
            ? storyList.reduce(
                (latest, s) =>
                  new Date(s.created_at) > new Date(latest)
                    ? s.created_at
                    : latest,
                storyList[0].created_at
              )
            : "",
      }))
      .sort((a, b) => b.count - a.count);
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

    return Array.from(domainMap.entries())
      .map(([domain, storyList]) => {
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

        return { domain, stories: storyList, count: storyList.length, dominantTone };
      })
      .sort((a, b) => b.count - a.count);
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
      "July", "August", "September", "October", "November", "December",
    ];

    const monthStories = stories.filter((s) => {
      const d = new Date(s.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
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

    const canonicalCount = monthStories.filter(
      (s) => s.story_metadata?.is_canonical === true
    ).length;

    // Top themes
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

    // Dominant domain
    const domainCounts = new Map<LifeDomain, number>();
    monthStories.forEach((s) => {
      const domain = s.story_metadata?.life_domain;
      if (domain) domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    });
    let dominantDomain: LifeDomain | null = null;
    let maxDomainCount = 0;
    domainCounts.forEach((count, domain) => {
      if (count > maxDomainCount) {
        maxDomainCount = count;
        dominantDomain = domain;
      }
    });

    // Dominant tone
    const toneCounts = new Map<EmotionalTone, number>();
    monthStories.forEach((s) => {
      const tone = s.story_metadata?.emotional_tone;
      if (tone) toneCounts.set(tone, (toneCounts.get(tone) || 0) + 1);
    });
    let dominantTone: EmotionalTone | null = null;
    let maxToneCount = 0;
    toneCounts.forEach((count, tone) => {
      if (count > maxToneCount) {
        maxToneCount = count;
        dominantTone = tone;
      }
    });

    // Average significance
    const sigs = monthStories
      .map((s) => s.story_metadata?.significance_score)
      .filter((s): s is number => s != null);
    const avgSignificance =
      sigs.length > 0 ? sigs.reduce((a, b) => a + b, 0) / sigs.length : 0;

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
