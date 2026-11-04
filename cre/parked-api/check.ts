import { NextRequest, NextResponse } from "next/server";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";

const VERIFIED_METRICS_ADDRESS = process.env.NEXT_PUBLIC_VERIFIED_METRICS_ADDRESS as `0x${string}` | undefined;

// Legacy contract for backward compatibility with already-verified stories
const LEGACY_VERIFIED_METRICS_ADDRESS = process.env.NEXT_PUBLIC_LEGACY_VERIFIED_METRICS_ADDRESS as `0x${string}` | undefined;

// New PrivateVerifiedMetrics ABI (minimal on-chain data)
const newAbi = parseAbi([
  "function isVerified(bytes32 storyId) view returns (bool)",
  "function getMetrics(bytes32 storyId) view returns (bool meetsQualityThreshold, uint8 qualityTier, bytes32 metricsHash, bytes32 authorCommitment, bytes32 attestationId, uint256 verifiedAt)",
]);

// Legacy VerifiedMetrics ABI (full on-chain data)
const legacyAbi = parseAbi([
  "function isVerified(bytes32 storyId) view returns (bool)",
  "function getMetrics(bytes32 storyId) view returns (uint8 significanceScore, uint8 emotionalDepth, uint8 qualityScore, uint32 wordCount, string[] themes, bytes32 attestationId, uint256 verifiedAt)",
]);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

/**
 * Convert UUID string to bytes32 (same encoding as CRE workflow)
 */
function uuidToBytes32(uuid: string): `0x${string}` {
  return `0x${uuid.replace(/-/g, "").padEnd(64, "0")}` as `0x${string}`;
}

/**
 * POST /api/cre/check
 *
 * Dual-source reading with author-based response filtering:
 * 1. Check Supabase cache (has full data from callback)
 * 2. If caller is author: return full metrics + proof
 * 3. If caller is NOT author: return proof only (tier, threshold)
 * 4. If cache miss: read minimal on-chain data from new contract
 * 5. Legacy fallback: check old contract for backward compat
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const { storyId } = await req.json();

    if (!storyId) {
      return NextResponse.json({ error: "Story ID is required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const storyIdBytes32 = uuidToBytes32(storyId);

    // Determine if caller is the story author
    const { data: story } = await admin
      .from("stories")
      .select("author_id")
      .eq("id", storyId)
      .maybeSingle();

    const isAuthor = story?.author_id === authenticatedUserId;

    // Step 1: Check Supabase cache (full data from callback)
    const { data: cachedMetrics } = await admin
      .from("verified_metrics")
      .select("*")
      .eq("story_id", storyId)
      .maybeSingle();

    if (cachedMetrics) {
      if (isAuthor) {
        // Author gets full metrics + proof
        return NextResponse.json({
          verified: true,
          isAuthor: true,
          metrics: {
            significance_score: cachedMetrics.significance_score,
            emotional_depth: cachedMetrics.emotional_depth,
            quality_score: cachedMetrics.quality_score,
            word_count: cachedMetrics.word_count,
            verified_themes: cachedMetrics.verified_themes,
            cre_attestation_id: cachedMetrics.cre_attestation_id,
            on_chain_tx_hash: cachedMetrics.on_chain_tx_hash,
          },
          proof: {
            qualityTier: cachedMetrics.quality_tier,
            meetsQualityThreshold: cachedMetrics.meets_quality_threshold,
            metricsHash: cachedMetrics.metrics_hash,
          },
        });
      } else {
        // Non-author gets proof only — no specific scores or themes
        return NextResponse.json({
          verified: true,
          isAuthor: false,
          proof: {
            qualityTier: cachedMetrics.quality_tier,
            meetsQualityThreshold: cachedMetrics.meets_quality_threshold,
          },
        });
      }
    }

    // Step 2: No cache — check new contract on-chain
    if (VERIFIED_METRICS_ADDRESS && VERIFIED_METRICS_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      try {
        const isVerifiedOnChain = await publicClient.readContract({
          address: VERIFIED_METRICS_ADDRESS,
          abi: newAbi,
          functionName: "isVerified",
          args: [storyIdBytes32],
        });

        if (isVerifiedOnChain) {
          const [meetsQualityThreshold, qualityTier, metricsHash, , attestationId, verifiedAt] =
            await publicClient.readContract({
              address: VERIFIED_METRICS_ADDRESS,
              abi: newAbi,
              functionName: "getMetrics",
              args: [storyIdBytes32],
            });

          // Return proof-only (full metrics will arrive via callback later)
          return NextResponse.json({
            verified: true,
            isAuthor,
            proof: {
              qualityTier: Number(qualityTier),
              meetsQualityThreshold,
              metricsHash,
              attestationId,
              verifiedAt: Number(verifiedAt),
            },
          });
        }
      } catch (err) {
        console.error("[CRE/CHECK] New contract read error:", err);
      }
    }

    // Step 3: Legacy fallback — check old contract for backward compatibility
    if (LEGACY_VERIFIED_METRICS_ADDRESS && LEGACY_VERIFIED_METRICS_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      try {
        const isLegacyVerified = await publicClient.readContract({
          address: LEGACY_VERIFIED_METRICS_ADDRESS,
          abi: legacyAbi,
          functionName: "isVerified",
          args: [storyIdBytes32],
        });

        if (isLegacyVerified) {
          const [
            significanceScore,
            emotionalDepth,
            qualityScore,
            wordCount,
            themes,
            attestationId,
            verifiedAt,
          ] = await publicClient.readContract({
            address: LEGACY_VERIFIED_METRICS_ADDRESS,
            abi: legacyAbi,
            functionName: "getMetrics",
            args: [storyIdBytes32],
          });

          // Legacy data is on-chain (already public), but we still apply
          // author-based filtering to avoid surfacing full scores via our API
          const metricsData = {
            significance_score: Number(significanceScore),
            emotional_depth: Number(emotionalDepth),
            quality_score: Number(qualityScore),
            word_count: Number(wordCount),
            verified_themes: themes as string[],
            cre_attestation_id: attestationId,
            on_chain_tx_hash: null,
          };

          const legacyProof = {
            qualityTier: scoreToTier(Number(qualityScore)),
            meetsQualityThreshold: Number(qualityScore) >= 70,
          };

          // Cache to Supabase for future requests
          await admin
            .from("verified_metrics")
            .upsert(
              {
                story_id: storyId,
                significance_score: metricsData.significance_score,
                emotional_depth: metricsData.emotional_depth,
                quality_score: metricsData.quality_score,
                word_count: metricsData.word_count,
                verified_themes: metricsData.verified_themes,
                cre_attestation_id: metricsData.cre_attestation_id,
                quality_tier: legacyProof.qualityTier,
                meets_quality_threshold: legacyProof.meetsQualityThreshold,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "story_id" }
            );

          if (isAuthor) {
            return NextResponse.json({
              verified: true,
              isAuthor: true,
              legacy: true,
              metrics: metricsData,
              proof: legacyProof,
            });
          } else {
            // Non-author: proof only, even for legacy stories
            return NextResponse.json({
              verified: true,
              isAuthor: false,
              legacy: true,
              proof: legacyProof,
            });
          }
        }
      } catch (err) {
        console.error("[CRE/CHECK] Legacy contract read error:", err);
      }
    }

    // Not verified on any contract
    return NextResponse.json({ verified: false });
  } catch (error) {
    console.error("[CRE/CHECK] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function scoreToTier(score: number): number {
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}
