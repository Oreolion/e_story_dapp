import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/utils/supabase/supabaseServer";

const ALLOWED_REDIRECT_PATHS = ['/', '/profile', '/record', '/social', '/library', '/books', '/tracker'];

function isAllowedRedirect(url: string, origin: string): boolean {
  try {
    const parsed = new URL(url);
    const originParsed = new URL(origin);

    // Must be same origin
    if (parsed.origin !== originParsed.origin) return false;

    // Must be an allowed path
    return ALLOWED_REDIRECT_PATHS.some(path => parsed.pathname === path || parsed.pathname.startsWith(path + '/'));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    // PKCE flow always provides a code param. Missing code means the user
    // navigated here directly or an upstream error occurred — redirect home.
    return NextResponse.redirect(origin);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(`${origin}/?auth_error=exchange_failed`);
    }

    // Validate redirect destination if provided
    if (next && isAllowedRedirect(`${origin}${next}`, origin)) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(origin);
  } catch (err) {
    console.error("[AUTH CALLBACK] Unexpected error:", err);
    return NextResponse.redirect(`${origin}/?auth_error=true`);
  }
}
