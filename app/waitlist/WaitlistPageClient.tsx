"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mail, Check, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function WaitlistPageClient() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 400) {
          setError(data?.error || "Please enter a valid email.");
        } else if (res.status === 429) {
          setError("Too many requests. Please try again later.");
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }

      setSubmitted(true);
      setEmail("");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg text-center space-y-8"
      >
        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Join the{" "}
            <span className="text-gradient-insight">eStories</span>{" "}
            Waitlist
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto">
            Be the first to know when we launch new features, the mobile app,
            and early access to AI-powered storytelling tools.
          </p>
        </div>

        <div className="w-full max-w-md mx-auto">
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-6"
            >
              <div className="w-12 h-12 rounded-full bg-[hsl(var(--growth-500)/0.15)] flex items-center justify-center">
                <Check className="w-6 h-6 text-[hsl(var(--growth-500))]" />
              </div>
              <p className="font-medium text-[hsl(var(--growth-500))]">
                You&apos;re on the list!
              </p>
              <p className="text-sm text-muted-foreground">
                We&apos;ll be in touch when there&apos;s something exciting to share.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={loading}
                  className="flex-1 h-12 rounded-lg border border-[hsl(var(--memory-500)/0.2)] bg-[hsl(var(--void-surface))] px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--memory-500)/0.3)] focus:border-transparent transition-all disabled:opacity-50"
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 px-6 btn-solid-memory"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Joining...
                    </span>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Join
                    </>
                  )}
                </Button>
              </form>
              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}
            </div>
          )}
        </div>

        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
