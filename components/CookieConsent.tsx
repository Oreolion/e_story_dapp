"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Cookie } from "lucide-react";
import Link from "next/link";

const CONSENT_KEY = "estories_cookie_consent";

export type ConsentChoice = "all" | "essential" | null;

/**
 * Read consent from localStorage (safe for SSR).
 */
export function getConsent(): ConsentChoice {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw === "all" || raw === "essential") return raw;
  } catch {
    // localStorage blocked / private mode
  }
  return null;
}

/**
 * Cookie Consent Banner — GDPR-compliant.
 * Meta Pixel and other marketing trackers only load when consent === "all".
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [consent, setConsentState] = useState<ConsentChoice>(null);

  useEffect(() => {
    const saved = getConsent();
    setConsentState(saved);
    if (!saved) {
      // Small delay so banner doesn't flash on initial load
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (choice: ConsentChoice) => {
    try {
      if (choice) localStorage.setItem(CONSENT_KEY, choice);
      else localStorage.removeItem(CONSENT_KEY);
    } catch {
      // ignore
    }
    setConsentState(choice);
    setVisible(false);
    // Dispatch event so other components (e.g. MetaPixel) can react
    window.dispatchEvent(new Event("consentUpdated"));
  };

  const acceptAll = () => saveConsent("all");
  const acceptEssential = () => saveConsent("essential");
  const dismiss = () => setVisible(false);

  // Don't render if consent already given or banner dismissed
  if (!visible || consent) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4">
      <div className="max-w-4xl mx-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-5 md:p-6 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row gap-4 md:items-start">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Cookie className="w-5 h-5 text-[hsl(var(--memory-500))]" />
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                We value your privacy
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              We use cookies and similar technologies to improve your experience,
              analyze site traffic, and serve personalised ads via the Meta Pixel.
              You can choose which cookies you accept. Read more in our{" "}
              <Link
                href="/privacy"
                className="underline text-[hsl(var(--memory-600))] hover:text-[hsl(var(--memory-500))]"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 md:pt-1 shrink-0">
            <Button
              size="sm"
              onClick={acceptAll}
              className="bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] hover:from-[hsl(var(--memory-500))] hover:to-[hsl(var(--insight-500))] text-white"
            >
              Accept All
            </Button>
            <Button size="sm" variant="outline" onClick={acceptEssential}>
              Essential Only
            </Button>
            <button
              onClick={dismiss}
              className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
              aria-label="Dismiss cookie banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
