import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

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

  const withDriveFields = await supabase
    .from("fundops_rounds")
    .select("id,name,status,issuance_open,booking_open,created_at,drive_folder_id,drive_subfolders")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (!withDriveFields.error) {
    return json(200, { rounds: withDriveFields.data ?? [] });
  }

  const errorCode = (withDriveFields.error as { code?: string }).code ?? "";
  if (errorCode !== "42703") {
    return json(500, { error: withDriveFields.error.message });
  }

  // Backward compatibility: migration non ancora applicata.
  const fallback = await supabase
    .from("fundops_rounds")
    .select("id,name,status,issuance_open,booking_open,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (fallback.error) return json(500, { error: fallback.error.message });

  const rounds = (fallback.data ?? []).map((row) => ({
    ...row,
    drive_folder_id: null,
    drive_subfolders: null,
  }));

  return json(200, { rounds });
}
