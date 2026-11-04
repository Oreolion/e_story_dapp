import type { User } from "@supabase/supabase-js";
export type AuthPrincipal =
  | { kind: "wallet"; subject: string; wallet: string }
  | { kind: "supabase"; subject: string; user: User };
export class AuthStoreUnavailable extends Error { constructor() { super("Authentication store unavailable"); } }
/** Cross-ID mapping applies only to a verified Supabase principal. */
export async function canonicalUserId(loadMapping: (subject: string) => Promise<string | null>, principal: AuthPrincipal): Promise<string> {
  if (principal.kind === "wallet") return principal.subject;
  return await loadMapping(principal.subject) ?? principal.subject;
}
