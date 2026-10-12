import { describe, expect, it } from "vitest";

import { resolveReleasePolicy } from "../../lib/releaseConfig";

describe("resolveReleasePolicy", () => {
  it("fails closed when release variables are missing", () => {
    expect(resolveReleasePolicy({})).toEqual({
      channel: "development",
      isGooglePlayRelease: false,
      web3FeaturesEnabled: false,
      googleSignInEnabled: false,
      mobilePurchasesEnabled: false,
    });
  });

  it("always disables web3 and purchases for Google Play", () => {
    expect(
      resolveReleasePolicy({
        distributionChannel: "google-play",
        enableWeb3Features: "true",
        enableGoogleSignIn: "true",
      })
    ).toEqual({
      channel: "google-play",
      isGooglePlayRelease: true,
      web3FeaturesEnabled: false,
      googleSignInEnabled: false,
      mobilePurchasesEnabled: false,
    });
  });

  it("allows web3 only when a non-Play build explicitly enables it", () => {
    expect(
      resolveReleasePolicy({
        distributionChannel: "development",
        enableWeb3Features: "true",
      }).web3FeaturesEnabled
    ).toBe(true);
  });

  it("allows Google sign-in only in an explicitly enabled non-Play build", () => {
    expect(
      resolveReleasePolicy({
        distributionChannel: "preview",
        enableGoogleSignIn: "true",
      }).googleSignInEnabled
    ).toBe(true);
  });
});
