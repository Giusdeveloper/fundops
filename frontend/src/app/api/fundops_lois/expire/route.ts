import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LoiEventType } from "@/lib/loiEvents";
import { LoiStatus } from "@/lib/loiStatus";
import {
  canAccessCompany,
  getAccessibleCompanyIds,
  getUserRoleContext,
} from "@/lib/companyAccess";

/**
 * POST - Scade automaticamente le LOI scadute
 * Server-side: trova tutte le LOI con expiry_date < today e status ∈ [draft, sent]
 * e le aggiorna a "expired"
 * 
 * Query params opzionali:
 * - companyId: filtra per company specifica
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

    const { searchParams } = new URL(request.url);
    const companyIdParam = searchParams.get("companyId")?.trim() || null;
    const roleContext = await getUserRoleContext(supabase, user.id);

    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const targetCompanyIds: string[] = [];
    if (companyIdParam) {
      const hasAccess = await canAccessCompany(
        supabase,
        user.id,
        companyIdParam,
        roleContext
      );
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      targetCompanyIds.push(companyIdParam);
    } else {
      const accessibleCompanyIds = await getAccessibleCompanyIds(
        supabase,
        user.id,
        roleContext
      );
      targetCompanyIds.push(...accessibleCompanyIds);
    }

    if (targetCompanyIds.length === 0) {
      return NextResponse.json(
        {
          data: [],
          count: 0,
          message: "No accessible companies found",
        },
        { status: 200 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // Query per trovare LOI scadute
    const query = supabase
      .from("fundops_lois")
      .select("id, company_id, status, expiry_date")
      .lt("expiry_date", todayStr)
      .in("status", [LoiStatus.DRAFT, LoiStatus.SENT])
      .in("company_id", targetCompanyIds);

    const { data: expiredLois, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching expired LOIs:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!expiredLois || expiredLois.length === 0) {
      return NextResponse.json(
        {
          data: [],
          count: 0,
          message: "No expired LOIs found",
        },
        { status: 200 }
      );
    }

    const now = new Date().toISOString();
    const updatedIds: string[] = [];
    const errors: string[] = [];

    // Aggiorna ogni LOI scaduta
    for (const loi of expiredLois) {
      try {
        // Aggiorna status a expired
        const { error: updateError } = await supabase
          .from("fundops_lois")
          .update({
            status: LoiStatus.EXPIRED,
            updated_at: now,
          })
          .eq("id", loi.id);

        if (updateError) {
          console.error(`Error updating LOI ${loi.id}:`, updateError);
          errors.push(`LOI ${loi.id}: ${updateError.message}`);
          continue;
        }

        // Crea evento "LOI scaduta automaticamente"
        await supabase.from("fundops_loi_events").insert({
          loi_id: loi.id,
          company_id: loi.company_id,
          event_type: LoiEventType.EXPIRED,
          label: "LOI scaduta automaticamente",
          metadata: {
            previous_status: loi.status,
            expiry_date: loi.expiry_date,
            source: "system",
          },
          created_by: user.id,
        });

        updatedIds.push(loi.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Errore sconosciuto";
        console.error(`Error processing LOI ${loi.id}:`, err);
        errors.push(`LOI ${loi.id}: ${message}`);
      }
    }

    return NextResponse.json(
      {
        data: updatedIds,
        count: updatedIds.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Expired ${updatedIds.length} LOI(s)`,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in expire endpoint:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
