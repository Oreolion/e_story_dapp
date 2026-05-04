import "../app/globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import type { Metadata } from "next";
import { Inter, Love_Light } from "next/font/google";
import { ProvidersDynamic } from "../components/ProvidersDynamic";
import { Navigation } from "../components/Navigation";
import { Footer } from "../components/Footer";
import { Toaster } from "react-hot-toast";
import { GlobalBackgroundDynamic } from "../components/three/GlobalBackgroundDynamic";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"] });
const loveLight = Love_Light({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-brand",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://estories.app"),
  title: {
    default: "eStories - AI-Powered Sovereign Storytelling",
    template: "%s | eStories",
  },
  description:
    "Record and write stories about anything — personal journals, history, geopolitics, culture, creative non-fiction. AI-powered insights, blockchain provenance, and privacy by default.",
  keywords: [
    "storytelling",
    "blockchain",
    "NFT",
    "AI",
    "speech-to-text",
    "Web3",
    "voice stories",
    "sovereign storytelling",
    "Base",
    "Ethereum",
    "story NFT",
    "eStories",
  ],
  authors: [{ name: "eStories Team" }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://estories.app",
    siteName: "eStories",
    title: "eStories - AI-Powered Sovereign Storytelling",
    description:
      "Record and write stories about anything — personal journals, history, geopolitics, culture, creative non-fiction. AI-powered insights and blockchain provenance.",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "eStories - AI-Powered Sovereign Storytelling",
    description:
      "AI voice transcription, blockchain permanence, and NFT books for your stories.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "eStories",
      url: "https://estories.app",
      logo: "https://estories.app/logo-mark.svg",
      description:
        "AI-powered sovereign storytelling platform that transforms narratives into structured, permanent, and verifiable memory infrastructure.",
    },
    {
      "@type": "WebSite",
      name: "eStories",
      url: "https://estories.app",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://estories.app/social?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}`,
          }}
        />
      </head>
      <body className={`${inter.className} ${loveLight.variable}`}>
        <ProvidersDynamic>
          {/* 3D Background - renders behind all content */}
          <GlobalBackgroundDynamic />

          <div className="relative min-h-screen flex flex-col">
            <Navigation />
            <main className="container mx-auto px-4 py-8 flex-1 relative z-10">
              {children}
            </main>
            <Footer />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                className:
                  "bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
              }}
            />
          </div>
        </ProvidersDynamic>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
