/**
 * eStory Design Tokens
 *
 * TypeScript utilities for the Memory Space design system.
 * Provides type-safe access to colors, animations, and component classes.
 */

import type { EmotionalTone, LifeDomain, StoryMetadata } from "@/app/types";

// ============================================
// SECTION 2: Emotional Tone Mappings
// ============================================

/**
 * Emotional tone to CSS class mapping
 */
export const emotionClasses: Record<EmotionalTone, string> = {
  reflective: "tone-reflective",
  joyful: "tone-joyful",
  anxious: "tone-anxious",
  hopeful: "tone-hopeful",
  melancholic: "tone-melancholic",
  grateful: "tone-grateful",
  frustrated: "tone-frustrated",
  peaceful: "tone-peaceful",
  excited: "tone-excited",
  uncertain: "tone-uncertain",
  neutral: "tone-neutral",
};

/**
 * Get the CSS class for an emotional tone
 */
export function getEmotionClass(tone: EmotionalTone | undefined | null): string {
  if (!tone) return emotionClasses.neutral;
  return emotionClasses[tone] || emotionClasses.neutral;
}

/**
 * Emotional tone labels for display
 */
export const emotionLabels: Record<EmotionalTone, string> = {
  reflective: "Reflective",
  joyful: "Joyful",
  anxious: "Anxious",
  hopeful: "Hopeful",
  melancholic: "Melancholic",
  grateful: "Grateful",
  frustrated: "Frustrated",
  peaceful: "Peaceful",
  excited: "Excited",
  uncertain: "Uncertain",
  neutral: "Neutral",
};

/**
 * Emotional tone icons (using emoji as fallback - can be replaced with icon components)
 */
export const emotionIcons: Record<EmotionalTone, string> = {
  reflective: "thought-bubble",
  joyful: "smile",
  anxious: "alert-circle",
  hopeful: "sunrise",
  melancholic: "cloud-rain",
  grateful: "heart",
  frustrated: "frown",
  peaceful: "leaf",
  excited: "zap",
  uncertain: "help-circle",
  neutral: "minus",
};

// ============================================
// SECTION 3: Life Domain Mappings
// ============================================

/**
 * Life domain to CSS class mapping
 */
export const domainClasses: Record<LifeDomain, string> = {
  work: "domain-work",
  relationships: "domain-relationships",
  health: "domain-health",
  identity: "domain-identity",
  growth: "domain-growth",
  creativity: "domain-creativity",
  spirituality: "domain-spirituality",
  family: "domain-family",
  adventure: "domain-adventure",
  learning: "domain-learning",
  general: "domain-general",
};

/**
 * Get the CSS class for a life domain
 */
export function getDomainClass(domain: LifeDomain | undefined | null): string {
  if (!domain) return domainClasses.general;
  return domainClasses[domain] || domainClasses.general;
}

/**
 * Life domain labels for display
 */
export const domainLabels: Record<LifeDomain, string> = {
  work: "Work & Career",
  relationships: "Relationships",
  health: "Health & Wellness",
  identity: "Identity & Self",
  growth: "Personal Growth",
  creativity: "Creativity",
  spirituality: "Spirituality",
  family: "Family",
  adventure: "Adventure",
  learning: "Learning",
  general: "General",
};

/**
 * Life domain icons (Lucide icon names)
 */
export const domainIcons: Record<LifeDomain, string> = {
  work: "briefcase",
  relationships: "users",
  health: "heart-pulse",
  identity: "user",
  growth: "trending-up",
  creativity: "palette",
  spirituality: "sparkles",
  family: "home",
  adventure: "compass",
  learning: "book-open",
  general: "circle",
};

// ============================================
// SECTION 4: Animation & Transition Classes
// ============================================

/**
 * Animation class constants
 */
export const animations = {
  pulseSubtle: "animate-pulse-subtle",
  floatGentle: "animate-float-gentle",
  shimmer: "animate-shimmer",
  glowPulse: "animate-glow-pulse",
  fadeIn: "animate-fade-in",
  fadeInUp: "animate-fade-in-up",
  scaleIn: "animate-scale-in",
  spinSlow: "animate-spin-slow",
} as const;

/**
 * Transition class constants
 */
export const transitions = {
  fast: "transition-fast",
  normal: "transition-normal",
  slow: "transition-slow",
  colorsFast: "transition-colors-fast",
  allNormal: "transition-all-normal",
} as const;

// ============================================
// SECTION 5: Card Component Classes
// ============================================

/**
 * Card variant classes
 */
export const cardClasses = {
  elevated: "card-elevated",
  canonical: "card-canonical",
  insight: "card-insight",
  memory: "card-memory",
} as const;

/**
 * Get the appropriate card class based on story metadata
 */
export function getCardClass(metadata?: StoryMetadata | null): string {
  if (metadata?.is_canonical) {
    return cardClasses.canonical;
  }
  if (metadata?.significance_score && metadata.significance_score >= 0.7) {
    return cardClasses.insight;
  }
  return cardClasses.elevated;
}

// ============================================
// SECTION 6: Helper Functions
// ============================================

/**
 * Check if a story is considered a "key moment" based on metadata
 * Key moments have high significance or are marked as canonical
 */
export function isKeyMoment(metadata?: StoryMetadata | null): boolean {
  if (!metadata) return false;
  return metadata.is_canonical || metadata.significance_score >= 0.8;
}

/**
 * Get significance level from score
 */
export function getSignificanceLevel(
  score: number | undefined | null
): "low" | "medium" | "high" {
  if (!score || score < 0.4) return "low";
  if (score < 0.7) return "medium";
  return "high";
}

/**
 * Get intensity level from score
 */
export function getIntensityLevel(
  score: number | undefined | null
): "low" | "medium" | "high" {
  if (!score || score < 0.4) return "low";
  if (score < 0.7) return "medium";
  return "high";
}

/**
 * Combine multiple class names, filtering out falsy values
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Get combined classes for a story card based on metadata
 */
export function getStoryCardClasses(metadata?: StoryMetadata | null): string {
  const classes = [getCardClass(metadata)];

  if (metadata?.is_canonical) {
    classes.push(animations.glowPulse);
  }

  if (metadata?.emotional_tone) {
    classes.push(getEmotionClass(metadata.emotional_tone));
  }

  return cn(...classes);
}

// ============================================
// SECTION 7: Type Exports
// ============================================

export type SignificanceLevel = "low" | "medium" | "high";
export type CardVariant = keyof typeof cardClasses;
export type AnimationClass = keyof typeof animations;
export type TransitionClass = keyof typeof transitions;
