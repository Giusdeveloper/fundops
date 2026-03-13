import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { decodeOauthState, upsertGoogleDriveTokens } from "@/lib/googleDrive";
import { publishFundopsEvent } from "@/lib/events/publishFundopsEvent";

type OauthState = {
  companyId: string;
  redirect: string;
};

function redirectWithError(request: NextRequest, redirectPath: string, reason: string) {
  const url = new URL(redirectPath, request.nextUrl.origin);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

function safeRelativePath(path: string | null | undefined, fallback: string): string {
  if (!path) return fallback;
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

async function authorizeCompanyAccess(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  companyId: string
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role_global, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.is_active === false) return false;

  const isStaff =
    profile?.role_global === "imment_admin" || profile?.role_global === "imment_operator";
  if (isStaff) return true;

  const { data: seat } = await supabase
    .from("fundops_company_users")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("role", "company_admin")
    .eq("is_active", true)
    .maybeSingle();
  return Boolean(seat);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateRaw = request.nextUrl.searchParams.get("state");
  const decoded = decodeOauthState<OauthState>(stateRaw ?? "");
  const companyId = decoded?.companyId ?? "";
  const redirectPath = safeRelativePath(decoded?.redirect, `/dossier?companyId=${companyId}`);

  if (!code || !decoded?.companyId) {
    return redirectWithError(request, redirectPath, "oauth_missing_code");
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("redirect", redirectPath);
    return NextResponse.redirect(loginUrl);
  }

  const canAccess = await authorizeCompanyAccess(supabase, user.id, decoded.companyId);
  if (!canAccess) {
    return redirectWithError(request, redirectPath, "forbidden");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${request.nextUrl.origin}/api/drive/google/callback`;

  if (!clientId || !clientSecret || !redirectUri) {
    return redirectWithError(request, redirectPath, "oauth_env_missing");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenPayload = (await tokenRes.json().catch(() => null)) as
    | {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
      }
    | null;

  if (!tokenRes.ok || !tokenPayload?.access_token) {
    return redirectWithError(
      request,
      redirectPath,
      tokenPayload?.error || "oauth_exchange_failed"
    );
  }

  const expiryIso = tokenPayload.expires_in
    ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
    : null;

  try {
    await upsertGoogleDriveTokens({
      companyId: decoded.companyId,
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token ?? null,
      expiry: expiryIso,
    });

    const admin = createSupabaseAdmin();
    const { error: connectionError } = await admin.from("fundops_drive_connections").upsert(
      {
        company_id: decoded.companyId,
        provider: "google_drive",
        drive_kind: "my_drive",
        shared_drive_id: null,
        root_folder_id: null,
        root_folder_name: "FundOps",
        status: "connected",
        created_by: user.id,
      },
      { onConflict: "company_id,provider" }
    );

    if (connectionError) {
      return redirectWithError(request, redirectPath, "connection_upsert_failed");
    }

    void publishFundopsEvent({
      event: "drive_connected",
      companyId: decoded.companyId,
      userId: user.id,
      data: {
        provider: "google_drive",
      },
    });
  } catch {
    return redirectWithError(request, redirectPath, "token_store_failed");
  }

  return NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin));
}
