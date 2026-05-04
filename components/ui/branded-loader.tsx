"use client";

import { cn } from "@/lib/utils";

interface BrandedLoaderProps {
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Optional status message */
  message?: string;
  /** Show the full-screen centered version */
  fullScreen?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: { box: "w-8 h-8 rounded-lg", text: "text-lg", dot: "w-1 h-1" },
  md: { box: "w-12 h-12 rounded-xl", text: "text-2xl", dot: "w-1.5 h-1.5" },
  lg: { box: "w-16 h-16 rounded-2xl", text: "text-3xl", dot: "w-1.5 h-1.5" },
};

export function BrandedLoader({
  size = "md",
  message,
  fullScreen = false,
  className,
}: BrandedLoaderProps) {
  const s = sizeClasses[size];

  const loader = (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Animated logo pulse */}
      <div className="relative">
        <div
          className={cn(
            s.box,
            "bg-gradient-to-br from-[#d4a04a] via-[#9b7dd4] to-[#6c3dbd] animate-pulse"
          )}
        />
        <div
          className={cn(
            s.box,
            "absolute inset-0 bg-gradient-to-br from-[#d4a04a] via-[#9b7dd4] to-[#6c3dbd] opacity-30 animate-ping"
          )}
        />
      </div>

      {/* Brand text — only show on md and lg */}
      {size !== "sm" && (
        <h2
          className={cn(
            s.text,
            "font-bold bg-gradient-to-r from-[#d4a04a] via-[#9b7dd4] to-[#6c3dbd] bg-clip-text text-transparent"
          )}
          style={{
            fontFamily: "var(--font-brand)",
            WebkitTextStroke: "0.5px currentColor",
          }}
        >
          eStories
        </h2>
      )}

      {/* Optional status message */}
      {message && (
        <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
          <span
            className={cn(
              s.dot,
              "inline-block rounded-full bg-[#9b7dd4] animate-pulse"
            )}
          />
          {message}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
        {loader}
      </div>
    );
  }

  return loader;
}
