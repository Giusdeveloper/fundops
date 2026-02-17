import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LoiEventType } from "@/lib/loiEvents";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface RouteParams {
  params: Promise<{
    loiId: string;
  }>;
}

/**
 * POST - Invia un reminder per una LOI
 * Aggiorna last_reminder_at, reminder_count e crea evento timeline
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

    const now = new Date().toISOString();

    // Calcola reminder count dagli eventi esistenti (source of truth)
    const { data: existingReminders } = await supabase
      .from("fundops_loi_events")
      .select("id")
      .eq("loi_id", loiId)
      .eq("event_type", LoiEventType.REMINDER);

    const reminderCount = (existingReminders || []).length;
    const newReminderNumber = reminderCount + 1;

    // Aggiorna solo updated_at (i campi reminder sono gestiti solo tramite eventi)
    // NON usare colonne last_reminder_at/reminder_count se non esistono
    const { data: updatedLoi, error: updateError } = await supabase
      .from("fundops_lois")
      .update({ updated_at: now })
      .eq("id", loiId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating LOI:", updateError);
      // Continua comunque con la creazione dell'evento
    }

    // Crea evento reminder nella timeline (source of truth)
    const { data: event, error: eventError } = await supabase
      .from("fundops_loi_events")
      .insert({
        loi_id: loiId,
        event_type: LoiEventType.REMINDER,
        label: "Reminder inviato",
        metadata: {
          reminderNumber: newReminderNumber,
          previousReminderCount: reminderCount,
        },
        created_by: user.id,
      })
      .select()
      .single();

    if (eventError) {
      console.error("Error creating reminder event:", eventError);
      return NextResponse.json(
        { error: "Errore nella creazione dell'evento reminder" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: updatedLoi || loi,
        event: event,
        eventCreated: true,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in reminder endpoint:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
