"use client";
import dynamic from "next/dynamic";
import React from "react";
const Providers = dynamic(
  () => import("./Provider").then((mod) => mod.Providers),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen grid place-content-center bg-background text-foreground">
        <p className="font-display text-3xl text-center">eStories</p>
        <p role="status" className="text-sm text-muted-foreground mt-4">
          Preparing your experience…
        </p>
      </div>
    ),
  },
);
export function ProvidersDynamic({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
