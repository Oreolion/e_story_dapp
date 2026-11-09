import * as Sentry from "@sentry/nextjs";
import { releaseMode } from "./lib/runtime/release";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runtimeConfiguration } = await import("./lib/runtime/config");
    // Paused/invalid admission must boot far enough to serve liveness and 503s.
    // Capability factories still reject work; active startup validates config.
    if (releaseMode() === "active") runtimeConfiguration();
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
