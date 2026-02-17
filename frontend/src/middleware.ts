import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes che richiedono autenticazione (portal è pubblico) */
const PROTECTED_PATHS = [
  "/dashboard",
  "/companies",
  "/investor",
  "/investors",
  "/lois",
  "/admin",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

/** Portal è pubblico: /portal/* accessibile anche da anon */
function isPortalPath(pathname: string): boolean {
  return pathname.startsWith("/portal/");
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getSession();
  const isLoggedIn = !!data?.session;

  // Route protetta senza utente → redirect a login
  if (!isLoggedIn && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
    return res;
  }

  // Portal senza utente → redirect a login con path completo (preserva slug)
  if (!isLoggedIn && isPortalPath(request.nextUrl.pathname)) {
    const redirectTo = request.nextUrl.pathname + request.nextUrl.search;
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", redirectTo);
    const res = NextResponse.redirect(loginUrl);
    // Copia cookie aggiornati da Supabase sulla response di redirect
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
    return res;
  }

  // /admin richiede role_global = imment_admin e is_active = true
  if (isLoggedIn && request.nextUrl.pathname.startsWith("/admin")) {
    const userId = data?.session?.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role_global, is_active")
        .eq("id", userId)
        .single();

      const isAdmin =
        profile?.role_global === "imment_admin" &&
        profile?.is_active === true;

      if (!isAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
