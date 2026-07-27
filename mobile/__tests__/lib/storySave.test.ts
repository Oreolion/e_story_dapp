import { describe, expect, it } from "vitest";
import { buildJournalSaveBody } from "../../lib/storySave";
import { storySchema } from "../../lib/validation";

describe("buildJournalSaveBody", () => {
  it("maps the mobile form to the API's camelCase contract", () => {
    expect(
      buildJournalSaveBody({
        title: "  A walk outside  ",
        content: "  The rain finally stopped.  ",
        mood: "peaceful",
        tags: "nature, reflection, nature walk",
        isPublic: true,
        storyDate: "2026-07-27",
        audioUrl: " https://example.com/story.m4a ",
        parentStoryId: "22222222-2222-4222-8222-222222222222",
      })
    ).toEqual({
      title: "A walk outside",
      content: "The rain finally stopped.",
      mood: "peaceful",
      tags: ["nature", "reflection", "nature walk"],
      hasAudio: true,
      audioUrl: "https://example.com/story.m4a",
      isPublic: true,
      storyDate: "2026-07-27",
      parentStoryId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("does not claim audio exists when upload did not return a URL", () => {
    expect(
      buildJournalSaveBody({
        title: "Text-only",
        content: "The audio upload failed, but this story remains safe.",
        mood: "neutral",
        tags: "offline, , retry",
        isPublic: false,
        storyDate: "2026-07-27",
      })
    ).toMatchObject({
      tags: ["offline", "retry"],
      hasAudio: false,
      audioUrl: null,
      parentStoryId: null,
    });
  });

  it("keeps mobile tag limits aligned with the save API", () => {
    const baseStory = {
      title: "Tag validation",
      content: "The app should reject a request the API cannot accept.",
      mood: "neutral",
      isPublic: false,
      storyDate: "2026-07-27",
    };

    expect(
      storySchema.safeParse({
        ...baseStory,
        tags: Array.from({ length: 21 }, (_, index) => `tag-${index}`).join(
          ","
        ),
      }).success
    ).toBe(false);
    expect(
      storySchema.safeParse({
        ...baseStory,
        tags: "a".repeat(51),
      }).success
    ).toBe(false);
  });
});
