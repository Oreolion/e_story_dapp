import type { Metadata } from "next";
import OnboardingPageClient from "./OnboardingPageClient";

export const metadata: Metadata = {
  title: "Welcome to eStories",
  description: "Set up your profile and start telling your stories.",
  robots: { index: false },
};

export default function OnboardingPage() {
  return <OnboardingPageClient />;
}
