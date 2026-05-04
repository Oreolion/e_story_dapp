"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useAccount, useDisconnect } from "wagmi";
import { AuthModal } from "./AuthModal";
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
  Wallet,
  Loader2,
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
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    disconnect();
  };

  // Redirect to onboarding page when needed (unless already there)
  useEffect(() => {
    if (needsOnboarding && profile && pathname !== "/onboarding") {
      router.push("/onboarding");
    }
  }, [needsOnboarding, profile, pathname, router]);

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
  if (!profile && !isConnected) {
    return (
      <>
        <Button
          onClick={() => setShowAuthModal(true)}
          size="sm"
          className="bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] text-white"
        >
          Connect
        </Button>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  // Wallet connected but no profile yet (signing in progress)
  if (isConnected && !profile) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Signing in...</span>
      </Button>
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
            <Button variant="ghost" size="sm" className="gap-2 px-2">
              <Avatar className="w-7 h-7">
                <AvatarImage src={profile.avatar ?? undefined} />
                <AvatarFallback className="text-xs bg-gradient-to-br from-[hsl(var(--memory-500))] to-[hsl(var(--insight-500))] text-white">
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
              <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                <User className="w-4 h-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/pricing" className="flex items-center gap-2 cursor-pointer">
                <CreditCard className="w-4 h-4" />
                Pricing
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
