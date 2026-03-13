import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { driveFetch } from "@/lib/googleDrive";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STRUCTURE_NAMES = [
  "00_Admin",
  "01_LOI",
  "02_Issuance",
  "03_Legal",
  "04_Pitch",
  "05_Updates",
] as const;

type SetupBody = {
  companyId?: string;
  useSharedDrive?: boolean;
  driveId?: string;
};

type DriveConnection = {
  drive_kind: "my_drive" | "shared_drive";
  shared_drive_id: string | null;
  root_folder_id: string | null;
};

type FolderItem = { name: string; id: string };

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

async function listRootFolders(params: {
  companyId: string;
  rootFolderId: string;
  driveKind: "my_drive" | "shared_drive";
  sharedDriveId: string | null;
}) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set(
    "q",
    `'${params.rootFolderId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`
  );
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  if (params.driveKind === "shared_drive" && params.sharedDriveId) {
    url.searchParams.set("driveId", params.sharedDriveId);
    url.searchParams.set("corpora", "drive");
  }

  const response = await driveFetch(params.companyId, url.toString());
  const payload = (await response.json().catch(() => null)) as
    | { files?: Array<{ id?: string; name?: string }>; error?: { message?: string } }
    | null;

  if (response.status === 401) {
    return { type: "expired" as const };
  }
  if (!response.ok) {
    return {
      type: "error" as const,
      message: payload?.error?.message || "Google Drive list failed",
    };
  }

  const files = (payload?.files ?? [])
    .filter((item) => item.id && item.name)
    .map((item) => ({ id: String(item.id), name: String(item.name) }));

  return { type: "ok" as const, files };
}

async function createFolder(params: {
  companyId: string;
  rootFolderId: string;
  name: string;
}) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("fields", "id,name");

  const response = await driveFetch(params.companyId, url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [params.rootFolderId],
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { id?: string; name?: string; error?: { message?: string } }
    | null;

  if (response.status === 401) {
    return { type: "expired" as const };
  }
  if (!response.ok || !payload?.id || !payload?.name) {
    return {
      type: "error" as const,
      message: payload?.error?.message || "Google Drive create failed",
    };
  }

  return { type: "ok" as const, item: { id: payload.id, name: payload.name } };
}

async function persistSubfoldersBestEffort(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  companyId: string,
  subfoldersMap: Record<string, string>
) {
  const result = await supabase
    .from("fundops_drive_connections")
    .update({ drive_subfolders: subfoldersMap, updated_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("provider", "google_drive");

  if (!result.error) return;
  const errorCode = (result.error as { code?: string }).code ?? "";
  if (errorCode === "42703") return;
  throw new Error(result.error.message);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as SetupBody | null;
  const companyId = body?.companyId?.trim() ?? "";
  if (!UUID_RE.test(companyId)) return json(400, { error: "Invalid companyId" });

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) return json(401, { error: "Unauthorized" });

  const unauthorized = await authorizeCompanyAccess(supabase, user.id, companyId);
  if (unauthorized) return unauthorized;

  const { data: connectionData, error: connectionError } = await supabase
    .from("fundops_drive_connections")
    .select("drive_kind, shared_drive_id, root_folder_id")
    .eq("company_id", companyId)
    .eq("provider", "google_drive")
    .maybeSingle();
  if (connectionError) return json(500, { error: connectionError.message });

  const connection = (connectionData as DriveConnection | null) ?? null;
  if (!connection?.root_folder_id) {
    return json(400, { error: "root folder not initialized" });
  }

  const driveKind = connection.drive_kind;
  const sharedDriveId =
    driveKind === "shared_drive"
      ? connection.shared_drive_id || body?.driveId?.trim() || null
      : null;

  try {
    const listed = await listRootFolders({
      companyId,
      rootFolderId: connection.root_folder_id,
      driveKind,
      sharedDriveId,
    });

    if (listed.type === "expired") {
      return json(401, { error: "Drive connection expired. Reconnect." });
    }
    if (listed.type === "error") {
      return json(500, { error: listed.message });
    }

    const byName = new Map(listed.files.map((item) => [item.name, item.id]));
    const existing: FolderItem[] = [];
    const created: FolderItem[] = [];

    for (const name of STRUCTURE_NAMES) {
      const existingId = byName.get(name);
      if (existingId) {
        existing.push({ name, id: existingId });
        continue;
      }

      const createdResult = await createFolder({
        companyId,
        rootFolderId: connection.root_folder_id,
        name,
      });
      if (createdResult.type === "expired") {
        return json(401, { error: "Drive connection expired. Reconnect." });
      }
      if (createdResult.type === "error") {
        return json(500, { error: createdResult.message });
      }

      created.push(createdResult.item);
      byName.set(name, createdResult.item.id);
    }

    const subfolders = STRUCTURE_NAMES.reduce<Record<string, string>>((acc, name) => {
      const folderId = byName.get(name);
      if (folderId) {
        acc[name] = folderId;
      }
      return acc;
    }, {});

    await persistSubfoldersBestEffort(supabase, companyId, subfolders);

    return json(200, {
      ok: true,
      rootFolderId: connection.root_folder_id,
      created,
      existing,
      subfolders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Setup failed";
    if (/token|refresh|expired|drive token/i.test(message)) {
      return json(401, { error: "Drive connection expired. Reconnect." });
    }
    return json(500, { error: message });
  }
}
