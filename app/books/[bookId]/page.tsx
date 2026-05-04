import type { Metadata } from "next";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import BookPage from "./BookPageClient";

interface BookPageProps {
  params: Promise<{ bookId: string }>;
}

async function getBookData(bookId: string) {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("books")
      .select(
        `title, description, created_at, story_ids,
        author:users!books_author_id_fkey (name)`
      )
      .eq("id", bookId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: BookPageProps): Promise<Metadata> {
  const { bookId } = await params;
  const baseUrl = "https://estories.app";
  const book = await getBookData(bookId);

  if (!book) {
    return {
      title: "Book Not Found",
      description: "This book could not be found on eStories.",
    };
  }

  const authorData = Array.isArray(book.author)
    ? book.author[0]
    : book.author;
  const authorName = authorData?.name || "Anonymous";
  const chapterCount = book.story_ids?.length || 0;
  const description =
    book.description ||
    `A collection of ${chapterCount} stories by ${authorName} on eStories.`;

  return {
    title: book.title || "Untitled Book",
    description,
    openGraph: {
      type: "book" as any,
      title: book.title || "Untitled Book",
      description,
      url: `${baseUrl}/books/${bookId}`,
      siteName: "eStories",
      authors: [authorName],
    },
    twitter: {
      card: "summary_large_image",
      title: book.title || "Untitled Book",
      description,
    },
    alternates: {
      canonical: `${baseUrl}/books/${bookId}`,
    },
  };
}

export default async function Page({ params }: BookPageProps) {
  const { bookId } = await params;
  const baseUrl = "https://estories.app";
  const book = await getBookData(bookId);

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
        name: "Library",
        item: `${baseUrl}/library`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: book?.title || "Book",
        item: `${baseUrl}/books/${bookId}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <BookPage params={params} />
    </>
  );
}
