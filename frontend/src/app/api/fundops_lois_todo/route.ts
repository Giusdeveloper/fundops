import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface LoiRow {
  id: string;
  title: string | null;
  expiry_date: string | null;
  master_expires_at?: string | null;
}

interface InvestorRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface SignerRow {
  id: string;
  loi_id: string;
  investor_id: string;
  status: string;
  expires_at_override: string | null;
  soft_commitment_at: string | null;
  hard_signed_at: string | null;
  investor?: InvestorRow | null;
}

/**
 * GET - Ottiene TODO items basati sui signers delle LOI round-level
 * Filtra per fundops_lois.company_id = activeCompanyId
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
    // Seleziona solo campi base che esistono sempre, gestiamo master_expires_at dopo
    const { data: lois, error: loisError } = await supabase
      .from("fundops_lois")
      .select("id, title, expiry_date")
      .eq("company_id", companyId);

    if (loisError) {
      console.error("Error fetching LOIs:", loisError);
      // In caso di errore, ritorna TODO vuoti invece di fallire completamente
      return NextResponse.json(
        {
          expiringLois: [],
          loisNeedingReminder: [],
          investorsWithoutLoi: [],
          investorsWithoutLoiCount: 0,
        },
        { status: 200 }
      );
    }

    const loiRows = (lois ?? []) as LoiRow[];
    const loiIds = loiRows.map((loi) => loi.id);

    // Se non ci sono LOI, ritorna TODO vuoti
    if (loiIds.length === 0) {
      return NextResponse.json(
        {
          expiringLois: [],
          loisNeedingReminder: [],
          investorsWithoutLoi: [],
          investorsWithoutLoiCount: 0,
        },
        { status: 200 }
      );
    }

    // Crea mappa per lookup veloce
    // Usa expiry_date come fallback se master_expires_at non esiste (compatibilità legacy)
    const loiMap = new Map(loiRows.map((loi) => [
      loi.id, 
      { 
        ...loi, 
        master_expires_at: loi.master_expires_at || loi.expiry_date || null 
      }
    ]));

    // 2. Calcola date per scadenze (14 giorni)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const fourteenDaysFromNow = new Date();
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
    fourteenDaysFromNow.setHours(23, 59, 59, 999);

    // 3. Recupera tutti i signers con dati investitore
    // Gestisci il caso in cui la tabella non esista ancora (migration non eseguita)
    let allSigners: SignerRow[] = [];
    const signerInvestorIds = new Set<string>();
    
    // Se non ci sono LOI, non possiamo avere signers
    if (loiIds.length === 0) {
      // Ritorna TODO vuoti ma continua per calcolare investorsWithoutLoi
    } else {
      try {
        const { data: signersData, error: signersError } = await supabase
          .from("fundops_loi_signers")
          .select(`
            id,
            loi_id,
            investor_id,
            status,
            expires_at_override,
            soft_commitment_at,
            hard_signed_at
          `)
          .in("loi_id", loiIds);

        if (signersError) {
          // Se la tabella non esiste, continua con signers vuoti (migration non ancora eseguita)
          if (signersError.code === '42P01' || signersError.message?.includes('does not exist')) {
            console.warn("Tabella fundops_loi_signers non esiste ancora. Esegui la migration.");
            allSigners = [];
          } else {
            console.error("Error fetching signers:", signersError);
            // Non fallire completamente, continua con signers vuoti
            allSigners = [];
          }
        } else {
          allSigners = (signersData ?? []) as SignerRow[];

          // Recupera dati investitori separatamente per evitare problemi con join
          if (allSigners.length > 0) {
            const investorIds = [...new Set(allSigners.map((s) => s.investor_id))];
            const { data: investorsData, error: investorsError } = await supabase
              .from("fundops_investors")
              .select("id, full_name, email")
              .in("id", investorIds);

            if (!investorsError && investorsData) {
              const investorRows = investorsData as InvestorRow[];
              const investorMap = new Map(investorRows.map((inv) => [inv.id, inv]));
              // Aggiungi dati investitore ai signers
              allSigners = allSigners.map((signer) => ({
                ...signer,
                investor: investorMap.get(signer.investor_id) || null,
              }));
              investorIds.forEach((id: string) => signerInvestorIds.add(id));
            }
          }
        }
      } catch (err) {
        console.error("Error in signers query:", err);
        // Se c'è un errore, continua con signers vuoti invece di fallire
        allSigners = [];
      }
    }

    // 4. Calcola scadenza effettiva e identifica TODO items
    const expiringLois: Array<Record<string, string | null>> = [];
    const loisNeedingReminder: Array<Record<string, string | null>> = [];

    allSigners.forEach((signer) => {
      const loi = loiMap.get(signer.loi_id);
      if (!loi) return;

      const effectiveExpiry = signer.expires_at_override || loi.master_expires_at;
      const investor = signer.investor;
      
      if (investor) {
        signerInvestorIds.add(signer.investor_id);
      }

      // Expiring LOIs: expires_at_effettiva entro 14gg e status in (invited, accepted, signed)
      if (effectiveExpiry && ["invited", "accepted", "signed"].includes(signer.status)) {
        const expiryDate = new Date(effectiveExpiry);
        if (expiryDate >= today && expiryDate <= fourteenDaysFromNow) {
          expiringLois.push({
            loiId: signer.loi_id,
            signerId: signer.id,
            loiTitle: loi.title || "LOI",
            investorName: investor?.full_name || "Investitore sconosciuto",
            expiryDate: effectiveExpiry,
            status: signer.status,
          });
        }
      }

      // LOI needing reminder: accepted non signed (soft commitment ma non ancora firmato)
      if (signer.status === "accepted" && !signer.hard_signed_at) {
        loisNeedingReminder.push({
          loiId: signer.loi_id,
          signerId: signer.id,
          loiTitle: loi.title || "LOI",
          investorName: investor?.full_name || "Investitore sconosciuto",
          lastReminderAt: signer.soft_commitment_at, // Usa soft_commitment_at come proxy per "ultimo reminder"
        });
      }
    });

    // 5. Trova investitori senza LOI (non sono signers di nessuna LOI)
    const { data: allInvestors, error: investorsError } = await supabase
      .from("fundops_investors")
      .select("id, full_name, email")
      .eq("client_company_id", companyId);

    if (investorsError) {
      console.error("Error fetching investors:", investorsError);
    }

    const investorRows = (allInvestors ?? []) as InvestorRow[];
    const investorsWithoutLoi = investorRows
      .filter((inv) => !signerInvestorIds.has(inv.id))
      .map((inv) => ({
        investorId: inv.id,
        investorName: inv.full_name || "Investitore sconosciuto",
        investorEmail: inv.email || "",
      }))
      .slice(0, 10); // Limita a 10 per performance

    return NextResponse.json(
      {
        expiringLois,
        loisNeedingReminder,
        investorsWithoutLoi,
        investorsWithoutLoiCount: investorRows.filter((inv) => !signerInvestorIds.has(inv.id)).length,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in LOI TODO API:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
