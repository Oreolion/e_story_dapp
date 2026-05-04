"use client";

import { useCallback } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "react-hot-toast";

/**
 * Hook that provides a guard function for wallet-dependent actions.
 *
 * When the user tries to perform a Web3 action (tip, mint, paywall, follow, CRE verify):
 * - If wallet is connected → returns true (proceed)
 * - If user is OAuth-only (no wallet linked) → shows guidance toast + opens RainbowKit modal
 * - If not authenticated at all → shows sign-in prompt
 *
 * Usage:
 *   const { requireWallet } = useWalletGuard();
 *   const handleTip = () => { if (!requireWallet("tip authors")) return; ... };
 */
export function useWalletGuard() {
  const { isConnected } = useAccount();
  const { profile } = useAuth();
  const { openConnectModal } = useConnectModal();

  const requireWallet = useCallback(
    (actionLabel?: string): boolean => {
      // Already connected — good to go
      if (isConnected) return true;

      const action = actionLabel ? ` to ${actionLabel}` : "";

      // Not signed in at all
      if (!profile) {
        toast.error(`Please sign in${action}.`);
        return false;
      }

      // OAuth user without wallet linked
      toast(
        `A Web3 wallet is required${action}. Connect one now to unlock blockchain features.`,
        {
          icon: "🔗",
          duration: 5000,
        }
      );

      // Open RainbowKit connect modal so they can connect immediately
      if (openConnectModal) {
        openConnectModal();
      }

      return false;
    },
    [isConnected, profile, openConnectModal]
  );

  return { requireWallet, isWalletConnected: isConnected };
}
