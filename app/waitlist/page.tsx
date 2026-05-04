import type { Metadata } from "next";
import WaitlistPageClient from "./WaitlistPageClient";

export const metadata: Metadata = {
  title: "Join the Waitlist — eStories",
  description:
    "Be the first to know when eStories launches new features. Join our waitlist for early access to AI-powered sovereign storytelling.",
  openGraph: {
    title: "Join the Waitlist — eStories",
    description:
      "Be the first to know when eStories launches new features. Join our waitlist for early access.",
  },
  robots: { index: true, follow: true },
};

export default function WaitlistPage() {
  return <WaitlistPageClient />;
}
