import { createClient } from "@supabase/supabase-js";
import { runtimeConfiguration } from "@/lib/runtime/config";
import { dataApiFenceHeaders, retainingPaymentCallbacks } from "@/lib/runtime/dataApiFence";

export const createSupabaseAdminClient = () => {
  runtimeConfiguration();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: dataApiFenceHeaders() },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

/** Only the signed callback handler uses this while application admission is held. */
export const createPaymentCallbackClient = () => {
  if (!retainingPaymentCallbacks()) throw new Error("Callback retention is unavailable");
  // Validate the same project/environment boundary without admitting ordinary
  // paused application operations. The database limits this client to one RPC.
  runtimeConfiguration({ ...process.env, APP_RELEASE_MODE: "active" });
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: { headers: dataApiFenceHeaders(), fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) },
    auth: { autoRefreshToken: false, persistSession: false },
  });
};
