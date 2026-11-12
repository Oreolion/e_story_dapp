import { describe, expect, it } from "vitest";
import { dataApiFenceHeaders, retainingPaymentCallbacks } from "@/lib/runtime/dataApiFence";

describe("server release credentials", () => {
  const env = { DATA_API_RELEASE_EPOCH: "00000000-0000-4000-8000-000000000001", DATA_API_RELEASE_KEY: "a".repeat(64) };
  it("preserves the unset client and rejects partial or malformed credentials", () => {
    expect(dataApiFenceHeaders({})).toEqual({});
    expect(dataApiFenceHeaders(env)).toEqual({ "x-istory-release-epoch": env.DATA_API_RELEASE_EPOCH, "x-istory-release-key": env.DATA_API_RELEASE_KEY });
    for (const value of [{ ...env, DATA_API_RELEASE_KEY: undefined }, { ...env, DATA_API_RELEASE_KEY: "short-private-value" }, { ...env, DATA_API_RELEASE_EPOCH: "malformed" }]) {
      expect(() => dataApiFenceHeaders(value)).toThrow("Data API release credentials are unavailable");
    }
  });
  it("requires deliberate callback ingress and a valid explicit release mode", () => {
    expect(retainingPaymentCallbacks({ ...env, PAYMENT_CALLBACK_MODE: "retain", APP_RELEASE_MODE: "paused" })).toBe(true);
    for (const value of [undefined, "", "invalid"]) expect(retainingPaymentCallbacks({ ...env, PAYMENT_CALLBACK_MODE: "retain", APP_RELEASE_MODE: value })).toBe(false);
    expect(retainingPaymentCallbacks({ ...env, APP_RELEASE_MODE: "paused" })).toBe(false);
  });
});
