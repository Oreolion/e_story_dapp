type EnvironmentValues = Record<string, string | undefined>;
export type ReleaseMode = "active" | "paused" | "invalid";

// This controls only artifacts containing this code. It is not a database
// fence and cannot pause an older deployment or a direct SDK connection.
export function releaseMode(env: EnvironmentValues = process.env): ReleaseMode {
  if (env.APP_RELEASE_MODE === undefined || env.APP_RELEASE_MODE === "active") return "active";
  return env.APP_RELEASE_MODE === "paused" ? "paused" : "invalid";
}

export class ReleasePausedError extends Error {
  constructor() { super("Application traffic is temporarily paused"); }
}

export function assertReleaseActive(env: EnvironmentValues = process.env): void {
  if (releaseMode(env) !== "active") throw new ReleasePausedError();
}
