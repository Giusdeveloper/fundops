import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface SignerWithInvestorRow {
  expires_at_override: string | null;
  fundops_investors: unknown | null;
}

/**
 * GET /api/lois/[id]/signers
 * Ritorna tutti i signers di una LOI con dati investitore e scadenza effettiva
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id: loiId } = await params;

    if (!loiId) {
      return NextResponse.json(
        { error: "loi_id is required" },
        { status: 400 }
      );
    }

    // Verifica che la LOI esista
    const { data: loi, error: loiError } = await supabase
      .from("fundops_lois")
      .select("id, company_id, master_expires_at")
      .eq("id", loiId)
      .single();

    if (loiError || !loi) {
      return NextResponse.json(
        { error: "LOI not found" },
        { status: 404 }
      );
    }

    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(
      supabase,
      user.id,
      loi.company_id,
      roleContext
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Recupera tutti i signers con dati investitore
    const { data: signers, error: signersError } = await supabase
      .from("fundops_loi_signers")
      .select(`
        id,
        loi_id,
        investor_id,
        status,
        soft_commitment_at,
        hard_signed_at,
        expires_at_override,
        indicative_amount,
        notes,
        created_at,
        updated_at,
        fundops_investors:investor_id (
          id,
          full_name,
          email,
          phone,
          category,
          type
        )
      `)
      .eq("loi_id", loiId)
      .order("created_at", { ascending: false });

    if (signersError) {
      console.error("Error fetching signers:", signersError);
      return NextResponse.json(
        { error: "Errore nel caricamento dei signers" },
        { status: 500 }
      );
    }

    // Calcola scadenza effettiva per ogni signer (override o master)
    const signersWithEffectiveExpiry = ((signers ?? []) as SignerWithInvestorRow[]).map((signer) => {
      const effectiveExpiry = signer.expires_at_override || loi.master_expires_at;
      
      return {
        ...signer,
        effective_expires_at: effectiveExpiry,
        investor: signer.fundops_investors || null,
      };
    });

    return NextResponse.json(
      {
        loi_id: loiId,
        master_expires_at: loi.master_expires_at,
        signers: signersWithEffectiveExpiry,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in GET /api/lois/[id]/signers:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
