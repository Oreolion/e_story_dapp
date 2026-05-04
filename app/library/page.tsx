import type { Metadata } from "next";
import LibraryPage from "./LibraryPageClient";

export const metadata: Metadata = {
  title: "Your Story Archive",
  description:
    "Browse your personal story archive. View stories, compiled books, themes, and life patterns discovered by AI.",
  openGraph: {
    title: "Your Story Archive | eStories",
    description:
      "Browse your personal story archive and discover AI-powered patterns.",
  },
};

export default function Page() {
  return <LibraryPage />;
}
