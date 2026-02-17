import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface LoiRow {
  id: string;
  master_expires_at: string | null;
}

interface SignerRow {
  id: string;
  loi_id: string;
  status: string;
  expires_at_override: string | null;
  indicative_amount: number | string | null;
}

/**
 * GET - Ottiene KPI per le LOI round-level basate sui signers
 * Filtra per fundops_lois.company_id = activeCompanyId
 * Conta signers invece di LOI individuali
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

    // 1. Trova tutte le LOI round-level per questa company
    const { data: lois, error: loisError } = await supabase
      .from("fundops_lois")
      .select("id, master_expires_at")
      .eq("company_id", companyId);

    if (loisError) {
      console.error("Error fetching LOIs:", loisError);
      return NextResponse.json(
        { error: "Errore nel caricamento delle LOI" },
        { status: 500 }
      );
    }

    const loiRows = (lois ?? []) as LoiRow[];
    const loiIds = loiRows.map((loi) => loi.id);

    // Se non ci sono LOI, ritorna valori zero
    if (loiIds.length === 0) {
      return NextResponse.json(
        {
          activeLois: 0,
          committedLois: 0,
          expiringLois: 0,
          pipelineCapital: 0,
          committedCapital: 0,
        },
        { status: 200 }
      );
    }

    // 2. Calcola date per scadenze (14 giorni)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const fourteenDaysFromNow = new Date();
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
    fourteenDaysFromNow.setHours(23, 59, 59, 999);

    // 3. Recupera tutti i signers per queste LOI
    const { data: allSigners, error: signersError } = await supabase
      .from("fundops_loi_signers")
      .select("id, loi_id, status, expires_at_override, indicative_amount")
      .in("loi_id", loiIds);

    if (signersError) {
      console.error("Error fetching signers:", signersError);
      return NextResponse.json(
        { error: "Errore nel caricamento dei signers" },
        { status: 500 }
      );
    }

    // Crea una mappa per lookup veloce di master_expires_at
    const loiMasterExpiryMap = new Map(
      loiRows.map((loi) => [loi.id, loi.master_expires_at])
    );

    // 4. Calcola KPI basati sui signers
    let activeLois = 0; // count status in (invited, accepted, signed) e non expired/revoked
    let acceptedLois = 0; // count status=accepted e non expired/revoked (soft commitment)
    let committedLois = 0; // count status=signed e non expired/revoked (hard signature)
    let expiringLois = 0; // count expires_at_effettiva entro 14gg e status in (invited, accepted, signed)
    let pipelineCapital = 0; // sum indicative_amount per status in (invited, accepted, signed) e non expired/revoked
    let committedCapital = 0; // sum indicative_amount per status=signed e non expired/revoked

    const signerRows = (allSigners ?? []) as SignerRow[];
    signerRows.forEach((signer) => {
      const status = signer.status;
      const effectiveExpiry = signer.expires_at_override || loiMasterExpiryMap.get(signer.loi_id);
      
      // Skip expired e revoked
      if (status === "expired" || status === "revoked") {
        return;
      }

      // Active LOIs: invited, accepted, signed
      if (["invited", "accepted", "signed"].includes(status)) {
        activeLois++;
        
        // Pipeline capital
        if (signer.indicative_amount) {
          pipelineCapital += parseFloat(signer.indicative_amount.toString());
        }
      }

      // Accepted LOIs: accepted (soft commitment)
      if (status === "accepted") {
        acceptedLois++;
      }

      // Committed LOIs: signed (hard signature)
      if (status === "signed") {
        committedLois++;
        
        // Committed capital
        if (signer.indicative_amount) {
          committedCapital += parseFloat(signer.indicative_amount.toString());
        }
      }

      // Expiring LOIs: expires_at_effettiva entro 14gg e status in (invited, accepted, signed)
      if (effectiveExpiry && ["invited", "accepted", "signed"].includes(status)) {
        const expiryDate = new Date(effectiveExpiry);
        if (expiryDate >= today && expiryDate <= fourteenDaysFromNow) {
          expiringLois++;
        }
      }
    });

    // Calcola anche total_signers e active_lois_count (numero LOI master attive)
    const totalSigners = signerRows.length;
    const activeLoisCount = loiIds.length; // Numero di LOI master per questa company

    return NextResponse.json(
      {
        total_signers: totalSigners,
        signed_signers_count: committedLois, // Metrica principale per soglia fase
        accepted_signers_count: acceptedLois,
        active_lois_count: activeLoisCount,
        activeLois, // Legacy: count signers attivi
        acceptedLois, // Legacy
        committedLois, // Legacy
        expiringLois,
        pipelineCapital, // Somma indicative_amount (solo se non nullo), NON usato per soglia
        committedCapital,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in LOI KPI API:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
