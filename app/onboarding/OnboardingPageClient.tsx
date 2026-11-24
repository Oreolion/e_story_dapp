"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, ArrowRight, Loader2 } from "lucide-react";
import { trackCompleteRegistration } from "@/lib/meta-pixel";
export default function OnboardingPageClient() {
  const { profile, needsOnboarding, isLoading, completeOnboarding } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const initialized = useRef<string | null>(null);
  useEffect(() => {
    if (profile && initialized.current !== profile.id) {
      initialized.current = profile.id;
      setName(profile.name ?? "");
      setEmail(profile.email ?? "");
      setUsername(profile.username ?? "");
    }
  }, [profile]);
  useEffect(() => {
    if (!isLoading && !profile) router.replace("/");
    else if (!isLoading && profile && !needsOnboarding)
      router.replace("/record");
  }, [isLoading, profile, needsOnboarding, router]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (locked.current || !profile) return;
    if (
      name.trim().length < 2 ||
      !/^[a-zA-Z0-9_]{3,20}$/.test(username.trim()) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      setError(
        "Enter your name, a valid email, and a username of 3–20 letters, numbers or underscores.",
      );
      return;
    }
    locked.current = true;
    setPending(true);
    setError("");
    try {
      await completeOnboarding({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
      });
      trackCompleteRegistration({
        content_name: "eStories Account",
        status: true,
        auth_provider: profile.auth_provider,
      });
      router.replace("/record");
    } catch {
      setError(
        "Your profile could not be saved. Try another username or retry in a moment.",
      );
    } finally {
      locked.current = false;
      setPending(false);
    }
  };
  if (isLoading || !profile)
    return (
      <p role="status" className="py-20 text-center">
        Preparing your account…
      </p>
    );
  return (
    <div className="max-w-lg mx-auto py-10 sm:py-16">
      <BookOpen aria-hidden className="size-8 text-primary mb-8" />
      <p className="eyebrow">Make yourself at home</p>
      <h1 className="font-display text-4xl mt-3">What should we call you?</h1>
      <p className="text-muted-foreground mt-4 mb-8">
        One quick introduction, then your first story. Your stories are private
        unless you choose to publish them. No wallet or vault setup is required.
      </p>
      <form
        onSubmit={submit}
        className="rounded-2xl border bg-card p-6 space-y-5"
        aria-busy={pending}
      >
        <div className="space-y-2">
          <Label htmlFor="onboard-name">Name</Label>
          <Input
            id="onboard-name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboard-username">Username</Label>
          <Input
            id="onboard-username"
            autoComplete="username"
            required
            pattern="[a-zA-Z0-9_]{3,20}"
            maxLength={20}
            aria-describedby="username-help"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={pending}
          />
          <p id="username-help" className="text-xs text-muted-foreground">
            3–20 letters, numbers or underscores. Shown with stories you
            publish.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboard-email">Email</Label>
          <Input
            id="onboard-email"
            autoComplete="email"
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <ArrowRight aria-hidden className="size-4" />
          )}
          Start my first story
        </Button>
      </form>
      <p className="mt-5 text-sm text-muted-foreground">
        You can explore optional wallet and Local Vault features later from your
        profile.
      </p>
    </div>
  );
}
