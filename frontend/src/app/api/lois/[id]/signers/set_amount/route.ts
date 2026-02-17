import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

/**
 * POST /api/lois/[id]/signers/set_amount
 * Set indicative_amount (nullable)
 */
export async function POST(
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
    const body = await request.json();
    const { signer_id, indicative_amount } = body;

    if (!loiId || !signer_id) {
      return NextResponse.json(
        { error: "loi_id and signer_id are required" },
        { status: 400 }
      );
    }

    const { data: loi } = await supabase
      .from("fundops_lois")
      .select("company_id")
      .eq("id", loiId)
      .maybeSingle();
    if (!loi) {
      return NextResponse.json({ error: "LOI not found" }, { status: 404 });
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

    // Verifica che il signer esista e appartenga alla LOI
    const { data: signer, error: signerError } = await supabase
      .from("fundops_loi_signers")
      .select("id, loi_id")
      .eq("id", signer_id)
      .eq("loi_id", loiId)
      .single();

    if (signerError || !signer) {
      return NextResponse.json(
        { error: "Signer not found or does not belong to this LOI" },
        { status: 404 }
      );
    }

    // Valida che indicative_amount sia un numero se fornito
    if (indicative_amount !== null && indicative_amount !== undefined) {
      const amount = parseFloat(indicative_amount);
      if (isNaN(amount) || amount < 0) {
        return NextResponse.json(
          { error: "indicative_amount must be a valid positive number" },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();

    // Aggiorna il signer
    const { data: updatedSigner, error: updateError } = await supabase
      .from("fundops_loi_signers")
      .update({
        indicative_amount: indicative_amount === null || indicative_amount === undefined ? null : parseFloat(indicative_amount),
        updated_at: now,
      })
      .eq("id", signer_id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Error updating signer:", updateError);
      return NextResponse.json(
        { error: "Errore nell'aggiornamento del signer" },
        { status: 500 }
      );
    }

    // Crea evento di audit
    await supabase.from("fundops_loi_signer_events").insert({
      signer_id: signer_id,
      event_type: "amount_set",
      event_data: { 
        indicative_amount: updatedSigner.indicative_amount,
        set_at: now,
      },
      created_by: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        signer: updatedSigner,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in POST /api/lois/[id]/signers/set_amount:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
