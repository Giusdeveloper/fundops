import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Callback per Supabase Auth (OAuth, magic link, ecc.)
 * Scambia il code per la sessione e redirect alla destinazione.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? searchParams.get("redirect") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
