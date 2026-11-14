import * as Sentry from "@sentry/nextjs";
import { telemetryPrivacyOptions } from "./lib/runtime/telemetryPrivacy";

Sentry.init({
  ...telemetryPrivacyOptions,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
