import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface IdRow {
  id: string;
}

interface InsertedSignerRow {
  id: string;
}

/**
 * POST /api/lois/[id]/signers/invite
 * Bulk add investors come signers con status=invited
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
    const { investor_ids } = body;

    if (!loiId) {
      return NextResponse.json(
        { error: "loi_id is required" },
        { status: 400 }
      );
    }

    if (!investor_ids || !Array.isArray(investor_ids) || investor_ids.length === 0) {
      return NextResponse.json(
        { error: "investor_ids array is required" },
        { status: 400 }
      );
    }

    // Verifica che la LOI esista
    const { data: loi, error: loiError } = await supabase
      .from("fundops_lois")
      .select("id, company_id")
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

    // Verifica che tutti gli investor_id esistano
    const { data: investors, error: investorsError } = await supabase
      .from("fundops_investors")
      .select("id")
      .in("id", investor_ids)
      .or(`client_company_id.eq.${loi.company_id},company_id.eq.${loi.company_id}`);

    if (investorsError) {
      return NextResponse.json(
        { error: "Errore nella verifica degli investitori" },
        { status: 500 }
      );
    }

    const validInvestorIds = ((investors ?? []) as IdRow[]).map((inv) => inv.id);
    const invalidIds = investor_ids.filter((id: string) => !validInvestorIds.includes(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Investitori non trovati: ${invalidIds.join(", ")}` },
        { status: 400 }
      );
    }

    // Prepara i signers da inserire (evita duplicati con ON CONFLICT)
    const signersToInsert = investor_ids.map((investorId: string) => ({
      loi_id: loiId,
      investor_id: investorId,
      status: "invited",
    }));

    // Inserisci i signers (ignora duplicati grazie a unique constraint)
    const { data: insertedSigners, error: insertError } = await supabase
      .from("fundops_loi_signers")
      .upsert(signersToInsert, {
        onConflict: "loi_id,investor_id",
        ignoreDuplicates: false,
      })
      .select("*");

    if (insertError) {
      // Se l'errore è dovuto a duplicati, restituisci un messaggio più chiaro
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Uno o più investitori sono già stati invitati a questa LOI" },
          { status: 409 }
        );
      }
      console.error("Error inserting signers:", insertError);
      return NextResponse.json(
        { error: "Errore nell'inserimento dei signers" },
        { status: 500 }
      );
    }

    // Crea eventi di audit per ogni signer invitato
    if (insertedSigners && insertedSigners.length > 0) {
      const events = (insertedSigners as InsertedSignerRow[]).map((signer) => ({
        signer_id: signer.id,
        event_type: "invited",
        event_data: { invited_at: new Date().toISOString() },
        created_by: user.id,
      }));

      await supabase.from("fundops_loi_signer_events").insert(events);
    }

    return NextResponse.json(
      {
        success: true,
        count: insertedSigners?.length || 0,
        signers: insertedSigners,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in POST /api/lois/[id]/signers/invite:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
