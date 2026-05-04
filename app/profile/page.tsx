import type { Metadata } from "next";
import ProfilePage from "./ProfilePageClient";

export const metadata: Metadata = {
  title: "Profile & Settings",
  description:
    "Manage your eStories account, track writing progress, view achievements, and configure your preferences.",
  openGraph: {
    title: "Profile & Settings | eStories",
    description:
      "Manage your eStories account and track your writing progress.",
  },
};

export default function Page() {
  return <ProfilePage />;
}
