import type { Metadata } from "next";
import TrackerPage from "./TrackerPageClient";

export const metadata: Metadata = {
  title: "Daily Tracker",
  description:
    "Track daily habits, log your mood, and let AI generate journal entries from your day. Build consistent writing habits.",
  openGraph: {
    title: "Daily Tracker | eStories",
    description:
      "Track daily habits, log your mood, and let AI generate journal entries.",
  },
};

export default function Page() {
  return <TrackerPage />;
}
