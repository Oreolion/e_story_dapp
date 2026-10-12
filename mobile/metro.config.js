const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// The Google Play flavor is intentionally consumption-only. Resolve Reown to
// a local no-op module so Metro does not traverse or ship the disabled wallet
// SDK and its native dependency graph in that binary.
if (
  process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL?.trim().toLowerCase() ===
  "google-play"
) {
  const reownPlayShim = path.resolve(__dirname, "shims/reown-play.js");
  const wagmiPlayShim = path.resolve(__dirname, "shims/wagmi-play.js");
  const viemPlayShim = path.resolve(__dirname, "shims/viem-play.js");
  const viemChainsPlayShim = path.resolve(
    __dirname,
    "shims/viem-chains-play.js"
  );
  const defaultResolveRequest = config.resolver.resolveRequest;

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (
      moduleName === "@reown/appkit-react-native" ||
      moduleName === "@reown/appkit-wagmi-react-native"
    ) {
      return { filePath: reownPlayShim, type: "sourceFile" };
    }

    if (moduleName === "wagmi") {
      return { filePath: wagmiPlayShim, type: "sourceFile" };
    }

    if (moduleName === "viem") {
      return { filePath: viemPlayShim, type: "sourceFile" };
    }

    if (moduleName === "viem/chains") {
      return { filePath: viemChainsPlayShim, type: "sourceFile" };
    }

    if (defaultResolveRequest) {
      return defaultResolveRequest(context, moduleName, platform);
    }

    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = withNativeWind(config, { input: "./global.css" });
