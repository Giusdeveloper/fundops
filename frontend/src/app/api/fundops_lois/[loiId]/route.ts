import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeStatus, VALID_LOI_STATUSES } from "@/lib/loiStatus";
import { LoiEventType } from "@/lib/loiEvents";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface RouteParams {
  params: Promise<{
    loiId: string;
  }>;
}

/**
 * GET - Ottiene una singola LOI
 */
export async function GET(request: Request, { params }: RouteParams) {
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
    const companyIdParam = searchParams.get("companyId")?.trim() || null;

    const { data, error } = await supabase
      .from("fundops_lois")
      .select("*")
      .eq("id", loiId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching LOI:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "LOI not found" }, { status: 404 });
    }

    if (companyIdParam && data.company_id !== companyIdParam) {
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
      data.company_id,
      roleContext
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH - Aggiorna una LOI (principalmente per lo status)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
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

    const { status, companyId, ...otherUpdates } = body;

    const { data: loi, error: loiError } = await supabase
      .from("fundops_lois")
      .select("company_id, status")
      .eq("id", loiId)
      .maybeSingle();

    if (loiError) {
      return NextResponse.json({ error: loiError.message }, { status: 500 });
    }

    if (!loi) {
      return NextResponse.json({ error: "LOI not found" }, { status: 404 });
    }

    if (companyId && loi.company_id !== companyId) {
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
      loi.company_id,
      roleContext
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Normalizza e valida lo status se fornito
    let normalizedStatus: string | undefined;
    if (status !== undefined) {
      normalizedStatus = normalizeStatus(status);
      if (!VALID_LOI_STATUSES.includes(normalizedStatus)) {
        return NextResponse.json(
          { error: `Invalid status: ${status}. Valid statuses are: ${VALID_LOI_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Prepara l'oggetto di update
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (normalizedStatus) {
      updateData.status = normalizedStatus;
      
      // Aggiorna le date in base allo status
      if (normalizedStatus === "sent" && !otherUpdates.loi_sent_date) {
        updateData.loi_sent_date = new Date().toISOString();
      }
      if (normalizedStatus === "signed" && !otherUpdates.loi_signed_date) {
        updateData.loi_signed_date = new Date().toISOString();
      }
    }

    // Aggiungi altri campi di update
    Object.keys(otherUpdates).forEach((key) => {
      if (otherUpdates[key] !== undefined) {
        updateData[key] = otherUpdates[key];
      }
    });

    const { data, error } = await supabase
      .from("fundops_lois")
      .update(updateData)
      .eq("id", loiId)
      .select()
      .single();

    if (error) {
      console.error("Error updating LOI:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Crea evento se lo status è cambiato
    if (normalizedStatus && loi.status !== normalizedStatus) {
      // Usa STATUS_CHANGED invece di eventi specifici per tracciare meglio le transizioni
      const previousStatus = normalizeStatus(loi.status);
      
      try {
        await supabase.from("fundops_loi_events").insert({
          loi_id: loiId,
          event_type: LoiEventType.STATUS_CHANGED,
          label: `Stato aggiornato: ${previousStatus} → ${normalizedStatus}`,
          metadata: {
            from: previousStatus,
            to: normalizedStatus,
          },
          created_by: user.id,
        });
      } catch (eventError) {
        console.warn("Errore nella creazione dell'evento status_changed:", eventError);
        // Non bloccare se l'evento non viene creato
      }
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE - Elimina una LOI
 */
export async function DELETE(request: Request, { params }: RouteParams) {
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
    const companyIdParam = searchParams.get("companyId")?.trim() || null;

    const { data: loi, error: loiError } = await supabase
      .from("fundops_lois")
      .select("company_id")
      .eq("id", loiId)
      .maybeSingle();

    if (loiError) {
      return NextResponse.json({ error: loiError.message }, { status: 500 });
    }

    if (!loi) {
      return NextResponse.json({ error: "LOI not found" }, { status: 404 });
    }

    if (companyIdParam && loi.company_id !== companyIdParam) {
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
      loi.company_id,
      roleContext
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase
      .from("fundops_lois")
      .delete()
      .eq("id", loiId);

    if (error) {
      console.error("Error deleting LOI:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
