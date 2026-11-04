"use client";
import type { VerifiedMetrics, VerifiedMetricsProof } from "@/app/hooks/useVerifiedMetrics";
interface Props { metrics: VerifiedMetrics | null; proof: VerifiedMetricsProof | null; isPending: boolean; isAuthor: boolean; className?: string }
// Legacy props are retained so cached metrics cannot revive a verified claim.
export function VerifiedMetricsCard({ className = "" }: Props) {
  return <section className={`rounded-xl border border-slate-200 p-5 dark:border-slate-700 ${className}`} aria-label="On-chain verification">
    <h3 className="font-medium">On-chain verification · Coming soon</h3>
    <p className="mt-2 text-sm text-slate-500">Testnet verification is parked. AI insights are not on-chain attestations.</p>
  </section>;
}
