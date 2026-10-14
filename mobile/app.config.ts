import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "eStories",
  slug: "estory-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  runtimeVersion: {
    policy: "appVersion",
  },
  updates: {
    url: "https://u.expo.dev/183d424a-6826-4538-bff5-06aec39eb0d5",
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0f172a",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "app.estories.mobile",
    associatedDomains: ["applinks:estories.app"],
    infoPlist: {
      NSMicrophoneUsageDescription:
        "eStories needs microphone access to record your stories.",
      NSSpeechRecognitionUsageDescription:
        "eStories uses speech recognition to transcribe your stories.",
      NSCameraUsageDescription:
        "eStories needs camera access to update your profile photo.",
    },
  },
  android: {
    versionCode: 1,
    edgeToEdgeEnabled: true,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0f172a",
    },
    package: "app.estories.mobile",
    permissions: ["POST_NOTIFICATIONS", "VIBRATE"],
    blockedPermissions: ["android.permission.CAMERA"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "estories.app",
            pathPrefix: "/story/",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "estories.app",
            pathPrefix: "/book/",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  scheme: "estory",
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    "@sentry/react-native",
    [
      "expo-notifications",
      {
        icon: "./assets/icon.png",
        color: "#7c3aed",
      },
    ],
    [
      "expo-av",
      {
        microphonePermission:
          "Allow eStories to access your microphone for voice recording.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Allow eStories to select a profile photo from your library.",
        cameraPermission: false,
      },
    ],
  ],
  extra: {
    API_BASE_URL: process.env.API_BASE_URL || "https://estories.app",
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
    WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID || "",
    GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID || "",
    DISTRIBUTION_CHANNEL:
      process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL || "development",
    eas: {
      projectId: "183d424a-6826-4538-bff5-06aec39eb0d5",
    },
  },
});
