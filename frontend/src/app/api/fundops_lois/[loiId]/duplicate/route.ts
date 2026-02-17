import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeStatus } from "@/lib/loiStatus";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface RouteParams {
  params: Promise<{
    loiId: string;
  }>;
}

/**
 * POST - Duplica una LOI esistente
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { loiId } = await params;
    const body = await request.json();
    const { companyId } = body;

    // Recupera la LOI originale
    const { data: originalLoi, error: fetchError } = await supabase
      .from("fundops_lois")
      .select("*")
      .eq("id", loiId)
      .single();

    if (fetchError || !originalLoi) {
      return NextResponse.json(
        { error: "LOI not found" },
        { status: 404 }
      );
    }

    // Verifica che la LOI appartenga alla company se companyId è fornito
    if (companyId && originalLoi.company_id !== companyId) {
      return NextResponse.json(
        { error: "LOI does not belong to the specified company" },
        { status: 403 }
      );
    }

    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(
      supabase,
      user.id,
      originalLoi.company_id,
      roleContext
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Prepara i dati per la nuova LOI
    const newLoiData: Record<string, unknown> = {
      company_id: originalLoi.company_id,
      investor_id: originalLoi.investor_id,
      loi_number: `${originalLoi.loi_number}-COPY-${Date.now()}`,
      title: `${originalLoi.title} (Copia)`,
      sfp_class: originalLoi.sfp_class,
      ticket_amount: originalLoi.ticket_amount,
      currency: originalLoi.currency,
      subscription_date: originalLoi.subscription_date,
      expiry_date: originalLoi.expiry_date,
      notes: originalLoi.notes,
      status: normalizeStatus("draft"), // La copia è sempre draft
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: user.id,
    };

    // Inserisci la nuova LOI
    const { data: newLoi, error: insertError } = await supabase
      .from("fundops_lois")
      .insert(newLoiData)
      .select()
      .single();

    if (insertError) {
      console.error("Error duplicating LOI:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ data: newLoi }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
