interface ReleaseEnvironment {
  distributionChannel?: string;
  enableWeb3Features?: string;
  enableGoogleSignIn?: string;
}

export function resolveReleasePolicy(environment: ReleaseEnvironment) {
  const channel =
    environment.distributionChannel?.trim().toLowerCase() ?? "development";
  const isGooglePlayRelease = channel === "google-play";

  return {
    channel,
    isGooglePlayRelease,
    web3FeaturesEnabled:
      !isGooglePlayRelease && environment.enableWeb3Features === "true",
    googleSignInEnabled:
      !isGooglePlayRelease && environment.enableGoogleSignIn === "true",
    mobilePurchasesEnabled: false,
  } as const;
}

const releasePolicy = resolveReleasePolicy({
  distributionChannel: process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL,
  enableWeb3Features: process.env.EXPO_PUBLIC_ENABLE_WEB3_FEATURES,
  enableGoogleSignIn: process.env.EXPO_PUBLIC_ENABLE_GOOGLE_SIGN_IN,
});

/**
 * Store policy switches are intentionally fail-closed. Web3 transactions are
 * available only in an explicitly enabled non-Play build.
 */
export const IS_GOOGLE_PLAY_RELEASE = releasePolicy.isGooglePlayRelease;

export const WEB3_FEATURES_ENABLED = releasePolicy.web3FeaturesEnabled;

// Google Play Billing is not implemented yet, so Android store builds must not
// start any subscription or digital-item checkout.
export const MOBILE_PURCHASES_ENABLED = releasePolicy.mobilePurchasesEnabled;
export const GOOGLE_SIGN_IN_ENABLED = releasePolicy.googleSignInEnabled;

export const RELEASE_CHANNEL = releasePolicy.channel;
