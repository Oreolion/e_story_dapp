// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const sdk = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({
  init: sdk.init,
  replayIntegration: () => ({ name: "Replay" }),
  browserTracingIntegration: () => ({ name: "BrowserTracing" }),
  captureRouterTransitionStart: vi.fn(),
}));

const configurations = [
  ["server", () => import("../sentry.server.config")],
  ["edge", () => import("../sentry.edge.config")],
  ["browser", () => import("../instrumentation-client")],
] as const;

async function configuration(load: () => Promise<unknown>) {
  vi.resetModules();
  sdk.init.mockClear();
  await load();
  expect(sdk.init).toHaveBeenCalledOnce();
  return sdk.init.mock.calls[0][0];
}

afterEach(() => vi.unstubAllEnvs());

describe.each(configurations)("%s telemetry privacy", (_runtime, load) => {
  it("disables automatic collection of credentials, bodies and journal inference content", async () => {
    const options = await configuration(load);
    expect(options.dataCollection).toMatchObject({
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [],
      urlQueryParams: false, genAI: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false }, databaseQueryData: false,
      stackFrameVariables: false,
    });
  });

  it("scrubs explicit context across all enabled event paths without changing its input", async () => {
    const options = await configuration(load);
    const input = {
      message: "synthetic transport failure",
      request: { method: "POST", url: "https://synthetic.invalid/api/release/access?code=synthetic-query",
        headers: { "X-IStory-Release-Key": "synthetic-release-key", Authorization: "synthetic-bearer" },
        data: "synthetic-private-body", cookies: "synthetic-cookie", query_string: "synthetic-query" },
      extra: { nested: [{ DATA_API_RELEASE_KEY: "synthetic-nested-key", RELEASE_COHORT_SECRET: "synthetic-cohort-key" }] },
      data: { "http.request.header.x-istory-release-key": "synthetic-span-key", "http.response.status_code": 503 },
    };
    const original = JSON.stringify(input);
    for (const name of ["beforeSend", "beforeSendTransaction", "beforeSendSpan", "beforeBreadcrumb", "beforeSendLog"]) {
      expect(options[name], name).toBeTypeOf("function");
      const output = options[name](input);
      const serialized = JSON.stringify(output);
      for (const secret of ["synthetic-query", "synthetic-release-key", "synthetic-bearer", "synthetic-private-body", "synthetic-cookie", "synthetic-nested-key", "synthetic-cohort-key", "synthetic-span-key"]) {
        expect(serialized, name).not.toContain(secret);
      }
      expect(output.message).toBe(input.message);
      expect(output.request.method).toBe("POST");
      expect(output.data["http.response.status_code"]).toBe(503);
    }
    expect(JSON.stringify(input)).toBe(original);
  });
});

it("removes credentials before the real installed Sentry SDK hands events to its transport", async () => {
  const options = await configuration(configurations[0][1]);
  // Load the real CJS SDK without Vite transforming its large Next dependency graph.
  const sentry = createRequire(import.meta.url)("@sentry/nextjs") as typeof import("@sentry/nextjs");
  const envelopes: unknown[] = [];
  sentry.init({ ...options, enabled: true, dsn: "https://synthetic@telemetry.invalid/1", defaultIntegrations: false,
    tracesSampleRate: 0, sendClientReports: false,
    transport: () => ({ send: async (envelope: unknown) => { envelopes.push(envelope); return { statusCode: 200 }; }, flush: async () => true }),
  });
  try {
    sentry.captureEvent({ message: "synthetic captured failure", extra: { DATA_API_RELEASE_KEY: "synthetic-transport-key" },
      request: { method: "POST", url: "https://synthetic.invalid/api/journal/save?entry=synthetic-journal-query",
        data: "synthetic-journal-body", headers: { "x-istory-release-key": "synthetic-header-key" } },
    });
    expect(await sentry.flush(2000)).toBe(true);
    expect(envelopes).toHaveLength(1);
    const serialized = JSON.stringify(envelopes);
    expect(serialized).toContain("synthetic captured failure");
    for (const secret of ["synthetic-transport-key", "synthetic-header-key", "synthetic-journal-query", "synthetic-journal-body"]) expect(serialized).not.toContain(secret);
  } finally {
    await sentry.close(2000);
  }
});

it("bounds nested and cyclic context while retaining useful status metadata", async () => {
  const options = await configuration(configurations[0][1]);
  const cyclic: Record<string, unknown> = { status: 503, "X-ISTORY-RELEASE-KEY": "synthetic-cycle-key" };
  cyclic.self = cyclic;
  const output = options.beforeSend({ extra: cyclic });
  expect(() => JSON.stringify(output)).not.toThrow();
  expect(JSON.stringify(output)).not.toContain("synthetic-cycle-key");
  expect(output.extra.status).toBe(503);

  let nested: Record<string, unknown> = { content: "synthetic-deep-content" };
  for (let i = 0; i < 30; i++) nested = { nested };
  expect(JSON.stringify(options.beforeSend({ extra: nested }))).not.toContain("synthetic-deep-content");
});
