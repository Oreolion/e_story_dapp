"use client";


// Full metrics — only available to the story author
export interface VerifiedMetrics {
  significance_score: number;
  emotional_depth: number;
  quality_score: number;
  word_count: number;
  verified_themes: string[];
  cre_attestation_id: string | null;
  on_chain_tx_hash: string | null;
}

// Minimal proof — available to everyone
export interface VerifiedMetricsProof {
  qualityTier: number; // 1-5
  meetsQualityThreshold: boolean;
  metricsHash?: string;
  attestationId?: string;
  verifiedAt?: number;
}

export interface UseVerifiedMetricsResult {
  metrics: VerifiedMetrics | null;     // Full data, author only
  proof: VerifiedMetricsProof | null;  // Minimal proof, always available
  isPending: boolean;
  isVerified: boolean;
  isAuthor: boolean;
  error: string | null;
  refetch: () => void;
}

// Compatibility hook: no polling or inference while testnet verification is parked.
export function useVerifiedMetrics(_storyId: string | null): UseVerifiedMetricsResult {
  return { metrics: null, proof: null, isPending: false, isVerified: false, isAuthor: false, error: null, refetch: () => {} };
}
