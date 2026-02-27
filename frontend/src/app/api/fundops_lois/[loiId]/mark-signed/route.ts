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
 * POST - Segna una LOI come firmata
 * Disponibile solo se status = "sent"
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
    const companyId = searchParams.get("companyId")?.trim();

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

    // Verifica che lo status sia "sent"
    const normalizedStatus = (loi.status || "").toLowerCase();
    if (normalizedStatus !== LoiStatus.SENT) {
      return NextResponse.json(
        { error: `LOI must be in "sent" status to be marked as signed. Current status: ${loi.status}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Aggiorna status a "signed" e setta signed_at
    const { data: updatedLoi, error: updateError } = await supabase
      .from("fundops_lois")
      .update({
        status: LoiStatus.SIGNED,
        loi_signed_date: now,
        updated_at: now,
      })
      .eq("id", loiId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating LOI status:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Crea evento "LOI firmata"
    const { data: event, error: eventError } = await supabase
      .from("fundops_loi_events")
      .insert({
        loi_id: loiId,
        company_id: companyId,
        event_type: LoiEventType.SIGNED,
        label: "LOI firmata",
        metadata: {
          previous_status: loi.status,
          source: "user",
        },
        created_by: user.id,
      })
      .select()
      .single();

    if (eventError) {
      console.error("Error creating signed event:", eventError);
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
    console.error("Error in mark-signed endpoint:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
