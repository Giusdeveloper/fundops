import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { encodeOauthState } from "@/lib/googleDrive";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function safeRelativePath(path: string | null, fallback: string): string {
  if (!path) return fallback;
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

async function authorizeCompanyAccess(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  companyId: string
) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role_global, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return json(500, { error: profileError.message });
  }
  if (profile?.is_active === false) {
    return json(403, { error: "Forbidden" });
  }

  const isStaff =
    profile?.role_global === "imment_admin" || profile?.role_global === "imment_operator";
  if (isStaff) {
    return null;
  }

  const { data: seat, error: seatError } = await supabase
    .from("fundops_company_users")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("role", "company_admin")
    .eq("is_active", true)
    .maybeSingle();
  if (seatError) {
    return json(500, { error: seatError.message });
  }
  if (!seat) {
    return json(403, { error: "Forbidden" });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId")?.trim() ?? "";
  if (!UUID_RE.test(companyId)) {
    return json(400, { error: "Invalid companyId" });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) {
    return json(401, { error: "Unauthorized" });
  }

  const unauthorized = await authorizeCompanyAccess(supabase, user.id, companyId);
  if (unauthorized) return unauthorized;

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${request.nextUrl.origin}/api/drive/google/callback`;
  if (!clientId || !redirectUri) {
    return json(500, { error: "Google OAuth env missing" });
  }

  const redirect = safeRelativePath(
    request.nextUrl.searchParams.get("redirect"),
    `/dossier?companyId=${companyId}`
  );
  const state = encodeOauthState({ companyId, redirect });

  const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  oauthUrl.searchParams.set("client_id", clientId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly"
  );
  oauthUrl.searchParams.set("access_type", "offline");
  oauthUrl.searchParams.set("prompt", "consent");
  oauthUrl.searchParams.set("include_granted_scopes", "true");
  oauthUrl.searchParams.set("state", state);

  return NextResponse.redirect(oauthUrl);
}
