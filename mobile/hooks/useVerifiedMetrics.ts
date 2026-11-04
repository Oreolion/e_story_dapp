// Hook: CRE verified metrics - check on-chain verification status

export interface VerifiedMetrics {
  significance_score: number;
  emotional_depth: number;
  quality_score: number;
  word_count: number;
  verified_themes: string[];
  cre_attestation_id: string | null;
  on_chain_tx_hash: string | null;
}

export interface VerifiedProof {
  qualityTier: number;
  meetsQualityThreshold: boolean;
  metricsHash?: string;
  attestationId?: string;
  verifiedAt?: number;
}

// Compatibility hook for old callers; intentionally performs no network work.
export function useVerifiedMetrics(_storyId: string | undefined) {
  return { metrics: null as VerifiedMetrics | null, proof: null as VerifiedProof | null, isVerified: false, isAuthor: false, isLoading: false, error: null, triggerVerification: async () => {} };
}
