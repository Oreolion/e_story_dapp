import * as Sentry from "@sentry/react-native";

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn("[Sentry] EXPO_PUBLIC_SENTRY_DSN not set — crash reporting disabled");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    environment: __DEV__ ? "development" : "production",
    // Performance monitoring
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    // Session replay for native crashes
    _experiments: {
      profilesSampleRate: __DEV__ ? 1.0 : 0.1,
    },
    beforeSend: (event) => {
      // Don't send events in dev unless explicitly enabled
      if (__DEV__ && !process.env.EXPO_PUBLIC_SENTRY_DEBUG) {
        return null;
      }

      // Filter out harmless React Native WebView lifecycle errors
      // These occur when the WebView native bridge is destroyed but JS still tries to communicate
      const errorMessage = event.exception?.values?.[0]?.value ?? "";
      if (
        typeof errorMessage === "string" &&
        (errorMessage.includes("Java object is gone") ||
          errorMessage.includes("Error invoking postMessage") ||
          errorMessage.includes("Error invoking enableDidUserTypeOnKeyboardLogging"))
      ) {
        return null;
      }

      return event;
    },
  });
}

export { Sentry };
