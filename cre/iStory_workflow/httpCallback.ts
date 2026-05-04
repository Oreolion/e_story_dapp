/**
 * HTTP Trigger Handler — Privacy-Preserving Story Verification
 *
 * Flow:
 * 1. Decode the HTTP trigger payload (story content)
 * 2. Query Gemini AI for analysis (via ConfidentialHTTPClient)
 * 3. Derive privacy fields (metricsHash, authorCommitment, qualityTier)
 * 4. Set up EVM network and client
 * 5. Encode minimal data for on-chain storage
 * 6. Generate a signed CRE report
 * 7. Write the report to the PrivateVerifiedMetrics contract
 * 8. Callback full metrics to eStory API (HTTP)
 */

import {
  cre,
  type Runtime,
  type HTTPPayload,
  type HTTPSendRequester,
  getNetwork,
  hexToBase64,
  TxStatus,
  bytesToHex,
  decodeJson,
  consensusIdenticalAggregation,
} from "@chainlink/cre-sdk";
import {
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  encodePacked,
} from "viem";
import { askGemini } from "./gemini";
import type { Config } from "./main";

// Trigger input — content included directly in the payload
interface TriggerInput {
  storyId: string;
  title: string;
  content: string;
  authorWallet: string;
}

// ABI parameters matching PrivateVerifiedMetrics._processReport
const STORE_METRICS_PARAMS = parseAbiParameters(
  "bytes32 storyId, bytes32 authorCommitment, bool meetsQualityThreshold, uint8 qualityTier, bytes32 metricsHash, bytes32 attestationId"
);

/**
 * Convert a quality score (0-100) to a tier (1-5).
 * Ranges: 0-20=1, 21-40=2, 41-60=3, 61-80=4, 81-100=5
 */
function scoreToTier(score: number): number {
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}

/**
 * Main HTTP trigger handler
 */
