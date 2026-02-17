import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

/**
 * GET /api/lois/[id]/booking-kpi?companyId=xxx
 * KPI Booking company-scoped per testing portal
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loiId } = await params;
    const companyId = new URL(request.url).searchParams.get("companyId");

    if (!loiId || !companyId) {
      return NextResponse.json(
        { error: "loiId and companyId required" },
        { status: 400 }
      );
    }

    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const roleContext = await getUserRoleContext(supabaseAuth, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(supabaseAuth, user.id, companyId, roleContext);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { count: registeredCount } = await supabaseAuth
      .from("fundops_investor_accounts")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("lifecycle_stage", "registered");

    const { count: loiSignedCount } = await supabaseAuth
      .from("fundops_loi_signers")
      .select("id", { count: "exact", head: true })
      .eq("loi_id", loiId)
      .eq("status", "signed");

    const reg = registeredCount ?? 0;
    const signed = loiSignedCount ?? 0;
    const conversionRate = reg > 0 ? Math.round((signed / reg) * 100) : 0;

    return NextResponse.json({
      registered_count: reg,
      loi_signed_count: signed,
      conversion_rate: conversionRate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
