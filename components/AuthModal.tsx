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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Loader2 } from "lucide-react";
export function AuthModal({
  isOpen,
  onClose,
  intent = "login",
}: {
  isOpen: boolean;
  onClose: () => void;
  intent?: "login" | "signup";
}) {
  const { signInWithGoogle } = useAuth();
  const { openConnectModal } = useConnectModal();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isOpen) setError("");
  }, [isOpen]);
  const google = async () => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch {
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
        className="sm:max-w-md p-7"
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
        <DialogHeader>
          <p className="eyebrow">Your stories start here</p>
          <DialogTitle className="font-display text-3xl mt-2">
            {intent === "signup" ? "Create your eStories account" : "Log in to eStories"}
          </DialogTitle>
          <DialogDescription>
            {intent === "signup"
              ? "Sign up with Google, choose your profile, and start your first story. No wallet needed."
              : "Use your Google account to write, record and keep your stories. No wallet needed."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-3">
          <Button
            className="w-full min-h-12"
            onClick={google}
            disabled={pending}
          >
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {pending ? "Opening Google…" : "Continue with Google"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="border-t pt-5">
            <p className="text-xs text-muted-foreground mb-3">
              Already use a wallet? You can log in with it instead.
            </p>
            <Button
              className="w-full"
              variant="outline"
              disabled={pending || !openConnectModal}
              onClick={() => {
                onClose();
                openConnectModal?.();
              }}
            >
              <Wallet aria-hidden className="size-4" />
              Continue with a wallet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
