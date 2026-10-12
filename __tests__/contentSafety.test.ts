import { describe, expect, it } from "vitest";

import { parseBlockedUserId, parseSafetyReport } from "@/lib/contentSafety";

const TARGET_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("content safety input validation", () => {
  it("accepts a valid report and strips angle brackets from details", () => {
    expect(
      parseSafetyReport({
        targetType: "story",
        targetId: TARGET_ID,
        reason: "harassment",
        details: "<script>context</script>",
      })
    ).toEqual({
      success: true,
      data: {
        targetType: "story",
        targetId: TARGET_ID,
        reason: "harassment",
        details: "scriptcontext/script",
      },
    });
  });

  it("rejects unknown report targets and reasons", () => {
    expect(
      parseSafetyReport({ targetType: "book", targetId: TARGET_ID, reason: "spam" })
    ).toEqual({ success: false, error: "Invalid report target" });
    expect(
      parseSafetyReport({ targetType: "story", targetId: TARGET_ID, reason: "revenge" })
    ).toEqual({ success: false, error: "Invalid report reason" });
  });

  it("rejects invalid IDs and oversized details", () => {
    expect(
      parseSafetyReport({ targetType: "user", targetId: "not-a-uuid", reason: "spam" })
    ).toEqual({ success: false, error: "Invalid target ID" });
    expect(
      parseSafetyReport({
        targetType: "comment",
        targetId: TARGET_ID,
        reason: "other",
        details: "x".repeat(1001),
      })
    ).toEqual({
      success: false,
      error: "Report details must be 1000 characters or fewer",
    });
  });

  it("validates blocked user IDs", () => {
    expect(parseBlockedUserId({ blockedUserId: TARGET_ID })).toEqual({
      success: true,
      data: TARGET_ID,
    });
    expect(parseBlockedUserId({ blockedUserId: "invalid" })).toEqual({
      success: false,
      error: "Invalid user ID",
    });
  });
});
