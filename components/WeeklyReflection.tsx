"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useReflection } from "@/app/hooks/useReflection";
import { WeeklyReflection as WeeklyReflectionType } from "@/app/types";
import { getEmotionClass, getDomainClass, domainLabels } from "@/lib/design-tokens";
import { AI_SETUP_MESSAGE } from "@/lib/ai/messages";
import {
  Brain,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  BookOpen,
  Heart,
  TrendingUp,
  Clock,
  RefreshCw,
} from "lucide-react";

// Format date range for display
function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);

  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", options)} - ${end.toLocaleDateString("en-US", options)}`;
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "Last week";
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

// Skeleton loader component
function ReflectionSkeleton() {
  return (
    <Card className="card-elevated rounded-xl">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

// Individual reflection item for past reflections list
function ReflectionItem({ reflection }: { reflection: WeeklyReflectionType }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {formatWeekRange(reflection.week_start, reflection.week_end)}
              </span>
              <span className="text-xs text-gray-400">
                {formatRelativeTime(reflection.created_at)}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {reflection.stories_analyzed?.length || 0} stories
              </Badge>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="pt-4 pb-2 px-4"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
            {reflection.reflection_text}
          </p>
          {reflection.themes_identified?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {reflection.themes_identified.map((theme) => (
                <Badge
                  key={theme}
                  variant="secondary"
                  className="text-xs bg-[hsl(var(--insight-500)/0.1)] text-[hsl(var(--insight-600))]"
                >
                  {theme}
                </Badge>
              ))}
            </div>
          )}
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function WeeklyReflectionSection() {
  const {
    reflections,
    latestReflection,
    isLoading,
    isGenerating,
    error,
    canGenerate,
    generationUnavailable,
    generateReflection,
    refetch,
  } = useReflection();

  const [showPast, setShowPast] = useState(false);

  const handleGenerate = async () => {
    const result = await generateReflection();
    if (result) {
      toast.success("Weekly reflection generated!");
    } else if (error) {
      toast.error(error);
    }
  };

  // Loading state
  if (isLoading) {
    return <ReflectionSkeleton />;
  }

  // No reflections yet - show generate prompt
  if (!latestReflection) {
    return (
      <Card className="card-insight rounded-xl bg-[hsl(var(--insight-500)/0.05)]">
        <CardContent className="py-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-[hsl(var(--insight-600))] to-[hsl(var(--memory-600))] rounded-full flex items-center justify-center">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Weekly Reflection
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-md mx-auto">
              {generationUnavailable ? AI_SETUP_MESSAGE : "Let AI analyze your journal entries from the past week and provide personalized insights about your life patterns."}
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !canGenerate}
            className="bg-gradient-to-r from-[hsl(var(--insight-600))] to-[hsl(var(--memory-600))] hover:from-[hsl(var(--insight-700))] hover:to-[hsl(var(--memory-700))]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate First Reflection
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Has reflections - display latest
  const pastReflections = reflections.slice(1);

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
              <span className="text-gradient-insight">Weekly Reflection</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {formatRelativeTime(latestReflection.created_at)}
              </span>
              {canGenerate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="text-gray-500 hover:text-[hsl(var(--insight-500))]"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {generationUnavailable && <p role="status" className="text-sm text-gray-600 dark:text-gray-400">{AI_SETUP_MESSAGE}</p>}
          {/* Week range indicator */}
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>{formatWeekRange(latestReflection.week_start, latestReflection.week_end)}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <BookOpen className="w-4 h-4" />
            <span>{latestReflection.stories_analyzed?.length || 0} stories analyzed</span>
          </div>

          {/* Reflection text */}
          <div className="p-4 bg-[hsl(var(--insight-500)/0.1)] dark:bg-[hsl(var(--insight-500)/0.15)] rounded-lg border border-[hsl(var(--insight-500)/0.2)]">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
              {latestReflection.reflection_text}
            </p>
          </div>

          {/* Tone & Domain badges */}
          <div className="flex flex-wrap gap-3">
            {latestReflection.dominant_tone && (
              <div className="flex items-center space-x-2">
                <Heart className="w-4 h-4 text-gray-400" />
                <Badge className={`${getEmotionClass(latestReflection.dominant_tone)} border capitalize`}>
                  {latestReflection.dominant_tone}
                </Badge>
              </div>
            )}
            {latestReflection.dominant_domain && (
              <div className={`flex items-center space-x-2 ${getDomainClass(latestReflection.dominant_domain)}`}>
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <Badge className="domain-badge capitalize">
                  {domainLabels[latestReflection.dominant_domain] || latestReflection.dominant_domain}
                </Badge>
              </div>
            )}
          </div>

          {/* Themes */}
          {latestReflection.themes_identified?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                <Sparkles className="w-4 h-4 text-[hsl(var(--insight-500))]" />
                <span>Key Themes</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {latestReflection.themes_identified.map((theme) => (
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

          {/* Past reflections */}
          {pastReflections.length > 0 && (
            <div className="pt-4 border-t dark:border-gray-700">
              <Collapsible open={showPast} onOpenChange={setShowPast}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors">
                    <span>Past Reflections ({pastReflections.length})</span>
                    {showPast ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 mt-4"
                    >
                      {pastReflections.map((reflection) => (
                        <ReflectionItem key={reflection.id} reflection={reflection} />
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
