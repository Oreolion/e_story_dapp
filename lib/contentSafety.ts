import { isValidUuid } from "./validation";

export const SAFETY_TARGET_TYPES = ["story", "comment", "user"] as const;
export const SAFETY_REASONS = [
  "spam",
  "harassment",
  "hate",
  "sexual_content",
  "violence",
  "self_harm",
  "other",
] as const;

export type SafetyTargetType = (typeof SAFETY_TARGET_TYPES)[number];
export type SafetyReason = (typeof SAFETY_REASONS)[number];

export interface SafetyReportInput {
  targetType: SafetyTargetType;
  targetId: string;
  reason: SafetyReason;
  details: string | null;
}

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function parseSafetyReport(input: unknown): ParseResult<SafetyReportInput> {
  if (!input || typeof input !== "object") {
    return { success: false, error: "Invalid report" };
  }

  const value = input as Record<string, unknown>;
  if (!SAFETY_TARGET_TYPES.includes(value.targetType as SafetyTargetType)) {
    return { success: false, error: "Invalid report target" };
  }
  if (!isValidUuid(value.targetId)) {
    return { success: false, error: "Invalid target ID" };
  }
  if (!SAFETY_REASONS.includes(value.reason as SafetyReason)) {
    return { success: false, error: "Invalid report reason" };
  }

  const rawDetails = typeof value.details === "string" ? value.details.trim() : "";
  if (rawDetails.length > 1000) {
    return { success: false, error: "Report details must be 1000 characters or fewer" };
  }

  return {
    success: true,
    data: {
      targetType: value.targetType as SafetyTargetType,
      targetId: value.targetId,
      reason: value.reason as SafetyReason,
      details: rawDetails ? rawDetails.replace(/[<>]/g, "") : null,
    },
  };
}

export function parseBlockedUserId(input: unknown): ParseResult<string> {
  if (!input || typeof input !== "object") {
    return { success: false, error: "Invalid block request" };
  }

  const blockedUserId = (input as Record<string, unknown>).blockedUserId;
  return isValidUuid(blockedUserId)
    ? { success: true, data: blockedUserId }
    : { success: false, error: "Invalid user ID" };
}
