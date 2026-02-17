import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

/**
 * GET - Ottiene lo stato del processo FundOps per una company
 * Ritorna: stato delle 3 fasi (Booking, Issuing, Onboarding) e fase corrente
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

    // === FASE 1: BOOKING ===
    // Booking = Investors + LOI (soft commitment)
    
    // Conta investitori per questa company
    const { count: investorsCount, error: investorsError } = await supabase
      .from("fundops_investors")
      .select("*", { count: "exact", head: true })
      .eq("client_company_id", companyId);

    if (investorsError) {
      console.error("Error counting investors:", investorsError);
    }

    // Conta LOI per questa company (tramite investor_id -> client_company_id)
    // Prima ottieni gli ID degli investitori riconciliati
    const { data: reconciledInvestors, error: reconciledError } = await supabase
      .from("fundops_investors")
      .select("id")
      .eq("client_company_id", companyId);

    if (reconciledError) {
      console.error("Error fetching reconciled investors:", reconciledError);
    }

    const investorIds = (reconciledInvestors || []).map((inv) => inv.id);

    // Conta LOI per questi investitori
    let activeLoisCount = 0;
    let committedLoisCount = 0;
    let pipelineAmount = 0;
    let committedCapital = 0;

    if (investorIds.length > 0) {
      // Conta LOI attive (status = 'draft' o 'sent')
      const { count: activeLois, error: activeError } = await supabase
        .from("fundops_lois")
        .select("*", { count: "exact", head: true })
        .in("investor_id", investorIds)
        .in("status", ["draft", "sent"]);

      if (activeError) {
        console.error("Error counting active LOIs:", activeError);
      } else {
        activeLoisCount = activeLois || 0;
      }

      // Conta LOI firmate (status = 'signed')
      const { count: signedLois, error: signedError } = await supabase
        .from("fundops_lois")
        .select("*", { count: "exact", head: true })
        .in("investor_id", investorIds)
        .eq("status", "signed");

      if (signedError) {
        console.error("Error counting signed LOIs:", signedError);
      } else {
        committedLoisCount = signedLois || 0;
      }

      // Calcola pipeline amount (somma ticket_amount per LOI draft/sent)
      const { data: pipelineLois, error: pipelineError } = await supabase
        .from("fundops_lois")
        .select("ticket_amount")
        .in("investor_id", investorIds)
        .in("status", ["draft", "sent"]);

      if (pipelineError) {
        console.error("Error fetching pipeline LOIs:", pipelineError);
      } else {
        pipelineAmount = (pipelineLois || []).reduce(
          (sum, loi) => sum + (loi.ticket_amount || 0),
          0
        );
      }

      // Calcola committed capital (somma ticket_amount per LOI signed)
      const { data: committedLoisData, error: committedCapitalError } = await supabase
        .from("fundops_lois")
        .select("ticket_amount")
        .in("investor_id", investorIds)
        .eq("status", "signed");

      if (committedCapitalError) {
        console.error("Error fetching committed LOIs for capital:", committedCapitalError);
      } else {
        committedCapital = (committedLoisData || []).reduce(
          (sum, loi) => sum + (loi.ticket_amount || 0),
          0
        );
      }
    }

    // Determina status della fase Booking
    let bookingStatus: "not_started" | "in_progress" | "completed";
    
    if ((investorsCount || 0) === 0 || activeLoisCount === 0) {
      // Nessun investitore OPPURE nessuna LOI attiva
      bookingStatus = "not_started";
    } else if (committedLoisCount === 0) {
      // Investitori e LOI attive esistono, ma nessuna LOI è firmata
      bookingStatus = "in_progress";
    } else {
      // Almeno una LOI è firmata
      bookingStatus = "completed";
    }

    // === FASE 2: ISSUING (placeholder) ===
    // Sempre not_started per ora
    const issuingStatus = "not_started" as const;

    // === FASE 3: ONBOARDING (placeholder) ===
    // Sempre not_started per ora
    const onboardingStatus = "not_started" as const;

    // === DETERMINA FASE CORRENTE ===
    let currentPhase: "booking" | "issuing" | "onboarding";
    
    if (bookingStatus !== "completed") {
      currentPhase = "booking";
    } else if (issuingStatus === "not_started") {
      // Booking completato ma Issuing non ancora iniziato
      currentPhase = "issuing";
    } else {
      // Issuing completato (futuro)
      currentPhase = "onboarding";
    }

    return NextResponse.json(
      {
        booking: {
          status: bookingStatus,
          investors_count: investorsCount || 0,
          active_lois_count: activeLoisCount,
          committed_lois_count: committedLoisCount,
          pipeline_amount: pipelineAmount,
          committed_capital: committedCapital,
        },
        issuing: {
          status: issuingStatus,
        },
        onboarding: {
          status: onboardingStatus,
        },
        current_phase: currentPhase,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in fundops_process_status API:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
