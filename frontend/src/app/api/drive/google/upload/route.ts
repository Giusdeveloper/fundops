import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getDriveAccessToken } from "@/lib/googleDrive";

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
  const part2 = encoder.encode(
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const part3 = encoder.encode(`\r\n--${boundary}--`);

  const merged = new Uint8Array(part1.length + part2.length + fileBytes.length + part3.length);
  merged.set(part1, 0);
  merged.set(part2, part1.length);
  merged.set(fileBytes, part1.length + part2.length);
  merged.set(part3, part1.length + part2.length + fileBytes.length);
  return merged;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const companyId = (form.get("companyId") as string | null)?.trim() ?? "";
  const folderId = (form.get("folderId") as string | null)?.trim() ?? "";
  const file = form.get("file");

  if (!UUID_RE.test(companyId)) return json(400, { error: "Invalid companyId" });
  if (!folderId) return json(400, { error: "folderId is required" });
  if (!(file instanceof File)) return json(400, { error: "file is required" });

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) return json(401, { error: "Unauthorized" });

  const unauthorized = await authorizeCompanyAccess(supabase, user.id, companyId);
  if (unauthorized) return unauthorized;

  try {
    const token = await getDriveAccessToken(companyId);
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const boundary = `fundops_${Date.now().toString(36)}`;
    const body = buildMultipartBody(
      { name: file.name, parents: [folderId] },
      fileBytes,
      mimeType,
      boundary
    );

    const uploadUrl = new URL("https://www.googleapis.com/upload/drive/v3/files");
    uploadUrl.searchParams.set("uploadType", "multipart");
    uploadUrl.searchParams.set("supportsAllDrives", "true");
    uploadUrl.searchParams.set("fields", "id,name,mimeType,size,modifiedTime,webViewLink,iconLink,parents");

    let res = await fetch(uploadUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (res.status === 401) {
      const refreshedToken = await getDriveAccessToken(companyId, true);
      res = await fetch(uploadUrl.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${refreshedToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      });
    }

    const payload = (await res.json().catch(() => null)) as
      | {
          id?: string;
          name?: string;
          mimeType?: string;
          size?: string;
          modifiedTime?: string;
          webViewLink?: string;
          iconLink?: string;
          error?: { message?: string };
        }
      | null;

    if (!res.ok || !payload?.id) {
      return json(res.status, { error: payload?.error?.message || "Google Drive upload failed" });
    }

    return json(200, { file: payload });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "Upload failed" });
  }
}

