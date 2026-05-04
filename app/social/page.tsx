import type { Metadata } from "next";
import SocialPage from "./SocialPageClient";

export const metadata: Metadata = {
  title: "Community Stories",
  description:
    "Discover inspiring stories from writers around the world. Read, like, tip creators, and join the eStories community.",
  openGraph: {
    title: "Community Stories | eStories",
    description:
      "Discover inspiring stories from writers around the world on eStories.",
  },
};

export default function Page() {
  return <SocialPage />;
}
