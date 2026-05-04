import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance: sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session Replay: capture 1% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    "ResizeObserver loop",
    // Network errors users can't control
    "Failed to fetch",
    "NetworkError",
    "Load failed",
    // Wallet connection noise
    "User rejected the request",
    "User denied transaction",
  ],

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});

// Track Next.js route transitions for performance monitoring
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
