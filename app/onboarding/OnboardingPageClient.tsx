"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { useVault } from "@/app/hooks/useVault";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { PinEntryModal } from "@/components/vault/PinEntryModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Shield,
  Wallet,
  Sparkles,
  ChevronRight,
  Check,
  BookOpen,
  SkipForward,
  Loader2,
} from "lucide-react";
import { BrandedLoader } from "@/components/ui/branded-loader";

type Step = "profile" | "vault" | "wallet" | "done";

const stepConfig = {
  profile: { icon: User, title: "Your Profile", num: 1 },
  vault: { icon: Shield, title: "Protect Your Stories", num: 2 },
  wallet: { icon: Wallet, title: "Web3 (Optional)", num: 3 },
  done: { icon: Sparkles, title: "All Set!", num: 4 },
};

export default function OnboardingPageClient() {
  const router = useRouter();
  const { profile, needsOnboarding, isLoading: authLoading, completeOnboarding } = useAuth();
  const { isSetup: vaultIsSetup, setup: vaultSetup } = useVault();
  const { openConnectModal } = useConnectModal();
  const { isConnected: walletConnected } = useAccount();

  // Determine steps based on auth provider
  const isWalletUser = profile?.auth_provider === "wallet";
  const steps: Step[] = isWalletUser
    ? ["profile", "vault", "done"] // Wallet users already have a wallet
    : ["profile", "vault", "wallet", "done"];

  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex] ?? "done";

  // Profile form state
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Vault state
  const [showPinModal, setShowPinModal] = useState(false);
  const [vaultDone, setVaultDone] = useState(false);

  // Prefill from profile (Google users get name/email from OAuth)
  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setEmail(profile.email ?? "");
    }
  }, [profile]);

  // Redirect if already onboarded or not authenticated
  useEffect(() => {
    if (authLoading) return;
    if (!profile) {
      router.replace("/");
      return;
    }
    if (!needsOnboarding) {
      router.replace("/");
    }
  }, [authLoading, needsOnboarding, profile, router]);

  // Watch for wallet connection to auto-advance
  useEffect(() => {
    if (step === "wallet" && walletConnected) {
      const timer = setTimeout(() => {
        setStepIndex((i) => Math.min(i + 1, steps.length - 1));
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [step, walletConnected, steps.length]);

  // Loading state
  if (authLoading || !profile) {
    return <BrandedLoader fullScreen message="Preparing your experience" />;
  }

  const nextStep = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));

  // --- Profile step handler ---
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError("Username must be 3-20 characters (letters, numbers, underscores)");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    try {
      await completeOnboarding({ name, username, email });
      nextStep();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Vault PIN submit ---
  const handleVaultPinSubmit = async (pin: string) => {
    await vaultSetup(pin);
    setVaultDone(true);
    setShowPinModal(false);
    setTimeout(() => nextStep(), 600);
  };

  // --- Wallet connect ---
  const handleConnectWallet = () => {
    openConnectModal?.();
  };

  // --- Finish ---
  const handleFinish = () => {
    router.push("/");
  };

  // Progress indicator
  const progress = ((stepIndex + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-br from-background via-background to-[hsl(var(--memory-50)/0.3)] dark:to-[hsl(var(--memory-950)/0.3)]">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <BookOpen className="w-8 h-8 text-[hsl(var(--memory-600))]" />
        <span className="text-3xl font-bold bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] bg-clip-text text-transparent" style={{ fontFamily: "var(--font-brand)", WebkitTextStroke: "0.5px currentColor" }}>
          eStories
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md mb-8">
        <div className="flex justify-between mb-2">
          {steps.map((s, i) => {
            const cfg = stepConfig[s];
            const Icon = cfg.icon;
            const isActive = i === stepIndex;
            const isDone = i < stepIndex;
            return (
              <div
                key={s}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-[hsl(var(--memory-600))]"
                    : isDone
                    ? "text-[hsl(var(--growth-600))]"
                    : "text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{cfg.title}</span>
              </div>
            );
          })}
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[hsl(var(--memory-500))] to-[hsl(var(--insight-500))] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {/* ─── Step: Profile ─── */}
            {step === "profile" && (
              <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl border shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-1">Complete Your Profile</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Tell us a bit about yourself to get started
                </p>

                <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ob-name">Display Name *</Label>
                    <Input
                      id="ob-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your display name"
                      minLength={2}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ob-username">Username *</Label>
                    <Input
                      id="ob-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="your_username"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Letters, numbers, and underscores only
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ob-email">Email *</Label>
                    <Input
                      id="ob-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      For notifications and recovery
                    </p>
                  </div>

                  {error && (
                    <p className="text-sm text-destructive text-center">{error}</p>
                  )}

                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        Continue
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </form>
              </div>
            )}

            {/* ─── Step: Vault ─── */}
            {step === "vault" && (
              <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl border shadow-lg p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[hsl(var(--insight-100))] dark:bg-[hsl(var(--insight-900)/0.3)] flex items-center justify-center">
                  <Shield className="w-7 h-7 text-[hsl(var(--insight-600))]" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Protect Your Stories</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Set up a 6-digit PIN to encrypt your stories locally on this device.
                  Your stories stay private — even we can&apos;t read them.
                </p>

                {vaultDone || vaultIsSetup ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-[hsl(var(--growth-600))] font-medium">
                      <Check className="w-5 h-5" />
                      Vault is set up
                    </div>
                    <Button variant="outline" onClick={nextStep}>
                      Continue <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Button onClick={() => setShowPinModal(true)} className="w-full">
                      <Shield className="w-4 h-4 mr-2" />
                      Set Up PIN
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={nextStep}
                    >
                      <SkipForward className="w-4 h-4 mr-1" />
                      Skip for now
                    </Button>
                  </div>
                )}

                <PinEntryModal
                  open={showPinModal}
                  onOpenChange={setShowPinModal}
                  mode="setup"
                  onSubmit={handleVaultPinSubmit}
                />
              </div>
            )}

            {/* ─── Step: Wallet (Google users only) ─── */}
            {step === "wallet" && (
              <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl border shadow-lg p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[hsl(var(--memory-100))] dark:bg-[hsl(var(--memory-900)/0.3)] flex items-center justify-center">
                  <Wallet className="w-7 h-7 text-[hsl(var(--memory-600))]" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Connect a Wallet</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Optionally link a crypto wallet to unlock Web3 features like
                  tipping creators, minting story books, and on-chain verification.
                </p>

                {walletConnected ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-[hsl(var(--growth-600))] font-medium">
                      <Check className="w-5 h-5" />
                      Wallet connected
                    </div>
                    <Button variant="outline" onClick={nextStep}>
                      Continue <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Button onClick={handleConnectWallet} className="w-full">
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect Wallet
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={nextStep}
                    >
                      <SkipForward className="w-4 h-4 mr-1" />
                      Skip for now
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      You can always connect a wallet later from your profile
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ─── Step: Done ─── */}
            {step === "done" && (
              <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl border shadow-lg p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12, delay: 0.1 }}
                  className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-[hsl(var(--growth-400))] to-[hsl(var(--growth-600))] flex items-center justify-center"
                >
                  <Sparkles className="w-8 h-8 text-white" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">
                  Welcome, {name || profile.name || "Storyteller"}!
                </h2>
                <p className="text-muted-foreground mb-8">
                  Your space is ready. Start capturing the stories that matter to you.
                </p>
                <Button
                  size="lg"
                  onClick={handleFinish}
                  className="w-full bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] text-white"
                >
                  <BookOpen className="w-5 h-5 mr-2" />
                  Start Writing
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
