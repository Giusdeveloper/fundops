import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface ActiveSignerRow {
  id: string;
  expires_at_override: string | null;
  status: string;
}

/**
 * POST /api/lois/[id]/signers/run_expiry
 * Per tutti i signers: se now()>expires_at_effettiva e status in (invited, accepted, signed) => set status=expired
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

    if (!loiId) {
      return NextResponse.json(
        { error: "loi_id is required" },
        { status: 400 }
      );
    }

    // Verifica che la LOI esista e recupera master_expires_at
    const { data: loi, error: loiError } = await supabase
      .from("fundops_lois")
      .select("id, company_id, master_expires_at")
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

    const hasAccess = await canAccessCompany(supabase, user.id, loi.company_id, roleContext);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Recupera tutti i signers con status attivi
    const { data: signers, error: signersError } = await supabase
      .from("fundops_loi_signers")
      .select("id, expires_at_override, status")
      .eq("loi_id", loiId)
      .in("status", ["invited", "accepted", "signed"]);

    if (signersError) {
      console.error("Error fetching signers:", signersError);
      return NextResponse.json(
        { error: "Errore nel caricamento dei signers" },
        { status: 500 }
      );
    }

    const now = new Date();
    const expiredSignerIds: string[] = [];
    const events: Array<{
      signer_id: string;
      event_type: "expired";
      event_data: {
        expired_at: string;
        effective_expires_at: string;
        previous_status: string;
      };
      created_by: string;
    }> = [];

    // Calcola scadenza effettiva e identifica signers scaduti
    ((signers ?? []) as ActiveSignerRow[]).forEach((signer) => {
      const effectiveExpiry = signer.expires_at_override || loi.master_expires_at;
      
      if (effectiveExpiry) {
        const expiryDate = new Date(effectiveExpiry);
        if (now > expiryDate) {
          expiredSignerIds.push(signer.id);
          events.push({
            signer_id: signer.id,
            event_type: "expired",
            event_data: {
              expired_at: now.toISOString(),
              effective_expires_at: effectiveExpiry,
              previous_status: signer.status,
            },
            created_by: user.id,
          });
        }
      }
    });

    if (expiredSignerIds.length === 0) {
      return NextResponse.json(
        {
          success: true,
          expired_count: 0,
          message: "Nessun signer scaduto",
        },
        { status: 200 }
      );
    }

    // Aggiorna tutti i signers scaduti
    const { error: updateError } = await supabase
      .from("fundops_loi_signers")
      .update({
        status: "expired",
        updated_at: now.toISOString(),
      })
      .in("id", expiredSignerIds);

    if (updateError) {
      console.error("Error updating expired signers:", updateError);
      return NextResponse.json(
        { error: "Errore nell'aggiornamento dei signers scaduti" },
        { status: 500 }
      );
    }

    // Crea eventi di audit
    if (events.length > 0) {
      await supabase.from("fundops_loi_signer_events").insert(events);
    }

    return NextResponse.json(
      {
        success: true,
        expired_count: expiredSignerIds.length,
        expired_signer_ids: expiredSignerIds,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in POST /api/lois/[id]/signers/run_expiry:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
