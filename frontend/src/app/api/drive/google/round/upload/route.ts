import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getDriveAccessToken } from "@/lib/googleDrive";
import { publishFundopsEvent } from "@/lib/events/publishFundopsEvent";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PHASE_TO_DOC_TYPE = {
  booking: "round_booking_doc",
  issuance: "round_issuance_doc",
  onboarding: "round_onboarding_doc",
} as const;

type Phase = keyof typeof PHASE_TO_DOC_TYPE;

type RoundRow = {
  id: string;
  company_id: string;
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

function buildMultipartBody(
  metadata: Record<string, unknown>,
  fileBytes: Uint8Array,
  mimeType: string,
  boundary: string
) {
  const encoder = new TextEncoder();
  const part1 = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata
    )}\r\n`
  );
  const part2 = encoder.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
  const part3 = encoder.encode(`\r\n--${boundary}--`);

  const merged = new Uint8Array(part1.length + part2.length + fileBytes.length + part3.length);
  merged.set(part1, 0);
  merged.set(part2, part1.length);
  merged.set(fileBytes, part1.length + part2.length);
  merged.set(part3, part1.length + part2.length + fileBytes.length);
  return merged;
}

function asPhase(value: FormDataEntryValue | null): Phase | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (cleaned === "booking" || cleaned === "issuance" || cleaned === "onboarding") return cleaned;
  return null;
}

function getTargetFolderId(phase: Phase, subfolders: Record<string, string> | null): string | null {
  if (!subfolders || typeof subfolders !== "object") return null;
  const keyCandidates =
    phase === "booking"
      ? ["booking_folder_id", "01_Booking"]
      : phase === "issuance"
        ? ["issuance_folder_id", "02_Issuance"]
        : ["onboarding_folder_id", "03_Onboarding"];

  for (const key of keyCandidates) {
    const value = subfolders[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const companyId = typeof form.get("companyId") === "string" ? String(form.get("companyId")).trim() : "";
  const roundId = typeof form.get("roundId") === "string" ? String(form.get("roundId")).trim() : "";
  const phase = asPhase(form.get("phase"));
  const titleInput = typeof form.get("title") === "string" ? String(form.get("title")).trim() : "";
  const file = form.get("file");

  if (!UUID_RE.test(companyId)) return json(400, { error: "Invalid companyId" });
  if (!UUID_RE.test(roundId)) return json(400, { error: "Invalid roundId" });
  if (!phase) return json(400, { error: "Invalid phase. Use booking|issuance|onboarding" });
  if (!(file instanceof File)) return json(400, { error: "file is required" });

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
  if (!connection) return json(400, { error: "Drive non connesso" });
  if (!connection.root_folder_id) return json(400, { error: "root folder not initialized" });

  const { data: roundData, error: roundError } = await supabase
    .from("fundops_rounds")
    .select("id,company_id,drive_folder_id,drive_subfolders")
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
  if (!round.drive_folder_id || !round.drive_subfolders) {
    return json(400, { error: "Run init round folder" });
  }

  const targetFolderId = getTargetFolderId(phase, round.drive_subfolders);
  if (!targetFolderId) {
    return json(400, { error: `Missing target folder for phase ${phase}. Run init round folder` });
  }

  const cleanTitle = titleInput || file.name;
  const mimeType = file.type || "application/octet-stream";
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const boundary = `fundops_${Date.now().toString(36)}`;
  const multipartBody = buildMultipartBody(
    { name: cleanTitle, parents: [targetFolderId] },
    fileBytes,
    mimeType,
    boundary
  );

  const uploadUrl = new URL("https://www.googleapis.com/upload/drive/v3/files");
  uploadUrl.searchParams.set("uploadType", "multipart");
  uploadUrl.searchParams.set("supportsAllDrives", "true");
  uploadUrl.searchParams.set("fields", "id,name,mimeType,size,webViewLink,webContentLink");

  try {
    const doUpload = async (token: string) =>
      fetch(uploadUrl.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });

    let token = await getDriveAccessToken(companyId);
    let uploadRes = await doUpload(token);
    if (uploadRes.status === 401) {
      token = await getDriveAccessToken(companyId, true);
      uploadRes = await doUpload(token);
    }

    const uploadPayload = (await uploadRes.json().catch(() => null)) as
      | {
          id?: string;
          name?: string;
          mimeType?: string;
          size?: string;
          webViewLink?: string;
          webContentLink?: string;
          error?: { message?: string };
        }
      | null;

    if (!uploadRes.ok || !uploadPayload?.id) {
      if (uploadRes.status === 401) {
        return json(401, { error: "Drive connection expired. Reconnect." });
      }
      return json(uploadRes.status, {
        error: uploadPayload?.error?.message || "Google Drive upload failed",
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("fundops_documents")
      .insert({
        company_id: companyId,
        round_id: roundId,
        type: PHASE_TO_DOC_TYPE[phase],
        title: cleanTitle,
        file_path: `gdrive:${uploadPayload.id}`,
        mime_type: uploadPayload.mimeType ?? mimeType,
        size_bytes: uploadPayload.size ? Number(uploadPayload.size) : file.size,
        version: 1,
        status: "uploaded",
        created_by: user.id,
      })
      .select(
        "id, company_id, round_id, type, title, file_path, mime_type, size_bytes, version, status, created_at, created_by"
      )
      .single();

    if (insertError) {
      const errorCode = (insertError as { code?: string }).code ?? "";
      if (errorCode === "42703") {
        return json(400, {
          error:
            "fundops_documents missing expected columns. Ensure round_id and portal columns migrations are applied.",
        });
      }
      return json(500, { error: insertError.message });
    }

    void publishFundopsEvent({
      event: "round_document_uploaded",
      companyId,
      roundId,
      userId: user.id,
      data: {
        phase,
        documentId: inserted.id,
        driveFileId: uploadPayload.id,
        title: cleanTitle,
        mimeType: uploadPayload.mimeType ?? mimeType,
        sizeBytes: uploadPayload.size ? Number(uploadPayload.size) : file.size,
      },
    });

    return json(200, {
      ok: true,
      document: inserted,
      drive: {
        fileId: uploadPayload.id,
        webViewLink: uploadPayload.webViewLink ?? null,
        webContentLink: uploadPayload.webContentLink ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    if (/token|refresh|expired|drive token/i.test(message)) {
      return json(401, { error: "Drive connection expired. Reconnect." });
    }
    return json(500, { error: message });
  }
}
