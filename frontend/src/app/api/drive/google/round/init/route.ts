import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { driveFetch } from "@/lib/googleDrive";
import { publishFundopsEvent } from "@/lib/events/publishFundopsEvent";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ROUND_SUBFOLDERS = ["01_Booking", "02_Issuance", "03_Onboarding", "99_Archive"] as const;

type InitRoundBody = {
  companyId?: string;
  roundId?: string;
  useSharedDrive?: boolean;
  driveId?: string;
};

type DriveConnection = {
  drive_kind: "my_drive" | "shared_drive";
  shared_drive_id: string | null;
  root_folder_id: string | null;
};

type RoundRow = {
  id: string;
  name: string | null;
  drive_folder_id: string | null;
  drive_subfolders: Record<string, string> | null;
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

function getRoundFolderName(round: RoundRow): string {
  const suffix = round.id.slice(0, 8);
  const cleanName = round.name?.trim();
  if (cleanName) return `${cleanName} — ${suffix}`;
  return `Round — ${suffix}`;
}

async function createFolder(params: {
  companyId: string;
  name: string;
  parentId: string;
  driveKind: "my_drive" | "shared_drive";
  driveId: string | null;
}) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("fields", "id,name");
  if (params.driveKind === "shared_drive" && params.driveId) {
    url.searchParams.set("driveId", params.driveId);
  }

  const res = await driveFetch(params.companyId, url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [params.parentId],
    }),
  });

  const payload = (await res.json().catch(() => null)) as
    | { id?: string; error?: { message?: string } }
    | null;

  if (!res.ok || !payload?.id) {
    throw new Error(payload?.error?.message || "Drive folder create failed");
  }
  return payload.id;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as InitRoundBody | null;
  if (!body || typeof body !== "object") {
    return json(400, { error: "invalid_json_body" });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const roundId = typeof body.roundId === "string" ? body.roundId.trim() : "";
  const useSharedDrive = body.useSharedDrive === true;
  const driveIdRaw = typeof body.driveId === "string" ? body.driveId.trim() : "";
  const driveIdFromBody = driveIdRaw || null;

  if (!companyId) return json(400, { error: "missing_companyId" });
  if (!roundId) return json(400, { error: "missing_roundId" });
  if (!UUID_RE.test(companyId)) return json(400, { error: "Invalid companyId" });
  if (!UUID_RE.test(roundId)) return json(400, { error: "Invalid roundId" });
  if (useSharedDrive && !driveIdFromBody) {
    return json(400, {
      error: "missing_driveId_for_shared_drive",
      received: { useSharedDrive, driveId: driveIdFromBody },
    });
  }

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
    .select("drive_kind,shared_drive_id,root_folder_id")
    .eq("company_id", companyId)
    .in("provider", ["google_drive", "google"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (connectionError) return json(500, { error: connectionError.message });

  const connection = (connectionData as DriveConnection | null) ?? null;
  if (!connection?.root_folder_id) {
    return json(400, { error: "root folder not initialized" });
  }

  const { data: roundData, error: roundError } = await supabase
    .from("fundops_rounds")
    .select("id,name,drive_folder_id,drive_subfolders")
    .eq("id", roundId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (roundError) {
    const errorCode = (roundError as { code?: string }).code ?? "";
    if (errorCode === "42703") {
      return json(400, {
        error:
          "Round drive fields missing in DB. Run migration: migrations/add_drive_fields_to_fundops_rounds.sql",
      });
    }
    return json(500, { error: roundError.message });
  }
  if (!roundData) return json(404, { error: "Round not found for company" });

  const round = roundData as RoundRow;
  const inferredShared = useSharedDrive || connection.drive_kind === "shared_drive";
  const driveId = inferredShared
    ? (driveIdFromBody || connection.shared_drive_id || null)
    : null;
  const driveKind: "my_drive" | "shared_drive" = inferredShared ? "shared_drive" : "my_drive";

  try {
    let roundFolderId = round.drive_folder_id;
    let createdRoundFolder = false;
    if (!roundFolderId) {
      roundFolderId = await createFolder({
        companyId,
        name: getRoundFolderName(round),
        parentId: connection.root_folder_id,
        driveKind,
        driveId,
      });
      createdRoundFolder = true;
      const { error: updateRoundFolderError } = await supabase
        .from("fundops_rounds")
        .update({ drive_folder_id: roundFolderId })
        .eq("id", roundId)
        .eq("company_id", companyId);
      if (updateRoundFolderError) {
        const errorCode = (updateRoundFolderError as { code?: string }).code ?? "";
        if (errorCode === "42703") {
          return json(400, {
            error:
              "Round drive fields missing in DB. Run migration: migrations/add_drive_fields_to_fundops_rounds.sql",
          });
        }
        return json(500, { error: updateRoundFolderError.message });
      }
    }

    const currentSubfolders =
      round.drive_subfolders && typeof round.drive_subfolders === "object"
        ? { ...round.drive_subfolders }
        : {};
    let createdSubfolders = false;

    for (const subfolderName of ROUND_SUBFOLDERS) {
      if (typeof currentSubfolders[subfolderName] === "string" && currentSubfolders[subfolderName]) {
        continue;
      }

      const createdId = await createFolder({
        companyId,
        name: subfolderName,
        parentId: roundFolderId,
        driveKind,
        driveId,
      });
      currentSubfolders[subfolderName] = createdId;
      createdSubfolders = true;
    }

    if (createdSubfolders) {
      const { error: updateSubfoldersError } = await supabase
        .from("fundops_rounds")
        .update({ drive_subfolders: currentSubfolders })
        .eq("id", roundId)
        .eq("company_id", companyId);
      if (updateSubfoldersError) {
        const errorCode = (updateSubfoldersError as { code?: string }).code ?? "";
        if (errorCode === "42703") {
          return json(400, {
            error:
              "Round drive fields missing in DB. Run migration: migrations/add_drive_fields_to_fundops_rounds.sql",
          });
        }
        return json(500, { error: updateSubfoldersError.message });
      }
    }

    void publishFundopsEvent({
      event: "round_folder_initialized",
      companyId,
      roundId,
      userId: user.id,
      data: {
        roundFolderId,
        createdRoundFolder,
        createdSubfolders,
        subfolders: currentSubfolders,
      },
    });

    return json(200, {
      roundFolderId,
      roundFolderUrl: `https://drive.google.com/drive/folders/${roundFolderId}`,
      subfolders: currentSubfolders,
      created: {
        roundFolder: createdRoundFolder,
        subfolders: createdSubfolders,
      },
    });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "Round init failed" });
  }
}
