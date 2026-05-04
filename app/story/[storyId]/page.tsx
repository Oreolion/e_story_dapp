import type { Metadata } from "next";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import StoryPage from "./StoryPageClient";

interface StoryPageProps {
  params: Promise<{ storyId: string }>;
}

async function getStoryData(storyId: string) {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("stories")
      .select(`title, content, teaser, tags, mood, is_public, story_date, created_at, author_id`)
      .eq("id", storyId)
      .maybeSingle();

    if (error || !data) return null;

    // Fetch author name separately (works for both wallet and OAuth users)
    let authorName: string | null = null;
    if (data.author_id) {
      const { data: authorRow } = await supabase
        .from("users")
        .select("name")
        .eq("id", data.author_id)
        .single();
      authorName = authorRow?.name || null;
    }

    return { ...data, author: authorName ? { name: authorName } : null };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: StoryPageProps): Promise<Metadata> {
  const { storyId } = await params;
  const baseUrl = "https://estories.app";
  const story = await getStoryData(storyId);

  if (!story) {
    return {
      title: "Story Not Found",
      description: "This story could not be found on eStories.",
    };
  }

  // Don't leak private story content
  if (!story.is_public) {
    return {
      title: "Private Story",
      description: "This story is private.",
      robots: { index: false, follow: false },
    };
  }

  const authorData = Array.isArray(story.author)
    ? story.author[0]
    : story.author;
  const authorName = authorData?.name || "Anonymous";
  const description =
    story.teaser ||
    (story.content ? story.content.slice(0, 160).trim() + "..." : "");
  const tags = story.tags || [];

  return {
    title: story.title || "Untitled Story",
    description,
    openGraph: {
      type: "article",
      title: story.title || "Untitled Story",
      description,
      url: `${baseUrl}/story/${storyId}`,
      siteName: "eStories",
      publishedTime: story.story_date || story.created_at,
      authors: [authorName],
      tags,
      images: [`/story/${storyId}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title: story.title || "Untitled Story",
      description,
      images: [`/story/${storyId}/opengraph-image`],
    },
    alternates: {
      canonical: `${baseUrl}/story/${storyId}`,
    },
  };
}

export default async function Page({ params }: StoryPageProps) {
  const { storyId } = await params;
  const baseUrl = "https://estories.app";
  const story = await getStoryData(storyId);

  // Build JSON-LD for public stories
  let jsonLd = null;
  if (story?.is_public) {
    const authorData = Array.isArray(story.author)
      ? story.author[0]
      : story.author;
    const authorName = authorData?.name || "Anonymous";

    jsonLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: story.title || "Untitled Story",
      description:
        story.teaser ||
        (story.content ? story.content.slice(0, 160).trim() + "..." : ""),
      datePublished: story.story_date || story.created_at,
      author: {
        "@type": "Person",
        name: authorName,
      },
      publisher: {
        "@type": "Organization",
        name: "eStories",
        url: "https://estories.app",
      },
      url: `${baseUrl}/story/${storyId}`,
      keywords: (story.tags || []).join(", "),
      image: `${baseUrl}/story/${storyId}/opengraph-image`,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `${baseUrl}/story/${storyId}`,
      },
    };
  }

  // Build BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Community",
        item: `${baseUrl}/social`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: story?.title || "Story",
        item: `${baseUrl}/story/${storyId}`,
      },
    ],
  };

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <StoryPage params={params} />
    </>
  );
}
