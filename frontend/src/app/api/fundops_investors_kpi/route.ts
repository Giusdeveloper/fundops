import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

/**
 * GET - Ottiene KPI per gli investitori riconciliati di una company
 * Filtra per client_company_id = activeCompanyId
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyIdParam = searchParams.get("companyId");

    if (!companyIdParam || companyIdParam.trim() === "") {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    const companyId = companyIdParam.trim();
    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(supabase, user.id, companyId, roleContext);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Total Investors: COUNT di investitori con client_company_id = companyId
    const { count: totalInvestors, error: investorsError } = await supabase
      .from("fundops_investors")
      .select("*", { count: "exact", head: true })
      .eq("client_company_id", companyId);

    if (investorsError) {
      console.error("Error counting investors:", investorsError);
    }

    // 2. Ottieni gli ID degli investitori riconciliati per questa company
    const { data: reconciledInvestors, error: reconciledError } = await supabase
      .from("fundops_investors")
      .select("id")
      .eq("client_company_id", companyId);

    if (reconciledError) {
      console.error("Error fetching reconciled investors:", reconciledError);
    }

    const investorIds = (reconciledInvestors || []).map((inv) => inv.id);

    // Se non ci sono investitori riconciliati, ritorna valori zero
    if (investorIds.length === 0) {
      console.log(`No reconciled investors found for companyId: ${companyId}`);
      return NextResponse.json(
        {
          totalInvestors: 0,
          activeLois: 0,
          committedLois: 0,
          pipelineCapital: 0,
          committedCapital: 0,
        },
        { status: 200 }
      );
    }

    console.log(`Found ${investorIds.length} reconciled investors for companyId: ${companyId}`);

    // 3. Active LOIs: COUNT di LOI con status 'sent' o 'draft'
    // Nota: nel sistema gli status validi sono 'draft', 'sent', 'signed', 'expired', 'cancelled'
    // Usiamo 'sent' e 'draft' per rappresentare LOI attive (in corso)
    const { count: activeLois, error: activeLoisError } = await supabase
      .from("fundops_lois")
      .select("*", { count: "exact", head: true })
      .in("investor_id", investorIds)
      .in("status", ["sent", "draft"]);

    if (activeLoisError) {
      console.error("Error counting active LOIs:", activeLoisError);
      console.error("Investor IDs:", investorIds);
    }

    // 4. Committed LOIs: COUNT di LOI con status 'signed'
    const { count: committedLois, error: committedLoisError } = await supabase
      .from("fundops_lois")
      .select("*", { count: "exact", head: true })
      .in("investor_id", investorIds)
      .eq("status", "signed");

    if (committedLoisError) {
      console.error("Error counting committed LOIs:", committedLoisError);
    }

    // 5. Pipeline Capital: SUM di ticket_amount per LOI con status 'sent' o 'draft'
    const { data: pipelineLois, error: pipelineError } = await supabase
      .from("fundops_lois")
      .select("ticket_amount")
      .in("investor_id", investorIds)
      .in("status", ["sent", "draft"]);

    if (pipelineError) {
      console.error("Error fetching pipeline LOIs:", pipelineError);
    }

    const pipelineCapital = (pipelineLois || []).reduce(
      (sum, loi) => sum + (loi.ticket_amount || 0),
      0
    );

    // 6. Committed Capital: SUM di ticket_amount per LOI con status 'signed'
    const { data: committedLoisData, error: committedCapitalError } = await supabase
      .from("fundops_lois")
      .select("ticket_amount")
      .in("investor_id", investorIds)
      .eq("status", "signed");

    if (committedCapitalError) {
      console.error("Error fetching committed LOIs for capital:", committedCapitalError);
    }

    const committedCapital = (committedLoisData || []).reduce(
      (sum, loi) => sum + (loi.ticket_amount || 0),
      0
    );

    return NextResponse.json(
      {
        totalInvestors: totalInvestors || 0,
        activeLois: activeLois || 0,
        committedLois: committedLois || 0,
        pipelineCapital: pipelineCapital || 0,
        committedCapital: committedCapital || 0,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in investors KPI API:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
