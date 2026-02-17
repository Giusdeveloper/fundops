import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

/**
 * POST /api/lois/[id]/signers/sign
 * Set status=signed, hard_signed_at=now()
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
    const { signer_id } = body;

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
      .select("id, loi_id, status")
      .eq("id", signer_id)
      .eq("loi_id", loiId)
      .single();

    if (signerError || !signer) {
      return NextResponse.json(
        { error: "Signer not found or does not belong to this LOI" },
        { status: 404 }
      );
    }

    // Prevenire stati incoerenti: blocca se revoked o expired
    if (signer.status === "revoked" || signer.status === "expired") {
      return NextResponse.json(
        { error: `Cannot sign signer with status: ${signer.status}. Signer must be invited or accepted` },
        { status: 400 }
      );
    }

    // Verifica che lo status sia valido per la firma
    if (!["invited", "accepted"].includes(signer.status)) {
      return NextResponse.json(
        { error: `Cannot sign signer with status: ${signer.status}. Expected: invited or accepted` },
        { status: 400 }
      );
    }

    // Recupera il signer completo per verificare soft_commitment_at
    const { data: fullSigner, error: fullSignerError } = await supabase
      .from("fundops_loi_signers")
      .select("soft_commitment_at")
      .eq("id", signer_id)
      .single();

    if (fullSignerError) {
      console.error("Error fetching full signer:", fullSignerError);
      return NextResponse.json(
        { error: "Errore nel recupero del signer" },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();

    // Prepara l'update: se soft_commitment_at è NULL, impostalo a now()
    const updateData: Record<string, string> = {
      status: "signed",
      hard_signed_at: now,
      updated_at: now,
    };

    // Coerenza timeline: se manca soft_commitment_at, impostalo automaticamente
    if (!fullSigner.soft_commitment_at) {
      updateData.soft_commitment_at = now;
    }

    // Aggiorna il signer
    const { data: updatedSigner, error: updateError } = await supabase
      .from("fundops_loi_signers")
      .update(updateData)
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
      event_type: "signed",
      event_data: { signed_at: now },
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
    console.error("Error in POST /api/lois/[id]/signers/sign:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
