import type { Metadata } from "next";
import NotificationsPage from "./NotificationsPageClient";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Your activity feed on eStories — likes, follows, tips, and comments on your stories.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <NotificationsPage />;
}
