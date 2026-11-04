import { z } from "zod";

const storyFields = z.object({
  title: z.preprocess(value => typeof value === "string" && !value.trim() ? undefined : value, z.string().trim().min(1).max(200).optional()),
  content: z.string().trim().min(1).max(50_000),
  mood: z.string().trim().max(40).default("neutral"),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  has_audio: z.boolean().optional(),
  audio_url: z.string().url().refine(value => new URL(value).protocol === "https:").nullable().optional(),
  is_public: z.boolean().default(false),
  story_date: z.string().max(40).refine(value => Number.isFinite(Date.parse(value))).optional(),
  parent_story_id: z.string().uuid().nullable().optional(),
  story_type: z.enum(["personal_journal", "historical_narrative", "geopolitical_analysis", "cultural_tale", "creative_nonfiction"]).default("personal_journal"),
});

export function parseJournalInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid journal input");
  const body = { ...input } as Record<string, unknown>;
  for (const [legacy, canonical] of [["hasAudio", "has_audio"], ["audioUrl", "audio_url"], ["parentStoryId", "parent_story_id"], ["storyDate", "story_date"], ["isPublic", "is_public"], ["storyType", "story_type"]]) {
    if (body[legacy] !== undefined && body[canonical] !== undefined && body[legacy] !== body[canonical]) throw new Error("Conflicting fields");
    if (body[canonical] === undefined && body[legacy] !== undefined) body[canonical] = body[legacy];
  }
  const result = storyFields.parse(body);
  if (!result.is_public && result.audio_url) throw new Error("Private audio storage is not available yet");
  return result;
}
