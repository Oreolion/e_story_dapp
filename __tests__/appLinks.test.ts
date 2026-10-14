import { describe, expect, it } from "vitest";

import { parseSha256Fingerprints } from "@/lib/appLinks";

const VALID = Array.from({ length: 32 }, (_, index) =>
  index.toString(16).padStart(2, "0").slice(-2)
).join(":");

describe("parseSha256Fingerprints", () => {
  it("normalizes and deduplicates valid SHA-256 fingerprints", () => {
    expect(parseSha256Fingerprints(`${VALID}, ${VALID.toUpperCase()}`)).toEqual([
      VALID.toUpperCase(),
    ]);
  });

  it("drops missing and malformed fingerprints", () => {
    expect(parseSha256Fingerprints(undefined)).toEqual([]);
    expect(parseSha256Fingerprints("not-a-fingerprint,AA:BB")).toEqual([]);
  });
});
