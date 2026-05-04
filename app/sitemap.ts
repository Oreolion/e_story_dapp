import type { MetadataRoute } from "next";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://estories.app";

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/social`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  try {
    const supabase = createSupabaseAdminClient();
    const { data: stories, error } = await supabase
      .from("stories")
      .select("id, story_date, created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error || !stories) {
      console.error("[SITEMAP] Error fetching stories:", error);
      return staticRoutes;
    }

    const storyRoutes: MetadataRoute.Sitemap = stories.map((story) => ({
      url: `${baseUrl}/story/${story.id}`,
      lastModified: new Date(story.story_date || story.created_at),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

    return [...staticRoutes, ...storyRoutes];
  } catch (err) {
    console.error("[SITEMAP] Unexpected error:", err);
    return staticRoutes;
  }
}
