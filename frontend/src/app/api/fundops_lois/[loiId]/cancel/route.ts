import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LoiEventType } from "@/lib/loiEvents";
import { LoiStatus } from "@/lib/loiStatus";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface RouteParams {
  params: Promise<{
    loiId: string;
  }>;
}

/**
 * POST - Annulla una LOI
 * Disponibile solo se status ∈ [draft, sent]
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
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(supabase, user.id, companyId, roleContext);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verifica che la LOI esista e appartenga alla company
    const { data: loi, error: loiError } = await supabase
      .from("fundops_lois")
      .select("*")
      .eq("id", loiId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (loiError) {
      console.error("Error fetching LOI:", loiError);
      return NextResponse.json({ error: loiError.message }, { status: 500 });
    }

    if (!loi) {
      return NextResponse.json(
        { error: "LOI not found or does not belong to the specified company" },
        { status: 404 }
      );
    }

    // Verifica che lo status sia draft o sent
    const normalizedStatus = (loi.status || "").toLowerCase();
    if (normalizedStatus !== LoiStatus.DRAFT && normalizedStatus !== LoiStatus.SENT) {
      return NextResponse.json(
        { error: `LOI can only be cancelled if status is "draft" or "sent". Current status: ${loi.status}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Aggiorna status a "cancelled"
    const { data: updatedLoi, error: updateError } = await supabase
      .from("fundops_lois")
      .update({
        status: LoiStatus.CANCELLED,
        updated_at: now,
      })
      .eq("id", loiId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating LOI status:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Crea evento "LOI annullata"
    const { data: event, error: eventError } = await supabase
      .from("fundops_loi_events")
      .insert({
        loi_id: loiId,
        company_id: companyId,
        event_type: LoiEventType.CANCELLED,
        label: "LOI annullata",
        metadata: {
          previous_status: loi.status,
          source: "user",
        },
        created_by: user.id,
      })
      .select()
      .single();

    if (eventError) {
      console.error("Error creating cancelled event:", eventError);
      // Non blocchiamo la risposta se l'evento non viene creato
    }

    return NextResponse.json(
      {
        data: updatedLoi,
        event: event || null,
        eventCreated: !eventError,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in cancel endpoint:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
