import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes che richiedono autenticazione (portal è pubblico) */
const PROTECTED_PATHS = [
  "/dashboard",
  "/companies",
  "/issuance",
  "/investor",
  "/investors",
  "/lois",
  "/admin",
  "/onboarding",
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
function isLoginPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

function isStartupAreaPath(pathname: string): boolean {
  return (
    pathname === "/dashboard" || pathname.startsWith("/dashboard/") ||
    pathname === "/companies" || pathname.startsWith("/companies/") ||
    pathname === "/issuance" || pathname.startsWith("/issuance/") ||
    pathname === "/investors" || pathname.startsWith("/investors/") ||
    pathname === "/lois" || pathname.startsWith("/lois/") ||
    pathname === "/admin" || pathname.startsWith("/admin/") ||
    pathname === "/onboarding" || pathname.startsWith("/onboarding/")
  );
}

function isInvestorAreaPath(pathname: string): boolean {
  return pathname === "/investor" || pathname.startsWith("/investor/");
}

function isRbacBypassPath(pathname: string): boolean {
  return (
    isLoginPath(pathname) ||
    pathname === "/onboarding/choose-role" ||
    pathname.startsWith("/api/auth/home-route") ||
    pathname.startsWith("/api/auth/set-role")
  );
}

type RoleGlobal = "imment_admin" | "imment_operator" | "founder" | "investor" | string | null;
type ViewMode = "startup" | "investor" | null;

function getEffectiveArea(roleGlobal: RoleGlobal, viewMode: ViewMode): "startup" | "investor" {
  // Regole definitive:
  // investor -> investor area
  if (roleGlobal === "investor") return "investor";

  // founder/operator -> startup area
  if (roleGlobal === "founder" || roleGlobal === "imment_operator") return "startup";

  // admin -> può "switchare" (se implementi view_mode)
  if (roleGlobal === "imment_admin") {
    if (viewMode === "investor") return "investor";
    return "startup";
  }

  // fallback prudente
  return "startup";
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
  const pathname = request.nextUrl.pathname;

  // Route protetta senza utente → redirect a login
  if (!isLoggedIn && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
    return res;
  }

  // Portal senza utente → redirect a login con path completo (preserva slug)
  if (!isLoggedIn && isPortalPath(pathname)) {
    const redirectTo = request.nextUrl.pathname + request.nextUrl.search;
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", redirectTo);
    const res = NextResponse.redirect(loginUrl);
    // Copia cookie aggiornati da Supabase sulla response di redirect
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
    return res;
  }

  if (!isLoggedIn) {
    return supabaseResponse;
  }

  const userId = data?.session?.user?.id;
  if (!userId) {
    return supabaseResponse;
  }

  const { data: profile } = await supabase
  .from("profiles")
  .select("role_global, is_active, view_mode")
  .eq("id", userId)
  .maybeSingle();

  const roleGlobal = profile?.role_global?.trim() ?? null;
  const isRoleMissing = !roleGlobal;
  const isChooseRolePath = pathname === "/onboarding/choose-role";
  const isRoleApiPath =
    pathname.startsWith("/api/auth/home-route") ||
    pathname.startsWith("/api/auth/set-role");

  if (isRoleMissing && isProtectedPath(pathname) && !isChooseRolePath && !isRoleApiPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding/choose-role";
    return NextResponse.redirect(url);
  }

  if (!isRoleMissing && isChooseRolePath) {
    const { data: homeRouteData } = await supabase.rpc("get_home_route");
    const homeRoute =
      typeof homeRouteData === "string" && homeRouteData.startsWith("/")
        ? homeRouteData
        : "/dashboard";
    const url = request.nextUrl.clone();
    url.pathname = homeRoute;
    url.search = "";
    return NextResponse.redirect(url);
  }
  // Se profilo disattivo -> butta fuori (opzionale ma consigliato)
  if (profile?.is_active === false) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "disabled");
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
    return res;
  }

  const rawViewMode =
    typeof profile?.view_mode === "string" ? profile.view_mode.trim() : null;
  const viewMode: ViewMode =
    rawViewMode === "startup" || rawViewMode === "investor" ? rawViewMode : null;
  const effectiveArea = getEffectiveArea(roleGlobal, viewMode);

  const isStartupPath = isStartupAreaPath(pathname);
  const isInvestorPath = isInvestorAreaPath(pathname);
  const skipRbacRedirect = isRbacBypassPath(pathname);

  // Se sei loggato e vai su /login -> manda alla home corretta
  if (isLoginPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = effectiveArea === "investor" ? "/investor/dashboard" : "/dashboard";
    url.search = "";
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
    return res;
  }

  // RBAC: investor NON deve vedere startup area
  if (!skipRbacRedirect && effectiveArea === "investor" && isStartupPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/investor/dashboard";
    url.search = "";
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
    return res;
  }

  // RBAC: startup/team NON deve vedere investor area
  if (!skipRbacRedirect && effectiveArea === "startup" && isInvestorPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
    return res;
  }

  // /admin richiede role_global = imment_admin e is_active = true
  if (pathname.startsWith("/admin")) {
    const isAdmin =
      roleGlobal === "imment_admin" &&
      profile?.is_active === true;

    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
