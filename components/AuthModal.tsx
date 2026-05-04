"use client";

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
import { Wallet, Chrome } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithGoogle } = useAuth();
  const { openConnectModal } = useConnectModal();

  const handleWalletConnect = () => {
    onClose();
    openConnectModal?.();
  };

  const handleGoogleSignIn = async () => {
    onClose();
    await signInWithGoogle();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Connect to eStories</DialogTitle>
          <DialogDescription className="text-center">
            Choose how to get started
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="outline"
            className="w-full h-14 justify-start gap-3 text-left"
            onClick={handleGoogleSignIn}
          >
            <Chrome className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-medium">Continue with Google</div>
              <div className="text-xs text-muted-foreground">
                Quick sign in — recommended
              </div>
            </div>
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-14 justify-start gap-3 text-left"
            onClick={handleWalletConnect}
          >
            <Wallet className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-medium">Connect Wallet</div>
              <div className="text-xs text-muted-foreground">
                MetaMask, WalletConnect
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
