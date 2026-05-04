import type { Metadata } from "next";
import RecordPage from "./RecordPageClient";

export const metadata: Metadata = {
  title: "Record Your Story",
  description:
    "Capture your thoughts and experiences with AI-powered voice transcription. Record, enhance, and save your stories permanently on the blockchain.",
  openGraph: {
    title: "Record Your Story | eStories",
    description:
      "Capture your thoughts and experiences with AI-powered voice transcription.",
  },
};

export default function Page() {
  return <RecordPage />;
}
