import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InvestmentStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "verified";

type InvestmentDetailRow = {
  id: string;
  company_id: string;
  investor_id: string | null;
  status: InvestmentStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  amount?: number | null;
  amount_eur?: number | null;
};

type InvestorRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type IssuanceDocRow = {
  id: string;
  type: string;
  title: string | null;
  created_at: string;
};

type EventRow = {
  id: string;
  investment_id: string;
  event_type: string;
  event_data: {
    from_status?: string | null;
    to_status?: string | null;
    note?: string | null;
  } | null;
  created_by: string | null;
  created_at: string;
};

type StatusBody = {
  status?: string;
  note?: string;
};

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdmin>;

type AuthorizedSuccess = {
  admin: SupabaseAdminClient;
  investment: InvestmentDetailRow;
};

type AuthorizedError = {
  error: {
    status: number;
    body: { error: string; code?: string | null };
  };
};

type AuthorizedContext = AuthorizedSuccess | AuthorizedError;

const ALLOWED_STATUSES = ["under_review", "approved", "rejected"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function canTransition(fromStatus: string, toStatus: AllowedStatus): boolean {
  if (fromStatus === "submitted" && (toStatus === "under_review" || toStatus === "rejected")) {
    return true;
  }
  if (fromStatus === "under_review" && (toStatus === "approved" || toStatus === "rejected")) {
    return true;
  }
  return false;
}

function isAuthorizedError(context: AuthorizedContext): context is AuthorizedError {
  return "error" in context && Boolean(context.error);
}

async function getAuthorizedContext(investmentId: string, userId: string): Promise<AuthorizedContext> {
  const admin = createSupabaseAdmin();

  const { data: investmentData, error: investmentErr } = await admin
    .from("fundops_investments")
    .select("*")
    .eq("id", investmentId)
    .maybeSingle();
  if (investmentErr) {
    return { error: { status: 500, body: { error: investmentErr.message, code: investmentErr.code ?? null } } };
  }
  if (!investmentData) {
    return { error: { status: 404, body: { error: "Investimento non trovato" } } };
  }

  const investment = investmentData as InvestmentDetailRow;
  const companyId = investment.company_id;

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("role_global,is_active")
    .eq("id", userId)
    .maybeSingle();
  if (profileErr) {
    return { error: { status: 500, body: { error: "Failed to load profile", code: profileErr.code ?? null } } };
  }
  if (profile?.is_active === false) {
    return { error: { status: 403, body: { error: "Forbidden" } } };
  }

  let allowed = profile?.role_global === "imment_admin" || profile?.role_global === "imment_operator";
  if (!allowed) {
    const { data: seat, error: seatErr } = await admin
      .from("fundops_company_users")
      .select("id")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .eq("role", "company_admin")
      .eq("is_active", true)
      .maybeSingle();
    if (seatErr) {
      return { error: { status: 500, body: { error: "Failed to check company role", code: seatErr.code ?? null } } };
    }
    allowed = !!seat;
  }

  if (!allowed) {
    return { error: { status: 403, body: { error: "Forbidden" } } };
  }

  return { admin, investment };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ investmentId: string }> }
) {
  try {
    const { investmentId } = await params;
    if (!investmentId) return json(400, { error: "investmentId is required" });

    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return json(401, { error: "Unauthorized" });
    const userId = authData.user.id;

    const authorized = await getAuthorizedContext(investmentId, userId);
    if (isAuthorizedError(authorized)) {
      return json(authorized.error.status, authorized.error.body);
    }

    const { admin, investment } = authorized;
    const companyId = investment.company_id;
    const companyIdParam = new URL(request.url).searchParams.get("companyId")?.trim();
    if (companyIdParam && companyIdParam !== companyId) {
      return json(400, { error: "companyId mismatch" });
    }

    let investor: InvestorRow | null = null;
    if (investment.investor_id) {
      const { data: investorData, error: investorErr } = await admin
        .from("fundops_investors")
        .select("id, full_name, email")
        .eq("id", investment.investor_id)
        .maybeSingle();
      if (investorErr) {
        return json(500, { error: investorErr.message, code: investorErr.code ?? null });
      }
      investor = (investorData as InvestorRow | null) ?? null;
    }

    const { data: companyData, error: companyErr } = await admin
      .from("fundops_companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();
    if (companyErr) {
      return json(500, { error: companyErr.message, code: companyErr.code ?? null });
    }

    const { data: roundData, error: roundErr } = await admin
      .from("fundops_rounds")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (roundErr) {
      return json(500, { error: roundErr.message, code: roundErr.code ?? null });
    }

    const { data: profileData, error: profileErr } = await admin
      .from("profiles")
      .select("role_global, is_active, disabled_at")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) {
      return json(500, { error: profileErr.message, code: profileErr.code ?? null });
    }

    const roleGlobal = profileData?.role_global ?? null;
    const isActive = profileData?.is_active !== false;
    const isDisabled = Boolean(profileData?.disabled_at);
    const canManageIssuance =
      isActive &&
      !isDisabled &&
      (roleGlobal === "imment_admin" || roleGlobal === "imment_operator");

    const { data: docsData, error: docsErr } = await admin
      .from("fundops_documents")
      .select("id, type, title, created_at")
      .eq("investment_id", investment.id)
      .eq("status", "active")
      .in("type", ["investment_form", "bank_transfer_proof", "bank_transfer_receipt"])
      .order("created_at", { ascending: false });
    if (docsErr && docsErr.code !== "42703") {
      return json(500, { error: docsErr.message, code: docsErr.code ?? null });
    }

    const { data: eventsData, error: eventsErr } = await admin
      .from("fundops_investment_events")
      .select("id, investment_id, event_type, event_data, created_at, created_by")
      .eq("investment_id", investment.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (eventsErr && eventsErr.code !== "42P01") {
      return json(500, { error: eventsErr.message, code: eventsErr.code ?? null });
    }

    const docs = docsErr ? [] : ((docsData ?? []) as IssuanceDocRow[]);
    const investmentFormDoc = docs.find((doc) => doc.type === "investment_form") ?? null;
    const bankTransferDoc =
      docs.find((doc) => doc.type === "bank_transfer_proof") ??
      docs.find((doc) => doc.type === "bank_transfer_receipt") ??
      null;

    return json(200, {
      investment: {
        id: investment.id,
        status: investment.status,
        amount_eur: Number(investment.amount_eur ?? investment.amount ?? 0),
        submitted_at: investment.submitted_at,
        created_at: investment.created_at,
        updated_at: investment.updated_at,
      },
      investor: investor
        ? {
            id: investor.id,
            full_name: investor.full_name,
            email: investor.email,
          }
        : null,
      documents: {
        investment_form: investmentFormDoc,
        bank_transfer_proof: bankTransferDoc,
      },
      company: companyData ?? null,
      round: roundData ?? null,
      permissions: {
        canManageIssuance,
      },
      debug: {
        userRole: roleGlobal,
        canManageIssuance,
        companyPhase: (companyData as { phase?: string | null } | null)?.phase ?? null,
        issuanceOpen: (roundData as { issuance_open?: boolean | null } | null)?.issuance_open ?? null,
      },
      events: (eventsData ?? []) as EventRow[],
    });
  } catch (error) {
    console.error("[issuance-detail] fatal", error);
    return json(500, { error: "Internal Server Error" });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ investmentId: string }> }
) {
  try {
    const { investmentId } = await params;
    if (!investmentId) return json(400, { error: "investmentId is required" });

    const body = (await request.json().catch(() => null)) as StatusBody | null;
    const nextStatus = body?.status?.trim() as AllowedStatus | undefined;
    if (!nextStatus || !ALLOWED_STATUSES.includes(nextStatus)) {
      return json(400, { error: "Invalid status" });
    }

    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return json(401, { error: "Unauthorized" });
    const userId = authData.user.id;

    const authorized = await getAuthorizedContext(investmentId, userId);
    if (isAuthorizedError(authorized)) {
      return json(authorized.error.status, authorized.error.body);
    }
    const { admin, investment } = authorized;

    if (!canTransition(investment.status, nextStatus)) {
      return json(400, {
        error: "Invalid transition",
        from: investment.status,
        to: nextStatus,
      });
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = { status: nextStatus, updated_at: nowIso };
    if (nextStatus === "approved") updatePayload.verified_at = nowIso;
    if (nextStatus === "rejected") updatePayload.rejected_at = nowIso;

    const { data: updatedInvestment, error: updateErr } = await admin
      .from("fundops_investments")
      .update(updatePayload)
      .eq("id", investment.id)
      .select("id, company_id, status, updated_at")
      .maybeSingle();
    if (updateErr) {
      return json(500, { error: updateErr.message, code: updateErr.code ?? null });
    }

    const { data: event, error: eventErr } = await admin
      .from("fundops_investment_events")
      .insert({
        investment_id: investment.id,
        company_id: investment.company_id,
        event_type: "status_changed",
        event_data: {
          from_status: investment.status,
          to_status: nextStatus,
          note: body?.note ?? null,
        },
        created_by: userId,
      })
      .select("id, investment_id, event_type, event_data, created_at, created_by")
      .maybeSingle();
    if (eventErr) {
      return json(500, { error: eventErr.message, code: eventErr.code ?? null });
    }

    return json(200, {
      investment: updatedInvestment,
      event,
    });
  } catch (error) {
    console.error("[issuance-detail-status] fatal", error);
    return json(500, { error: "Internal Server Error" });
  }
}
