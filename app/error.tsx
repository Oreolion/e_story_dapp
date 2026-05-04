"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#d4a04a] via-[#9b7dd4] to-[#6c3dbd] opacity-20" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground max-w-md">
          An unexpected error occurred. Our team has been notified.
        </p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] text-white text-sm font-medium"
      >
        Try Again
      </button>
    </div>
  );
}
