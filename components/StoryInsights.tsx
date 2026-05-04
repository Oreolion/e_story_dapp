"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "react-hot-toast";
import { StoryMetadata, EmotionalTone, LifeDomain, AnalysisStatus } from "@/app/types";
import {
  Sparkles,
  Loader2,
  Brain,
  Heart,
  MapPin,
  Users,
  Clock,
  RefreshCw,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Star,
  Hourglass,
  WifiOff,
} from "lucide-react";
import { getEmotionClass, getDomainClass, domainLabels } from "@/lib/design-tokens";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { Crown } from "lucide-react";

interface StoryInsightsProps {
  storyId: string;
  storyText: string;
}

export function StoryInsights({ storyId, storyText }: StoryInsightsProps) {
  const { getAccessToken, profile } = useAuth();
  const isPaidPlan = !!profile && profile.subscription_plan !== "free";
  const [metadata, setMetadata] = useState<StoryMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // AbortController ref for cleanup on unmount
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchMetadata = useCallback(async () => {
    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setIsLoading(true);
      setFetchError(null);

      const res = await fetch(`/api/stories/${storyId}/metadata`, { signal });

      if (!res.ok) {
        if (res.status === 404) {
          // No metadata yet, not an error
          setMetadata(null);
          return;
        }
        throw new Error("Failed to fetch metadata");
      }

      const data = await res.json();
      setMetadata(data.metadata);
    } catch (error) {
      // Ignore abort errors (component unmounted)
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      console.error("Error fetching metadata:", error);

      // Determine error type
      if (error instanceof TypeError && error.message.includes("fetch")) {
        setFetchError("Network error. Please check your connection.");
      } else {
        setFetchError("Unable to load insights. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [storyId]);

  // Fetch metadata on mount and cleanup on unmount
  useEffect(() => {
    fetchMetadata();

    return () => {
      // Cleanup: abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchMetadata]);

  const generateInsights = async () => {
    // Create AbortController for this request
    const controller = new AbortController();

    try {
      setIsAnalyzing(true);
      setFetchError(null);

      const token = await getAccessToken();
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ storyId, storyText }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const error = await res.json();
        if (error.code === "PLAN_LIMIT_REACHED") {
          toast.error(`Free plan limit reached (${error.usage?.used}/${error.usage?.limit} this month). Upgrade for unlimited analyses.`);
          return;
        }
        throw new Error(error.error || "Analysis failed");
      }

      const data = await res.json();
      setMetadata(data.metadata);
      toast.success("Insights generated!");
    } catch (error: unknown) {
      // Ignore abort errors
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      console.error("Analysis error:", error);

      // Determine error type
      if (error instanceof TypeError && error.message.includes("fetch")) {
        toast.error("Network error. Please check your connection.");
      } else {
        const message = error instanceof Error ? error.message : "Failed to generate insights";
        toast.error(message);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetry = () => {
    setFetchError(null);
    fetchMetadata();
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="card-elevated rounded-xl">
        <CardContent className="py-8">
          <div className="flex items-center justify-center space-x-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading insights...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Network/fetch error state
  if (fetchError) {
    return (
      <Card className="card-elevated rounded-xl bg-[hsl(var(--tone-anxious)/0.05)] border-[hsl(var(--tone-anxious)/0.2)]">
        <CardContent className="py-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-gradient-to-r from-[hsl(var(--tone-anxious))] to-[hsl(var(--tone-frustrated))] rounded-full flex items-center justify-center">
            <WifiOff className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Connection Error
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {fetchError}
            </p>
          </div>
          <Button
            onClick={handleRetry}
            variant="outline"
            className="border-[hsl(var(--tone-anxious)/0.3)] text-[hsl(var(--tone-anxious))] hover:bg-[hsl(var(--tone-anxious)/0.1)]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Pending state - analysis is queued
  if (metadata?.analysis_status === 'pending') {
    return (
      <Card className="card-elevated rounded-xl bg-[hsl(var(--story-500)/0.05)] border-[hsl(var(--story-500)/0.2)]">
        <CardContent className="py-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-gradient-story rounded-full flex items-center justify-center">
            <Hourglass className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Analysis Queued
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Your story is waiting to be analyzed. This usually takes a few moments.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Processing state - analysis is in progress
  if (metadata?.analysis_status === 'processing') {
    return (
      <Card className="card-elevated rounded-xl bg-[hsl(var(--memory-500)/0.05)] border-[hsl(var(--memory-500)/0.2)]">
        <CardContent className="py-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-gradient-memory rounded-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Analyzing Your Story
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              AI is extracting themes, emotions, and patterns from your story...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Failed state - analysis failed, show retry button
  if (metadata?.analysis_status === 'failed') {
    return (
      <Card className="card-elevated rounded-xl bg-[hsl(var(--tone-anxious)/0.05)] border-[hsl(var(--tone-anxious)/0.2)]">
        <CardContent className="py-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-gradient-to-r from-[hsl(var(--tone-anxious))] to-[hsl(var(--tone-frustrated))] rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Analysis Failed
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Something went wrong while analyzing your story. Please try again.
            </p>
          </div>
          <Button
            onClick={generateInsights}
            disabled={isAnalyzing}
            variant="outline"
            className="border-[hsl(var(--tone-anxious)/0.3)] text-[hsl(var(--tone-anxious))] hover:bg-[hsl(var(--tone-anxious)/0.1)]"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No metadata - show generate button
  if (!metadata) {
    return (
      <Card className="card-insight rounded-xl bg-[hsl(var(--insight-500)/0.05)]">
        <CardContent className="py-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-[hsl(var(--insight-600))] to-[hsl(var(--memory-600))] rounded-full flex items-center justify-center">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI Insights Available
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Let AI analyze your story to extract themes, emotions, and patterns.
            </p>
          </div>
          <Button
            onClick={generateInsights}
            disabled={isAnalyzing}
            className="bg-gradient-to-r from-[hsl(var(--insight-600))] to-[hsl(var(--memory-600))] hover:from-[hsl(var(--insight-700))] hover:to-[hsl(var(--memory-700))]"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Insights
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Has metadata - display insights
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="card-insight rounded-xl overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-lg">
              <Brain className="w-5 h-5 text-[hsl(var(--insight-500))]" />
              <span className="text-gradient-insight">AI Insights</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={generateInsights}
              disabled={isAnalyzing}
              className="text-gray-500 hover:text-[hsl(var(--insight-500))]"
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Brief Insight */}
          {metadata.brief_insight && (
            <div className="p-4 bg-[hsl(var(--insight-500)/0.1)] dark:bg-[hsl(var(--insight-500)/0.15)] rounded-lg border border-[hsl(var(--insight-500)/0.2)]">
              <div className="flex items-start space-x-3">
                <Lightbulb className="w-5 h-5 text-[hsl(var(--story-500))] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                  &ldquo;{metadata.brief_insight}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Actionable Advice — paid feature */}
          {metadata.actionable_advice && isPaidPlan ? (
            <div className="p-4 bg-[hsl(var(--memory-500)/0.1)] dark:bg-[hsl(var(--memory-500)/0.15)] rounded-lg border border-[hsl(var(--memory-500)/0.2)]">
              <div className="flex items-start space-x-3">
                <TrendingUp className="w-5 h-5 text-[hsl(var(--memory-500))] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-[hsl(var(--memory-600))] dark:text-[hsl(var(--memory-400))] mb-1">
                    Suggested Next Step
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {metadata.actionable_advice}
                  </p>
                </div>
              </div>
            </div>
          ) : !isPaidPlan && (
            <Link href="/pricing">
              <div className="p-4 bg-gradient-to-r from-[#d4a04a]/10 to-[#9b7dd4]/10 rounded-lg border border-[#d4a04a]/20 cursor-pointer hover:border-[#d4a04a]/40 transition-colors">
                <div className="flex items-start space-x-3">
                  <Crown className="w-5 h-5 text-[#d4a04a] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-[#d4a04a] mb-1">
                      Actionable Advice — Storyteller Plan
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Upgrade to get personalized writing advice with every analysis.
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Emotional Tone & Life Domain */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <Heart className="w-4 h-4 text-gray-400" />
              <Badge className={`${getEmotionClass(metadata.emotional_tone)} border capitalize`}>
                {metadata.emotional_tone}
              </Badge>
            </div>
            <div className={`flex items-center space-x-2 ${getDomainClass(metadata.life_domain)}`}>
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <Badge className="domain-badge capitalize">
                {domainLabels[metadata.life_domain] || metadata.life_domain}
              </Badge>
            </div>
            {/* Key life moment badge for high significance stories */}
            {metadata.significance_score > 0.7 && (
              <div className="flex items-center space-x-2">
                <Star className="w-4 h-4 text-[hsl(var(--story-500))]" />
                <Badge className="bg-[hsl(var(--story-500)/0.15)] text-[hsl(var(--story-500))] border border-[hsl(var(--story-500)/0.3)]">
                  Key life moment
                </Badge>
              </div>
            )}
          </div>

          {/* Themes */}
          {metadata.themes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                <Sparkles className="w-4 h-4 text-[hsl(var(--insight-500))]" />
                <span>Themes</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {metadata.themes.map((theme) => (
                  <Badge
                    key={theme}
                    variant="secondary"
                    className="bg-[hsl(var(--insight-500)/0.1)] text-[hsl(var(--insight-600))] dark:text-[hsl(var(--insight-400))] border border-[hsl(var(--insight-500)/0.2)]"
                  >
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Scores */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Intensity</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {Math.round(metadata.intensity_score * 100)}%
                </span>
              </div>
              <Progress
                value={metadata.intensity_score * 100}
                className="h-2 bg-gray-200 dark:bg-gray-700"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Significance</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {Math.round(metadata.significance_score * 100)}%
                </span>
              </div>
              <Progress
                value={metadata.significance_score * 100}
                className="h-2 bg-gray-200 dark:bg-gray-700"
              />
            </div>
          </div>

          {/* Entities */}
          {(metadata.people_mentioned.length > 0 ||
            metadata.places_mentioned.length > 0 ||
            metadata.time_references.length > 0) && (
            <div className="pt-4 border-t dark:border-gray-700 space-y-3">
              {metadata.people_mentioned.length > 0 && (
                <div className="flex items-start space-x-2">
                  <Users className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {metadata.people_mentioned.map((person) => (
                      <span
                        key={person}
                        className="text-sm text-gray-600 dark:text-gray-400"
                      >
                        {person}
                        {metadata.people_mentioned.indexOf(person) <
                          metadata.people_mentioned.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {metadata.places_mentioned.length > 0 && (
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {metadata.places_mentioned.map((place) => (
                      <span
                        key={place}
                        className="text-sm text-gray-600 dark:text-gray-400"
                      >
                        {place}
                        {metadata.places_mentioned.indexOf(place) <
                          metadata.places_mentioned.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {metadata.time_references.length > 0 && (
                <div className="flex items-start space-x-2">
                  <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {metadata.time_references.map((time) => (
                      <span
                        key={time}
                        className="text-sm text-gray-600 dark:text-gray-400"
                      >
                        {time}
                        {metadata.time_references.indexOf(time) <
                          metadata.time_references.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
