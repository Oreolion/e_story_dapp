"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Loader2, X, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "./LogoMark";
import { AuthBrandPanel } from "./auth/AuthBrandPanel";
import { clearDestination, rememberDestination } from "@/lib/auth/navigation";
export function AuthModal({
  isOpen,
  onClose,
  intent = "login",
  returnTo,
}: {
  isOpen: boolean;
  onClose: () => void;
  intent?: "login" | "signup";
  returnTo?: string;
}) {
  const { signInWithGoogle } = useAuth();
  const { openConnectModal } = useConnectModal();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [intentOverride, setIntentOverride] = useState<
    "login" | "signup" | null
  >(null);
  const activeIntent = intentOverride ?? intent;
  const locked = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isOpen) {
      setError("");
      setIntentOverride(null);
    }
  }, [isOpen]);
  const google = async () => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError("");
    try {
      rememberDestination(returnTo ?? window.location.pathname + window.location.search);
      await signInWithGoogle();
    } catch {
      clearDestination();
      setError("Google sign-in could not start. Please try again.");
    } finally {
      locked.current = false;
      setPending(false);
    }
  };
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-2rem)] max-w-4xl max-h-[calc(100dvh-2rem)] overflow-y-auto gap-0 p-0 sm:max-w-4xl md:grid-cols-[.9fr_1.1fr]"
        onOpenAutoFocus={() => {
          returnFocus.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // This controlled dialog has no Radix DialogTrigger. Preserve the
          // opener, but let a subsequently opened wallet dialog retain focus.
          if (
            !document.querySelector('[role="dialog"]') &&
            returnFocus.current?.isConnected
          ) {
            returnFocus.current.focus({ preventScroll: true });
          }
        }}
      >
        <AuthBrandPanel />
        <div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-12">
          <div className="mb-7 flex items-center gap-1 md:hidden">
            <span aria-hidden="true">
              <LogoMark size={36} />
            </span>
            <span className="brand-wordmark text-3xl">eStories</span>
          </div>
          <DialogHeader className="text-left">
            <p className="eyebrow">
              {activeIntent === "signup"
                ? "Your next chapter starts here"
                : "Welcome back"}
            </p>
            <DialogTitle className="mt-2 text-3xl leading-tight tracking-tight">
              {activeIntent === "signup"
                ? "Create your eStories account"
                : "Log in to eStories"}
            </DialogTitle>
            <DialogDescription className="mt-2 text-base leading-relaxed">
              {activeIntent === "signup"
                ? "Sign up with Google, choose your profile, and start your first story. No wallet needed."
                : "Pick up where you left off. Your stories, drafts and archive are waiting for you. No wallet needed."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-8 space-y-5" aria-busy={pending}>
            <Button
              className="min-h-13 w-full border border-slate-300 bg-white font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
              onClick={google}
              disabled={pending}
            >
              {pending ? (
                <Loader2 aria-hidden="true" className="size-5 animate-spin" />
              ) : (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 48 48"
                  className="size-5 shrink-0"
                >
                  <path
                    fill="#4285F4"
                    d="M43.6 24.46c0-1.36-.12-2.66-.35-3.92H24v7.42h10.99a9.4 9.4 0 0 1-4.08 6.18v5.14h6.61c3.87-3.57 6.08-8.82 6.08-14.82Z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 44c5.4 0 9.93-1.79 13.24-4.84l-6.61-5.14c-1.79 1.2-4.08 1.92-6.63 1.92-5.21 0-9.62-3.52-11.2-8.24H5.97v5.3A20 20 0 0 0 24 44Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M12.8 27.7A12 12 0 0 1 12.18 24c0-1.28.22-2.53.62-3.7V15H5.97A20 20 0 0 0 4 24c0 3.23.77 6.29 1.97 9l6.83-5.3Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M24 12.06c2.94 0 5.57 1.01 7.65 2.99l5.74-5.74A19.2 19.2 0 0 0 24 4 20 20 0 0 0 5.97 15l6.83 5.3c1.58-4.72 5.99-8.24 11.2-8.24Z"
                  />
                </svg>
              )}
              {pending ? "Opening Google…" : "Continue with Google"}
            </Button>
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              Google handles your sign-in. We never ask for your Google
              password.
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              Wallet access is optional
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              className="min-h-12 w-full font-semibold"
              variant="outline"
              disabled={pending || !openConnectModal}
              onClick={() => {
                rememberDestination(returnTo ?? window.location.pathname + window.location.search);
                onClose();
                openConnectModal?.();
              }}
            >
              <Wallet aria-hidden="true" className="size-4" />
              Continue with a wallet
            </Button>
          </div>
          <div className="mt-8 border-t pt-5 text-center text-sm">
            <span className="text-muted-foreground">
              {activeIntent === "signup"
                ? "Already have an account?"
                : "New to eStories?"}
            </span>{" "}
            <button
              type="button"
              disabled={pending}
              className="min-h-11 font-bold text-foreground underline decoration-primary/60 underline-offset-4 disabled:opacity-50"
              onClick={() => {
                setIntentOverride(
                  activeIntent === "signup" ? "login" : "signup",
                );
                setError("");
              }}
            >
              {activeIntent === "signup" ? "Log in" : "Sign up"}
            </button>
            <p className="mt-3 flex justify-center gap-5 text-xs text-muted-foreground">
              <Link
                href="/privacy"
                onClick={onClose}
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                Privacy policy
              </Link>
              <Link
                href="/terms"
                onClick={onClose}
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                Terms of use
              </Link>
            </p>
          </div>
        </div>
        <DialogClose asChild>
          <button
            type="button"
            aria-label="Close"
            className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
