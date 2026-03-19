import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Callback per Supabase Auth (OAuth, magic link, ecc.)
 * Scambia il code per la sessione e redirect alla destinazione.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const queryError = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");
  const redirectParam = searchParams.get("redirect");
  const redirectCookie = request.cookies.get("fundops_redirect")?.value ?? null;

  const sanitizeRelativePath = (value: string | null): string | null => {
    if (!value) return null;
    if (!value.startsWith("/")) return null;
    if (value.startsWith("//")) return null;
    return value;
  };

  if (!code) {
    if (queryError || errorCode || errorDescription) {
      const friendlyMessage =
        "Link non valido o scaduto. Se hai gia confermato l'email, prova ad accedere.";
      const query = new URLSearchParams();
      query.set("message", friendlyMessage);
      if (errorCode) query.set("error_code", errorCode);
      return NextResponse.redirect(`${origin}/login?${query.toString()}`);
    }
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const safeRedirect = sanitizeRelativePath(redirectParam);
  const safeRedirectFromCookie = sanitizeRelativePath(
    redirectCookie ? decodeURIComponent(redirectCookie) : null
  );

  const { data: homeRouteData } = await supabase.rpc("get_home_route");
  const homeRoute =
    typeof homeRouteData === "string" && homeRouteData.startsWith("/")
      ? homeRouteData
      : "/dashboard";

  const finalPath = safeRedirect ?? safeRedirectFromCookie ?? homeRoute;
  const response = NextResponse.redirect(`${origin}${finalPath}`);
  response.cookies.set("fundops_redirect", "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
  return response;
}
