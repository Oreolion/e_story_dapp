"use client";
import { Badge } from "@/components/ui/badge";
interface Props { status: "verified" | "pending" | "unverified"; txHash?: string | null; qualityTier?: number; className?: string }
export function VerifiedBadge({ status, className }: Props) {
  return status === "unverified" ? null : <Badge variant="outline" className={className}>On-chain verification · Coming soon</Badge>;
}
