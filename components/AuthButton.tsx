"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useDisconnect } from "wagmi";
import { AuthModal } from "./AuthModal";
import { authDestination, clearDestination, pendingDestination, rememberDestination } from "@/lib/auth/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LogOut,
  User,
  CreditCard,
  TrainTrack,
  Wallet,
  Check,
} from "lucide-react";

function truncateAddress(addr: string | null): string {
  if (!addr) return "User";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function AuthButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, isLoading, needsOnboarding, signOut } = useAuth();
  const { disconnect } = useDisconnect();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authIntent, setAuthIntent] = useState<"login" | "signup">("login");

  const handleSignOut = async () => {
    clearDestination();
    await signOut();
    disconnect();
  };

  // Redirect to onboarding page when needed (unless already there)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("auth_error")) { clearDestination(); return; }
    const intent = pendingDestination();
    const target = authDestination({ loading: isLoading, authenticated: !!profile, onboarding: needsOnboarding, pathname, intent });
    if (!target) return;
    if (target === "/onboarding") {
      if (!intent && pathname !== "/" && pathname !== "/welcome" && pathname !== "/home") rememberDestination(pathname + window.location.search);
    } else clearDestination();
    if (target !== pathname) router.replace(target);
  }, [needsOnboarding, profile, isLoading, pathname, router]);

  // Loading — skeleton prevents "Connect" flash after OAuth redirect
  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <div className="w-7 h-7 rounded-full bg-muted animate-pulse" />
        <div className="hidden sm:block w-16 h-4 bg-muted animate-pulse rounded" />
      </Button>
    );
  }

  // Not authenticated at all
  if (!profile) {
    return (
      <>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => { setAuthIntent("login"); setShowAuthModal(true); }}
            className="min-h-11 border-primary/40 px-3 font-bold sm:px-5"
          >
            Log in
          </Button>
          <Button
            onClick={() => { setAuthIntent("signup"); setShowAuthModal(true); }}
            className="min-h-11 px-3 font-bold shadow-sm sm:px-5"
          >
            Sign up
          </Button>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          intent={authIntent}
        />
      </>
    );
  }

  // Needs onboarding — show a minimal button while redirect happens
  if (needsOnboarding && profile) {
    return (
      <Button variant="outline" size="sm" disabled>
        {profile.auth_provider === "google"
          ? (profile.name ?? "Setting up...")
          : "Setting up..."}
      </Button>
    );
  }

  // Authenticated — unified avatar dropdown for all auth types
  if (profile) {
    const displayName =
      profile.name ??
      profile.username ??
      truncateAddress(profile.wallet_address);
    const initials =
      profile.name?.[0]?.toUpperCase() ??
      profile.username?.[0]?.toUpperCase() ??
      profile.wallet_address?.slice(2, 4)?.toUpperCase() ??
      "U";

    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Open account menu"
              variant="ghost"
              size="sm"
              className="gap-2 px-2"
            >
              <Avatar className="w-7 h-7">
                <AvatarImage src={profile.avatar ?? undefined} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm truncate max-w-[100px]">
                {displayName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link
                href="/profile"
                className="flex items-center gap-2 cursor-pointer"
              >
                <User className="w-4 h-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/pricing"
                className="flex items-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                Pricing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/tracker"
                className="flex items-center gap-2 min-h-11"
              >
                <TrainTrack className="size-4" />
                Tracker
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {profile.wallet_address ? (
              <DropdownMenuItem disabled className="opacity-70">
                <Check className="w-4 h-4 mr-2 text-green-500" />
                <span className="truncate text-xs">
                  Wallet: {truncateAddress(profile.wallet_address)}
                </span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setShowAuthModal(true)}>
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-red-600 dark:text-red-400"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  return null;
}
