import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { driveFetch } from "@/lib/googleDrive";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
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
  if (profileError) return json(500, { error: profileError.message });
  if (profile?.is_active === false) return json(403, { error: "Forbidden" });

  const isStaff =
    profile?.role_global === "imment_admin" || profile?.role_global === "imment_operator";
  if (isStaff) return null;

  const { data: seat, error: seatError } = await supabase
    .from("fundops_company_users")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("role", "company_admin")
    .eq("is_active", true)
    .maybeSingle();
  if (seatError) return json(500, { error: seatError.message });
  if (!seat) return json(403, { error: "Forbidden" });
  return null;
}

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId")?.trim() ?? "";
  if (!UUID_RE.test(companyId)) return json(400, { error: "Invalid companyId" });

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) return json(401, { error: "Unauthorized" });

  const unauthorized = await authorizeCompanyAccess(supabase, user.id, companyId);
  if (unauthorized) return unauthorized;

  const { data: connection, error: connectionError } = await supabase
    .from("fundops_drive_connections")
    .select("drive_kind, shared_drive_id, root_folder_id")
    .eq("company_id", companyId)
    .in("provider", ["google_drive", "google"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connectionError) return json(500, { error: connectionError.message });
  if (!connection) {
    return json(200, {
      connected: false,
      rootReady: false,
      items: [],
      driveKind: null,
      sharedDriveId: null,
      rootFolderId: null,
    });
  }

  const rootFolderId = connection.root_folder_id ?? null;
  if (!rootFolderId) {
    return json(200, {
      connected: true,
      rootReady: false,
      items: [],
      driveKind: connection.drive_kind ?? null,
      sharedDriveId: connection.shared_drive_id ?? null,
      rootFolderId: null,
    });
  }

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", `'${rootFolderId}' in parents and trashed=false`);
  url.searchParams.set(
    "fields",
    "files(id,name,mimeType,modifiedTime,size,webViewLink,webContentLink,owners(displayName,emailAddress))"
  );
  url.searchParams.set("orderBy", "folder,name");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  if (connection.drive_kind === "shared_drive" && connection.shared_drive_id) {
    url.searchParams.set("corpora", "drive");
    url.searchParams.set("driveId", connection.shared_drive_id);
  } else {
    url.searchParams.set("corpora", "user");
  }

  const res = await driveFetch(companyId, url.toString());
  const payload = (await res.json().catch(() => null)) as
    | {
        files?: Array<{
          id: string;
          name: string;
          mimeType: string;
          modifiedTime?: string;
          webViewLink?: string;
          webContentLink?: string;
          size?: string;
          owners?: Array<{ displayName?: string; emailAddress?: string }>;
        }>;
        error?: { message?: string };
      }
    | null;
  if (!res.ok) {
    if (res.status === 401) {
      return json(401, { error: "Drive connection expired. Reconnect." });
    }
    return json(res.status, { error: payload?.error?.message || "Failed to list files" });
  }

  const items = (payload?.files ?? []).map((file) => ({
    id: file.id,
    name: file.name,
    kind: file.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file",
    mimeType: file.mimeType,
    sizeBytes: file.size ? Number(file.size) : null,
    modifiedTime: file.modifiedTime ?? null,
    webViewLink: file.webViewLink ?? null,
  }));

  return json(200, {
    connected: true,
    rootReady: true,
    items,
    driveKind: connection.drive_kind ?? null,
    sharedDriveId: connection.shared_drive_id ?? null,
    rootFolderId,
  });
}

