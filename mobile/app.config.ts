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
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0f172a",
    },
    package: "app.estories.mobile",
    permissions: [
      "RECORD_AUDIO",
      "CAMERA",
      "POST_NOTIFICATIONS",
      "VIBRATE",
    ],
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
  ],
  extra: {
    API_BASE_URL: process.env.API_BASE_URL || "https://estories.app",
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
    WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID || "",
    GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID || "",
    eas: {
      projectId: "183d424a-6826-4538-bff5-06aec39eb0d5",
    },
  },
});
