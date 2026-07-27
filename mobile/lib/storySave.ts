export interface StorySaveInput {
  title: string;
  content: string;
  mood: string;
  tags: string;
  isPublic: boolean;
  storyDate: string;
  audioUrl?: string;
  parentStoryId?: string | null;
}

export interface JournalSaveBody extends Record<string, unknown> {
  title: string;
  content: string;
  mood: string;
  tags: string[];
  hasAudio: boolean;
  audioUrl: string | null;
  isPublic: boolean;
  storyDate: string;
  parentStoryId: string | null;
}

export function buildJournalSaveBody(input: StorySaveInput): JournalSaveBody {
  const audioUrl = input.audioUrl?.trim() || null;

  return {
    title: input.title.trim(),
    content: input.content.trim(),
    mood: input.mood,
    tags: input.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    hasAudio: audioUrl !== null,
    audioUrl,
    isPublic: input.isPublic,
    storyDate: input.storyDate,
    parentStoryId: input.parentStoryId ?? null,
  };
}
