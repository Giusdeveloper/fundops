import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Callback per Supabase Auth (OAuth, magic link, ecc.)
 * Scambia il code per la sessione e redirect alla destinazione.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectParam = searchParams.get("redirect");
  const redirectCookie = request.cookies.get("fundops_redirect")?.value ?? null;

  const sanitizeRelativePath = (value: string | null): string | null => {
    if (!value) return null;
    if (!value.startsWith("/")) return null;
    if (value.startsWith("//")) return null;
    return value;
  };

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
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
