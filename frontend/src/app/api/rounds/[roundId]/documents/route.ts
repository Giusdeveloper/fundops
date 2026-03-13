import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_TYPES = new Set([
  "round_pitch_deck",
  "round_regulation",
  "round_terms",
  "round_booking_doc",
  "round_issuance_doc",
  "round_onboarding_doc",
  "other",
]);

type RouteContext = {
  params: Promise<{ roundId: string }>;
};

type UploadBody = {
  companyId?: string;
  type?: string;
  title?: string;
  file_path?: string;
  mime_type?: string | null;
  size_bytes?: number | null;
};

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

async function isAuthorizedForCompany(
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
    return {
      ok: false as const,
      response: json(500, {
        error: "Failed to load profile",
        detail: profileError.message,
        code: profileError.code ?? null,
      }),
    };
  }

  if (profile?.is_active === false) {
    return {
      ok: false as const,
      response: json(403, { error: "Forbidden" }),
    };
  }

  const isStaff =
    profile?.role_global === "imment_admin" ||
    profile?.role_global === "imment_operator";

  if (isStaff) {
    return { ok: true as const };
  }

  const { data: companySeat, error: companySeatError } = await supabase
    .from("fundops_company_users")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("role", "company_admin")
    .eq("is_active", true)
    .maybeSingle();

  if (companySeatError) {
    return {
      ok: false as const,
      response: json(500, {
        error: "Failed to verify company role",
        detail: companySeatError.message,
        code: companySeatError.code ?? null,
      }),
    };
  }

  if (!companySeat) {
    return {
      ok: false as const,
      response: json(403, { error: "Forbidden" }),
    };
  }

  return { ok: true as const };
}

async function ensureRoundBelongsToCompany(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  roundId: string,
  companyId: string
) {
  const { data: round, error } = await supabase
    .from("fundops_rounds")
    .select("id")
    .eq("id", roundId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      response: json(500, {
        error: "Failed to load round",
        detail: error.message,
        code: error.code ?? null,
      }),
    };
  }

  if (!round) {
    return {
      ok: false as const,
      response: json(404, { error: "Round not found for company" }),
    };
  }

  return { ok: true as const };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { roundId } = await params;
  const companyId = request.nextUrl.searchParams.get("companyId")?.trim() ?? "";

  if (!UUID_RE.test(roundId)) {
    return json(400, { error: "Invalid roundId" });
  }
  if (!UUID_RE.test(companyId)) {
    return json(400, { error: "companyId is required and must be a valid uuid" });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return json(401, { error: "Unauthorized" });
  }

  const authorized = await isAuthorizedForCompany(supabase, user.id, companyId);
  if (!authorized.ok) {
    return authorized.response;
  }

  const roundCheck = await ensureRoundBelongsToCompany(supabase, roundId, companyId);
  if (!roundCheck.ok) {
    return roundCheck.response;
  }

  const { data, error } = await supabase
    .from("fundops_documents")
    .select(
      "id, company_id, round_id, type, title, file_path, mime_type, size_bytes, version, status, created_at, created_by"
    )
    .eq("round_id", roundId)
    .eq("company_id", companyId)
    .in("status", ["active", "uploaded", "ready"])
    .order("created_at", { ascending: false });

  if (error) {
    return json(500, {
      error: "Failed to load round documents",
      detail: error.message,
      code: error.code ?? null,
    });
  }

  return json(200, { documents: data ?? [] });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { roundId: routeRoundId } = await params;
  if (!UUID_RE.test(routeRoundId)) {
    return json(400, { error: "Invalid roundId" });
  }

  const body = (await request.json().catch(() => null)) as UploadBody | null;
  const companyId = body?.companyId?.trim() ?? "";
  const type = body?.type?.trim() ?? "";
  const title = body?.title?.trim() ?? "";
  const filePath = body?.file_path?.trim() ?? "";
  const mimeTypeRaw = body?.mime_type;
  const sizeBytesRaw = body?.size_bytes;

  if (!UUID_RE.test(companyId)) {
    return json(400, { error: "companyId is required and must be a valid uuid" });
  }
  if (!ALLOWED_TYPES.has(type)) {
    return json(400, {
      error:
        "Invalid type. Allowed values: round_pitch_deck, round_regulation, round_terms, round_booking_doc, round_issuance_doc, round_onboarding_doc, other",
    });
  }
  if (!title) {
    return json(400, { error: "title is required" });
  }
  if (!filePath) {
    return json(400, { error: "file_path is required" });
  }
  if (mimeTypeRaw !== undefined && mimeTypeRaw !== null && typeof mimeTypeRaw !== "string") {
    return json(400, { error: "mime_type must be string or null" });
  }
  if (sizeBytesRaw !== undefined && sizeBytesRaw !== null && typeof sizeBytesRaw !== "number") {
    return json(400, { error: "size_bytes must be number or null" });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return json(401, { error: "Unauthorized" });
  }

  const authorized = await isAuthorizedForCompany(supabase, user.id, companyId);
  if (!authorized.ok) {
    return authorized.response;
  }

  const roundCheck = await ensureRoundBelongsToCompany(supabase, routeRoundId, companyId);
  if (!roundCheck.ok) {
    return roundCheck.response;
  }

  const { data, error } = await supabase
    .from("fundops_documents")
    .insert({
      company_id: companyId,
      round_id: routeRoundId,
      type,
      title,
      file_path: filePath,
      mime_type: mimeTypeRaw ?? null,
      size_bytes: sizeBytesRaw ?? null,
      version: 1,
      status: "uploaded",
      created_by: user.id,
    })
    .select(
      "id, company_id, round_id, type, title, file_path, mime_type, size_bytes, version, status, created_at, created_by"
    )
    .single();

  if (error) {
    return json(500, {
      error: "Failed to create round document",
      detail: error.message,
      code: error.code ?? null,
    });
  }

  return json(201, { document: data });
}
