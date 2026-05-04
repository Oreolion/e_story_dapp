"use client";

import { useAccount } from "wagmi";
import { AlertTriangle } from "lucide-react";

export function TestnetBanner() {
  const { isConnected } = useAccount();

  if (!isConnected) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-1.5 text-center">
      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1.5">
        <AlertTriangle className="w-3 h-3" />
        Smart contracts on Base Sepolia testnet — tokens have no real value yet.
      </p>
    </div>
  );
}
