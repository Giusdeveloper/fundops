import { createSupabaseAdmin } from "@/lib/supabase/admin";

type GoogleDriveTokenRow = {
  company_id: string;
  provider: "google_drive";
  access_token: string | null;
  refresh_token: string | null;
  expiry: string | null;
};

type RefreshResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  refresh_token?: string;
};

export type DriveConnectionRow = {
  company_id: string;
  provider: "google_drive";
  drive_kind: "my_drive" | "shared_drive";
  shared_drive_id: string | null;
  root_folder_id: string | null;
  root_folder_name: string | null;
  status: "connected" | "error" | "disconnected";
};

function mustEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function getTokenRow(companyId: string): Promise<GoogleDriveTokenRow | null> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("fundops_provider_tokens")
    .select("company_id, provider, access_token, refresh_token, expiry")
    .eq("company_id", companyId)
    .eq("provider", "google_drive")
    .maybeSingle();

  if (error) {
    throw new Error(`Token read failed: ${error.message}`);
  }

  return (data as GoogleDriveTokenRow | null) ?? null;
}

export async function upsertGoogleDriveTokens(input: {
  companyId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiry: string | null;
}) {
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("fundops_provider_tokens").upsert(
    {
      company_id: input.companyId,
      provider: "google_drive",
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      expiry: input.expiry,
    },
    { onConflict: "company_id,provider" }
  );

  if (error) {
    throw new Error(`Token upsert failed: ${error.message}`);
  }
}

async function refreshAccessToken(companyId: string, refreshToken: string): Promise<string> {
  const clientId = mustEnv("GOOGLE_CLIENT_ID");
  const clientSecret = mustEnv("GOOGLE_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await res.json().catch(() => null)) as RefreshResponse | { error?: string } | null;
  if (!res.ok || !payload || !("access_token" in payload)) {
    throw new Error(
      `Google refresh token failed: ${
        (payload as { error?: string } | null)?.error || res.statusText
      }`
    );
  }

  const expiry = new Date(Date.now() + Math.max(30, payload.expires_in) * 1000).toISOString();
  await upsertGoogleDriveTokens({
    companyId,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? refreshToken,
    expiry,
  });

  return payload.access_token;
}

export async function getDriveAccessToken(companyId: string, forceRefresh = false): Promise<string> {
  const tokenRow = await getTokenRow(companyId);
  if (!tokenRow) {
    throw new Error("Drive token not found for company");
  }

  if (!forceRefresh && tokenRow.access_token && tokenRow.expiry) {
    const expiresAt = new Date(tokenRow.expiry).getTime();
    if (Number.isFinite(expiresAt) && expiresAt - Date.now() > 60 * 1000) {
      return tokenRow.access_token;
    }
  }

  if (!tokenRow.refresh_token) {
    throw new Error("Missing refresh token for company");
  }

  return refreshAccessToken(companyId, tokenRow.refresh_token);
}

export async function driveFetch(
  companyId: string,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const doFetch = async (token: string) => {
    const headers = new Headers(init.headers ?? {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };

  const token = await getDriveAccessToken(companyId);
  let response = await doFetch(token);
  if (response.status === 401) {
    const refreshed = await getDriveAccessToken(companyId, true);
    response = await doFetch(refreshed);
  }
  return response;
}

export function encodeOauthState(payload: Record<string, string>) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeOauthState<T = Record<string, string>>(value: string): T | null {
  try {
    const raw = Buffer.from(value, "base64url").toString("utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

