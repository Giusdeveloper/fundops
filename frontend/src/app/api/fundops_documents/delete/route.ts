import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LoiEventType } from "@/lib/loiEvents";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

/**
 * POST - Elimina (soft delete) un documento
 * Body: { companyId, documentId }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json();
    const { companyId: companyIdRaw, documentId } = body;

    if (!companyIdRaw || !documentId) {
      return NextResponse.json(
        { error: "companyId e documentId sono richiesti" },
        { status: 400 }
      );
    }

    const companyId = String(companyIdRaw).trim();
    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(supabase, user.id, companyId, roleContext);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Recupera il documento per verificare ownership e ottenere loi_id
    const { data: document, error: docError } = await supabase
      .from("fundops_documents")
      .select("id, loi_id, title, company_id, status")
      .eq("id", documentId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Documento non trovato" },
        { status: 404 }
      );
    }

    if (document.status === "deleted") {
      return NextResponse.json(
        { error: "Documento già eliminato" },
        { status: 400 }
      );
    }

    // Soft delete: aggiorna status
    const { data: updatedDoc, error: updateError } = await supabase
      .from("fundops_documents")
      .update({ status: "deleted" })
      .eq("id", documentId)
      .select()
      .single();

    if (updateError) {
      console.error("Error deleting document:", updateError);
      return NextResponse.json(
        { error: `Errore nell'eliminazione: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Crea evento nella timeline
    try {
      await supabase.from("fundops_loi_events").insert({
        loi_id: document.loi_id,
        event_type: LoiEventType.DOCUMENT_DELETED,
        label: "Documento rimosso",
        metadata: {
          documentId: documentId,
          title: document.title,
        },
        created_by: user.id,
      });
    } catch (eventError) {
      console.warn("Error creating delete event:", eventError);
      // Non bloccare se l'evento non viene creato
    }

    return NextResponse.json({ data: updatedDoc }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
