import { ImageResponse } from "next/og";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";

export const runtime = "edge";
export const alt = "eStories - Story";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const moodGradients: Record<string, string> = {
  happy: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
  sad: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
  excited: "linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)",
  anxious: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
  peaceful: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
  reflective: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  grateful: "linear-gradient(135deg, #f59e0b 0%, #10b981 100%)",
  neutral: "linear-gradient(135deg, #1a56db 0%, #7c3aed 100%)",
};

export default async function OGImage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;

  let title = "Story on eStories";
  let authorName = "Anonymous";
  let mood = "neutral";
  let tags: string[] = [];
  let dateStr = "";

  try {
    const supabase = createSupabaseAdminClient();
    const { data: story } = await supabase
      .from("stories")
      .select(`title, mood, tags, story_date, created_at, is_public, author_id`)
      .eq("id", storyId)
      .maybeSingle();

    if (story && story.is_public) {
      title = story.title || "Untitled Story";
      mood = story.mood || "neutral";
      tags = (story.tags || []).slice(0, 3);
      if (story.author_id) {
        const { data: authorRow } = await supabase
          .from("users")
          .select("name")
          .eq("id", story.author_id)
          .single();
        authorName = authorRow?.name || "Anonymous";
      }
      const date = new Date(story.story_date || story.created_at);
      dateStr = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  } catch {
    // fallback to defaults
  }

  const gradient = moodGradients[mood] || moodGradients.neutral;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          background: gradient,
          fontFamily: "sans-serif",
        }}
      >
        {/* Top: branding */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              color: "rgba(255,255,255,0.8)",
            }}
          >
            eStories
          </div>
          {dateStr && (
            <div
              style={{
                display: "flex",
                fontSize: 18,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {dateStr}
            </div>
          )}
        </div>

        {/* Center: title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: title.length > 50 ? 40 : 52,
              fontWeight: 800,
              color: "white",
              lineHeight: 1.2,
              maxWidth: 900,
            }}
          >
            {title.length > 80 ? title.slice(0, 80) + "..." : title}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            by {authorName}
          </div>
        </div>

        {/* Bottom: tags */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          {tags.map((tag) => (
            <div
              key={tag}
              style={{
                display: "flex",
                padding: "8px 20px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: 9999,
                color: "white",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              #{tag}
            </div>
          ))}
        </div>

        {/* Decorative elements */}
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 250,
            height: 250,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
