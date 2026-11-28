"use client";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { AuthModal } from "@/components/AuthModal";
import { Button } from "@/components/ui/button";
import SocialPage from "@/app/social/SocialPageClient";
export default function HomeFeed() {
  const { profile, isLoading, needsOnboarding } = useAuth();
  const [open, setOpen] = useState(false);
  if (isLoading || needsOnboarding)
    return (
      <p role="status" className="py-20 text-center">
        Preparing your home…
      </p>
    );
  if (!profile)
    return (
      <section className="mx-auto max-w-lg space-y-5 py-16 text-center">
        <p className="eyebrow">Your storytelling space</p>
        <h1 className="text-4xl font-semibold">
          A new perspective is waiting.
        </h1>
        <p className="text-muted-foreground">
          Log in to find your feed, follow writers and keep your own stories.
        </p>
        <Button onClick={() => setOpen(true)}>Log in</Button>
        <AuthModal
          isOpen={open}
          onClose={() => setOpen(false)}
          returnTo="/home"
        />
      </section>
    );
  return <SocialPage key={profile.id} home />;
}