export function onHttpTrigger(
  runtime: Runtime<Config>,
  payload: HTTPPayload
): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("CRE Workflow: eStory Privacy-Preserving Verification");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // ─────────────────────────────────────────────────────────────
    // Step 1: Parse and validate the incoming payload
    // ─────────────────────────────────────────────────────────────
    if (!payload.input || payload.input.length === 0) {
      runtime.log("[ERROR] Empty request payload");
      return "Error: Empty request";
    }

    const input = decodeJson(payload.input) as TriggerInput;
    runtime.log(`[Step 1] Processing story: ${input.storyId}`);

    if (!input.storyId || !input.content || !input.authorWallet) {
      runtime.log("[ERROR] Missing required fields");
      return "Error: Missing storyId, content, or authorWallet";
    }

    // ─────────────────────────────────────────────────────────────
    // Step 2: AI Analysis via Gemini (HTTP)
    // ─────────────────────────────────────────────────────────────
    runtime.log("[Step 2] Querying Gemini AI...");

    let metrics;
    try {
      metrics = askGemini(runtime, input.title || "Untitled", input.content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      runtime.log(`[Step 2] Gemini error: ${msg}`);
      throw err;
    }

    runtime.log(
      `[Step 2] Results: significance=${metrics.significanceScore}, depth=${metrics.emotionalDepth}, quality=${metrics.qualityScore}, words=${metrics.wordCount}`
    );
    runtime.log(`[Step 2] Themes: ${metrics.themes.join(", ")}`);

    // ─────────────────────────────────────────────────────────────
    // Step 3: Derive privacy fields
    // ─────────────────────────────────────────────────────────────
    runtime.log("[Step 3] Deriving privacy-preserving fields...");

    // Convert UUID to bytes32 (remove dashes, pad to 64 hex chars)
    const storyIdBytes32 = `0x${input.storyId
      .replace(/-/g, "")
      .padEnd(64, "0")}` as `0x${string}`;

    const qualityTier = scoreToTier(metrics.qualityScore);
    const meetsQualityThreshold = metrics.qualityScore >= 70;

    // Salt = keccak256(storyIdBytes32) — deterministic per story
    const salt = keccak256(storyIdBytes32);

    // metricsHash = keccak256(abi.encode(all scores + themes + salt))
    const metricsHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters(
          "uint8 significanceScore, uint8 emotionalDepth, uint8 qualityScore, uint32 wordCount, string[] themes, bytes32 salt"
        ),
        [
          metrics.significanceScore,
          metrics.emotionalDepth,
          metrics.qualityScore,
          metrics.wordCount,
          metrics.themes,
          salt,
        ]
      )
    );

    // authorCommitment = keccak256(encodePacked(authorWallet, storyIdBytes32))
    const authorCommitment = keccak256(
      encodePacked(
        ["address", "bytes32"],
        [input.authorWallet as `0x${string}`, storyIdBytes32]
      )
    );

    runtime.log(
      `[Step 3] qualityTier=${qualityTier}, meetsThreshold=${meetsQualityThreshold}`
    );
    runtime.log(`[Step 3] metricsHash=${metricsHash.slice(0, 18)}...`);
    runtime.log(`[Step 3] authorCommitment=${authorCommitment.slice(0, 18)}...`);

    // ─────────────────────────────────────────────────────────────
    // Step 4: Get network and create EVM client
    // ─────────────────────────────────────────────────────────────
    const evmConfig = runtime.config.evms[0];

    const network = getNetwork({
      chainFamily: "evm",
      chainSelectorName: evmConfig.chainSelectorName,
      isTestnet: true,
    });

    if (!network) {
      throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`);
    }

    runtime.log(`[Step 4] Target chain: ${evmConfig.chainSelectorName}`);
    runtime.log(`[Step 4] Contract: ${evmConfig.verifiedMetricsAddress}`);

    const evmClient = new cre.capabilities.EVMClient(
      network.chainSelector.selector
    );

    // ─────────────────────────────────────────────────────────────
    // Step 5: Encode minimal data for on-chain storage
    // ─────────────────────────────────────────────────────────────
    runtime.log("[Step 5] Encoding minimal privacy-preserving data...");

    const reportData = encodeAbiParameters(STORE_METRICS_PARAMS, [
      storyIdBytes32,
      authorCommitment,
      meetsQualityThreshold,
      qualityTier,
      metricsHash,
      storyIdBytes32, // attestation ID
    ]);

    // ─────────────────────────────────────────────────────────────
    // Step 6: Generate signed CRE report
    // ─────────────────────────────────────────────────────────────
    runtime.log("[Step 6] Generating CRE report...");

    const reportResponse = runtime
      .report({
        encodedPayload: hexToBase64(reportData),
        encoderName: "evm",
        signingAlgo: "ecdsa",
        hashingAlgo: "keccak256",
      })
      .result();

    // ─────────────────────────────────────────────────────────────
    // Step 7: Write the report to the smart contract
    // ─────────────────────────────────────────────────────────────
    runtime.log(
      `[Step 7] Writing to contract: ${evmConfig.verifiedMetricsAddress}`
    );

    const writeResult = evmClient
      .writeReport(runtime, {
        receiver: evmConfig.verifiedMetricsAddress,
        report: reportResponse,
        gasConfig: {
          gasLimit: evmConfig.gasLimit,
        },
      })
      .result();

    let txHash = "0x";
    if (writeResult.txStatus === TxStatus.SUCCESS) {
      txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
      runtime.log(`[Step 7] On-chain write successful: ${txHash}`);
    } else {
      throw new Error(`Transaction failed with status: ${writeResult.txStatus}`);
    }

    // ─────────────────────────────────────────────────────────────
    // Step 8: Callback full metrics to eStory API
    // ─────────────────────────────────────────────────────────────
    runtime.log("[Step 8] Sending full metrics via callback...");

    if (runtime.config.callbackUrl) {
      try {
        const callbackSecret = runtime.getSecret({ id: "CRE_CALLBACK_SECRET" }).result().value;
        const httpClient = new cre.capabilities.HTTPClient();

        const callbackPayload = {
          storyId: input.storyId,
          authorWallet: input.authorWallet,
          metricsHash,
          txHash,
          significanceScore: metrics.significanceScore,
          emotionalDepth: metrics.emotionalDepth,
          qualityScore: metrics.qualityScore,
          wordCount: metrics.wordCount,
          themes: metrics.themes,
          qualityTier,
          meetsQualityThreshold,
        };

        const callbackBody = Buffer.from(
          new TextEncoder().encode(JSON.stringify(callbackPayload))
        ).toString("base64");

        httpClient
          .sendRequest(
            runtime,
            buildCallbackRequest(callbackBody, callbackSecret),
            consensusIdenticalAggregation<{ success: boolean }>()
          )(runtime.config)
          .result();

        runtime.log("[Step 8] Callback sent successfully");
      } catch (err) {
        // Callback failure is non-critical — on-chain proof exists
        const msg = err instanceof Error ? err.message : String(err);
        runtime.log(`[Step 8] Callback failed (non-critical): ${msg}`);
      }
    } else {
      runtime.log("[Step 8] No callbackUrl configured, skipping");
    }

    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    return txHash;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`[ERROR] ${msg}`);
    runtime.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    throw err;
  }
}

/**
 * Build the callback request via HTTPClient.
 * For production: switch to ConfidentialHTTPClient + multiHeaders + vaultDonSecrets.
 */
const buildCallbackRequest =
  (body: string, secret: string) =>
  (sendRequester: HTTPSendRequester, config: Config): { success: boolean } => {
    sendRequester
      .sendRequest({
        url: config.callbackUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CRE-Callback-Secret": secret,
        },
        body,
      })
      .result();

    return { success: true };
  };
