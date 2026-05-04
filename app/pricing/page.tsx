import type { Metadata } from "next";
import PricingPageClient from "./PricingPageClient";

export const metadata: Metadata = {
  title: "Pricing — eStories",
  description:
    "Affordable plans for every storyteller. Write, analyze, and own your stories with AI-powered insights and blockchain provenance.",
  openGraph: {
    title: "Pricing — eStories",
    description:
      "Affordable plans for every storyteller. Write, analyze, and own your stories.",
  },
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  return <PricingPageClient />;
}
