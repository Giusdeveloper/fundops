import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LoiEventType, getEventLabel } from "@/lib/loiEvents";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface RouteParams {
  params: Promise<{
    loiId: string;
  }>;
}

/**
 * POST - Invia una LOI (cambia status a "sent" e crea evento)
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

    // Se già inviata, non cambiare status ma crea comunque evento se richiesto
    const normalizedStatus = (loi.status || "").toLowerCase();
    const isAlreadySent = normalizedStatus === "sent";

    const now = new Date().toISOString();

    // Aggiorna status solo se non è già "sent"
    let updatedLoi = loi;
    if (!isAlreadySent) {
      const { data, error: updateError } = await supabase
        .from("fundops_lois")
        .update({
          status: "sent",
          updated_at: now,
        })
        .eq("id", loiId)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating LOI status:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      updatedLoi = data;
    }

    // Crea evento "LOI inviata"
    const { data: event, error: eventError } = await supabase
      .from("fundops_loi_events")
      .insert({
        loi_id: loiId,
        event_type: LoiEventType.SENT,
        label: getEventLabel(LoiEventType.SENT),
        metadata: {
          previous_status: loi.status,
        },
        created_by: user.id,
      })
      .select()
      .single();

    if (eventError) {
      console.error("Error creating send event:", eventError);
      // Non blocchiamo la risposta se l'evento non viene creato, ma lo segnaliamo
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
    console.error("Error in send endpoint:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
