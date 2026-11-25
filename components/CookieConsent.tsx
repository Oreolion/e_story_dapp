"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  getConsent,
  saveConsent,
  type ConsentChoice,
} from "@/lib/privacy/consent";
export { getConsent, type ConsentChoice } from "@/lib/privacy/consent";
export function CookiePreferencesButton() {
  return (
    <button
      className="min-h-11 underline underline-offset-4"
      onClick={() => window.dispatchEvent(new Event("openCookiePreferences"))}
    >
      Cookie preferences
    </button>
  );
}
export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    setVisible(!getConsent());
    const open = () => setVisible(true);
    window.addEventListener("openCookiePreferences", open);
    return () => window.removeEventListener("openCookiePreferences", open);
  }, []);
  const save = (choice: Exclude<ConsentChoice, null>) => {
    const saved = saveConsent(choice);
    setStorageError(!saved);
    if (saved) setVisible(false);
    window.dispatchEvent(new Event("consentUpdated"));
  };
  if (!visible) return null;
  // In document flow: never covers a focused control, recording button or mobile navigation.
  return (
    <aside
      aria-label="Cookie preferences"
      className="border-b bg-card px-4 py-4"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">
          Essential cookies keep you signed in. Optional marketing cookies help
          us understand campaigns.{" "}
          <Link className="underline underline-offset-4" href="/privacy">
            Privacy policy
          </Link>
        </p>
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <Button variant="outline" onClick={() => save("essential")}>
            Essential only
          </Button>
          <Button variant="outline" onClick={() => save("all")}>
            Accept all
          </Button>
        </div>
      </div>
      {storageError && (
        <p role="status" className="text-sm mt-2">
          Your browser could not save this preference. Optional marketing stays
          off until a choice can be saved.
        </p>
      )}
    </aside>
  );
}
