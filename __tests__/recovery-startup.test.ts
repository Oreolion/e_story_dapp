// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const effects = vi.hoisted(() => ({ configure: vi.fn(), capture: vi.fn() }));
vi.mock("@/lib/runtime/config", () => ({ runtimeConfiguration: effects.configure }));
vi.mock("@sentry/nextjs", () => ({ captureRequestError: effects.capture }));
vi.mock("@/sentry.server.config", () => ({}));
import { register } from "@/instrumentation";

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NEXT_RUNTIME", "nodejs"); });
afterEach(() => vi.unstubAllEnvs());

it.each(["paused", "invalid-synthetic-setting"])("boots liveness in %s mode without opening runtime capabilities", async mode => {
  vi.stubEnv("APP_RELEASE_MODE", mode);
  effects.configure.mockImplementation(() => { throw new Error("RUNTIME_CAPABILITY_OPENED"); });
  await expect(register()).resolves.toBeUndefined();
  expect(effects.configure).not.toHaveBeenCalled();
});

it("still fails active startup when deployment configuration is invalid", async () => {
  vi.stubEnv("APP_RELEASE_MODE", "active");
  effects.configure.mockImplementation(() => { throw new Error("INVALID_CONFIGURATION"); });
  await expect(register()).rejects.toThrow("INVALID_CONFIGURATION");
  expect(effects.configure).toHaveBeenCalledOnce();
});
