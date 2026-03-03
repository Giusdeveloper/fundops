import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { driveFetch } from "@/lib/googleDrive";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type InitBody = {
  companyId?: string;
  useSharedDrive?: boolean;
  driveId?: string;
  // backward compatibility
  driveKind?: "my_drive" | "shared_drive";
  sharedDriveId?: string;
};

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

async function createRootFolder(params: {
  companyId: string;
  useSharedDrive: boolean;
  driveId: string | null;
}) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("fields", "id,name,webViewLink");

  const body: Record<string, unknown> = {
    name: "FundOps",
    mimeType: "application/vnd.google-apps.folder",
  };
  if (params.useSharedDrive && params.driveId) {
    body.parents = [params.driveId];
  }

  const res = await driveFetch(params.companyId, url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => null)) as
    | { id?: string; name?: string; webViewLink?: string; error?: { message?: string } }
    | null;

  if (!res.ok || !payload?.id) {
    throw new Error(payload?.error?.message || "Drive create folder failed");
  }

  return payload as { id: string; name: string; webViewLink?: string };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as InitBody | null;
  const companyId = body?.companyId?.trim() ?? "";
  if (!UUID_RE.test(companyId)) return json(400, { error: "Invalid companyId" });

  const inferredShared =
    body?.useSharedDrive === true || body?.driveKind === "shared_drive";
  const driveIdRaw = body?.driveId?.trim() || body?.sharedDriveId?.trim() || "";
  const driveId = driveIdRaw || null;
  if (inferredShared && !driveId) {
    return json(400, { error: "driveId is required when useSharedDrive=true" });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) return json(401, { error: "Unauthorized" });

  const unauthorized = await authorizeCompanyAccess(supabase, user.id, companyId);
  if (unauthorized) return unauthorized;

  const { data: existingConnection, error: connectionError } = await supabase
    .from("fundops_drive_connections")
    .select("root_folder_id, root_folder_name, drive_kind, shared_drive_id")
    .eq("company_id", companyId)
    .eq("provider", "google_drive")
    .maybeSingle();
  if (connectionError) return json(500, { error: connectionError.message });

  if (existingConnection?.root_folder_id) {
    return json(200, {
      rootFolderId: existingConnection.root_folder_id,
      rootFolderName: existingConnection.root_folder_name || "FundOps",
      driveKind: existingConnection.drive_kind || (inferredShared ? "shared_drive" : "my_drive"),
      driveId: existingConnection.shared_drive_id || null,
      shareAdmin: { ok: true },
      created: false,
    });
  }

  try {
    const createdFolder = await createRootFolder({
      companyId,
      useSharedDrive: inferredShared,
      driveId,
    });

    let shareAdmin: { ok: boolean; message?: string } = { ok: true };
    const shareUrl = new URL(
      `https://www.googleapis.com/drive/v3/files/${createdFolder.id}/permissions`
    );
    shareUrl.searchParams.set("supportsAllDrives", "true");
    shareUrl.searchParams.set("sendNotificationEmail", "false");

    const shareRes = await driveFetch(companyId, shareUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "user",
        role: "writer",
        emailAddress: "admin@imment.it",
      }),
    });

    if (!shareRes.ok) {
      const sharePayload = (await shareRes.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      shareAdmin = {
        ok: false,
        message:
          sharePayload?.error?.message ||
          "Condivisione automatica fallita. Aggiungi admin@imment.it come Editor.",
      };
    }

    const { error: upsertError } = await supabase.from("fundops_drive_connections").upsert(
      {
        company_id: companyId,
        provider: "google_drive",
        drive_kind: inferredShared ? "shared_drive" : "my_drive",
        shared_drive_id: inferredShared ? driveId : null,
        root_folder_id: createdFolder.id,
        root_folder_name: createdFolder.name || "FundOps",
        status: "connected",
        created_by: user.id,
      },
      { onConflict: "company_id,provider" }
    );
    if (upsertError) return json(500, { error: upsertError.message });

    return json(200, {
      rootFolderId: createdFolder.id,
      rootFolderName: createdFolder.name || "FundOps",
      driveKind: inferredShared ? "shared_drive" : "my_drive",
      driveId: inferredShared ? driveId : null,
      shareAdmin,
      created: true,
    });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "Init failed" });
  }
}

