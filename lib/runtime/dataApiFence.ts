// Server-side only: never derive these credentials from incoming headers.
type Values = Record<string, string | undefined>;
export function dataApiFenceHeaders(env: Values = process.env): Record<string, string> {
  const epoch = env.DATA_API_RELEASE_EPOCH;
  const key = env.DATA_API_RELEASE_KEY;
  if (epoch === undefined && key === undefined) return {};
  if (!epoch || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(epoch) || !key || !/^[a-f0-9]{64}$/.test(key)) {
    throw new Error("Data API release credentials are unavailable");
  }
  return { "x-istory-release-epoch": epoch, "x-istory-release-key": key };
}

export function retainingPaymentCallbacks(env: Values = process.env): boolean {
  // Exact opt-in only. Global release misconfiguration must never open ingress.
  if (!(env.PAYMENT_CALLBACK_MODE === "retain" &&
    (env.APP_RELEASE_MODE === "paused" || env.APP_RELEASE_MODE === "active") &&
    Boolean(env.DATA_API_RELEASE_EPOCH && env.DATA_API_RELEASE_KEY))) return false;
  try { dataApiFenceHeaders(env); return true; } catch { return false; }
}

export function isRetainedCallbackRequest(request: Request): boolean {
  return request.method === "POST" && new URL(request.url).pathname === "/api/payment/webhook" && retainingPaymentCallbacks();
}
