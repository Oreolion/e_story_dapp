import { createClient } from "@supabase/supabase-js";
import { runtimeConfiguration } from "@/lib/runtime/config";

export const createSupabaseAdminClient = () => {
  runtimeConfiguration();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
