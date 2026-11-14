// Shared by Node, Edge and browser telemetry. Never import server credentials here.
const FILTERED = "[Filtered]";
const sensitiveSuffixes = [
  "authorization", "cookie", "cookies", "password", "passphrase", "accesstoken", "refreshtoken",
  "apikey", "privatekey", "servicerolekey", "releasekey", "cohortsecret", "workersecret",
  "webhooksecret", "tokensecret", "jwtsecret", "querystring",
];

/** Scrub explicit event context too: SDK collection settings do not cover arbitrary extras. */
export function scrubTelemetry<T extends object>(event: T): T {
  const seen = new WeakSet<object>();
  let remaining = 2000;
  function visit(value: unknown, depth: number, parent: string): unknown {
    if (typeof value === "string") {
      // OAuth codes and private PostgREST filters must not travel in diagnostic URLs.
      return value.replace(/https?:\/\/[^\s"'<>]+/g, (text) => {
        try {
          const url = new URL(text);
          url.username = "";
          url.password = "";
          url.search = "";
          url.hash = "";
          return url.toString();
        } catch { return FILTERED; }
      });
    }
    if (value === null || typeof value !== "object") return value;
    if (depth > 12 || --remaining < 0 || seen.has(value)) return FILTERED;
    seen.add(value);
    if (Array.isArray(value)) return value.slice(0, 200).map((item) => visit(item, depth + 1, parent));
    return Object.fromEntries(Object.entries(value).slice(0, 200).map(([key, item]) => {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      const sensitive = sensitiveSuffixes.some((suffix) => normalized.endsWith(suffix)) ||
        normalized === "body" || (parent === "request" && normalized === "data");
      return [key, sensitive ? FILTERED : visit(item, depth + 1, normalized)];
    }));
  }
  return visit(event, 0, "") as T;
}

export const telemetryPrivacyOptions = {
  // Set every category explicitly: supplying dataCollection changes SDK defaults.
  dataCollection: {
    userInfo: false, cookies: false, httpHeaders: false,
    httpBodies: [], urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false, stackFrameVariables: false,
  },
  beforeSend: scrubTelemetry,
  beforeSendTransaction: scrubTelemetry,
  beforeSendSpan: scrubTelemetry,
  beforeBreadcrumb: scrubTelemetry,
  beforeSendLog: scrubTelemetry,
};
