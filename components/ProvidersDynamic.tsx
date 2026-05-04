"use client";

// This file dynamically imports your main Providers component
// with Server-Side Rendering (SSR) disabled.
// This is the fix for the "indexedDB is not defined" error.

import dynamic from "next/dynamic";
import React from "react";

// Dynamically import the Providers component with ssr: false
const Providers = dynamic(
  () => import("./Provider").then((mod) => mod.Providers),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
        <div className="flex flex-col items-center gap-6">
          {/* Animated logo pulse */}
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#d4a04a] via-[#9b7dd4] to-[#6c3dbd] animate-pulse" />
            <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-[#d4a04a] via-[#9b7dd4] to-[#6c3dbd] opacity-30 animate-ping" />
          </div>

          {/* Brand text */}
          <h2 className="text-3xl font-bold bg-gradient-to-r from-[#d4a04a] via-[#9b7dd4] to-[#6c3dbd] bg-clip-text text-transparent" style={{ fontFamily: "var(--font-brand)", WebkitTextStroke: "0.5px currentColor" }}>
            eStories
          </h2>

          {/* Subtle status */}
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#9b7dd4] animate-pulse" />
            Preparing your experience
          </div>
        </div>
      </div>
    ),
  }
);

export function ProvidersDynamic({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}