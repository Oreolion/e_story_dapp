"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";

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

export function useVerifiedMetrics(storyId: string | null): UseVerifiedMetricsResult {
  const { getAccessToken } = useAuth();
  const [metrics, setMetrics] = useState<VerifiedMetrics | null>(null);
  const [proof, setProof] = useState<VerifiedMetricsProof | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedRef = useRef(false);
  // Stable ref for getAccessToken to avoid callback cascade
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  const fetchMetrics = useCallback(async () => {
    if (!storyId) return;

    try {
      setError(null);

      const token = await getAccessTokenRef.current();
      if (!token) return;

      const res = await fetch("/api/cre/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storyId }),
      });

      if (!res.ok) {
        if (res.status === 429) return; // Rate limited — silently skip
        if (res.status !== 401) {
          setError("Failed to load verification status");
        }
        return;
      }

      const data = await res.json();

      if (data.verified) {
        setIsAuthor(!!data.isAuthor);

        if (data.proof) {
          setProof({
            qualityTier: data.proof.qualityTier,
            meetsQualityThreshold: data.proof.meetsQualityThreshold,
            metricsHash: data.proof.metricsHash,
            attestationId: data.proof.attestationId,
            verifiedAt: data.proof.verifiedAt,
          });
        }

        if (data.metrics) {
          setMetrics({
            significance_score: data.metrics.significance_score,
            emotional_depth: data.metrics.emotional_depth,
            quality_score: data.metrics.quality_score,
            word_count: data.metrics.word_count,
            verified_themes: data.metrics.verified_themes || [],
            cre_attestation_id: data.metrics.cre_attestation_id || null,
            on_chain_tx_hash: data.metrics.on_chain_tx_hash || null,
          });
        }

        setIsPending(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else {
        setIsPending(false);
        setMetrics(null);
        setProof(null);
      }
    } catch (err) {
      console.error("[useVerifiedMetrics] Error:", err);
      setError("Failed to load verification status");
    }
  }, [storyId]); // Only depends on storyId — stable across renders

  // Fetch once on mount (or when storyId changes)
  useEffect(() => {
    if (!storyId) return;
    // Prevent duplicate initial fetches from React strict mode
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchMetrics();
  }, [storyId, fetchMetrics]);

  // Reset fetch guard when storyId changes
  useEffect(() => {
    hasFetchedRef.current = false;
  }, [storyId]);

  // Poll every 15 seconds while pending (only when actively waiting for CRE result)
  useEffect(() => {
    if (!isPending) return;

    pollIntervalRef.current = setInterval(fetchMetrics, 15000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isPending, fetchMetrics]);

  return {
    metrics,
    proof,
    isPending,
    isVerified: !!proof,
    isAuthor,
    error,
    refetch: () => {
      setIsPending(true);
      fetchMetrics();
    },
  };
}
