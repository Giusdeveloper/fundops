import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LoiEventType, buildLoiEvent } from "@/lib/loiEvents";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface LoiRow {
  id: string;
  master_expires_at?: string | null;
  [key: string]: unknown;
}

interface SignerRow {
  loi_id: string;
  status: string;
  expires_at_override?: string | null;
  hard_signed_at?: string | null;
}

/**
 * GET - Lista LOI master per company con aggregati signers
 * Source of truth: fundops_loi_signers
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const includeDraft = searchParams.get("includeDraft") === "true";

    if (!companyId || companyId.trim() === '') {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    const normalizedCompanyId = companyId.trim();
    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(
      supabase,
      user.id,
      normalizedCompanyId,
      roleContext
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let query = supabase
      .from("fundops_lois")
      .select("*")
      .eq("company_id", normalizedCompanyId);

    if (!includeDraft) {
      query = query.eq("status", "sent");
    }

    const { data: lois, error: loisError } = await query.order("updated_at", { ascending: false });

    if (loisError) {
      console.error("Error fetching LOIs:", loisError);
      return NextResponse.json({ error: loisError.message }, { status: 500 });
    }

    if (!lois || lois.length === 0) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    const loiIds = lois.map((loi: LoiRow) => loi.id);

    // Recupera aggregati signers per ogni LOI
    const { data: signers, error: signersError } = await supabase
      .from("fundops_loi_signers")
      .select("loi_id, status, expires_at_override, hard_signed_at")
      .in("loi_id", loiIds);

    if (signersError) {
      console.error("Error fetching signers:", signersError);
      return NextResponse.json({ error: signersError.message }, { status: 500 });
    }

    // Calcola aggregati per ogni LOI
    const loisWithAggregates = lois.map((loi: LoiRow) => {
      const loiSigners = (signers || []).filter((s: SignerRow) => s.loi_id === loi.id);
      
      // Count signers by status
      const signedCount = loiSigners.filter((s: SignerRow) => s.status === 'signed').length;
      const acceptedCount = loiSigners.filter((s: SignerRow) => s.status === 'accepted').length;
      const invitedCount = loiSigners.filter((s: SignerRow) => s.status === 'invited').length;
      const expiredCount = loiSigners.filter((s: SignerRow) => s.status === 'expired').length;
      const revokedCount = loiSigners.filter((s: SignerRow) => s.status === 'revoked').length;

      // Calcola next_expiry (min tra scadenze effettive signers o master_expires_at)
      const effectiveExpiries = loiSigners
        .map((s: SignerRow) => s.expires_at_override || loi.master_expires_at)
        .filter((d: string | null | undefined): d is string => d !== null && d !== undefined)
        .map((d: string) => new Date(d).getTime());
      
      const nextExpiry = effectiveExpiries.length > 0 
        ? new Date(Math.min(...effectiveExpiries)).toISOString()
        : loi.master_expires_at;

      return {
        ...loi,
        signers_count: loiSigners.length,
        signed_count: signedCount,
        accepted_count: acceptedCount,
        invited_count: invitedCount,
        expired_count: expiredCount,
        revoked_count: revokedCount,
        next_expiry: nextExpiry,
      };
    });

    return NextResponse.json({ data: loisWithAggregates }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST - Crea una nuova LOI master (senza investor_id obbligatorio)
 * Gli investitori vengono aggiunti come signers dopo la creazione
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json();

    const {
      company_id,
      round_name,
      title,
      master_expires_at,
      recommended_min_signers,
      recommended_target_signers,
      ticket_amount, // Opzionale: importo indicativo del round
      currency,
      pdf_template_key,
      pdf_template_version,
      notes,
    } = body;

    if (!company_id || company_id.trim() === '') {
      return NextResponse.json(
        { error: "company_id is required" },
        { status: 400 }
      );
    }

    if (!title || title.trim() === '') {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const normalizedCompanyId = company_id.trim();
    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(
      supabase,
      user.id,
      normalizedCompanyId,
      roleContext
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("fundops_lois")
      .insert({
        company_id: normalizedCompanyId,
        investor_id: null, // Non più obbligatorio
        round_name: round_name ?? null,
        title,
        master_expires_at: master_expires_at ?? null,
        recommended_min_signers: recommended_min_signers ?? 5,
        recommended_target_signers: recommended_target_signers ?? 10,
        ticket_amount: ticket_amount ?? null, // Opzionale
        currency: currency ?? null,
        pdf_template_key: pdf_template_key ?? null,
        pdf_template_version: pdf_template_version ?? null,
        subscription_date: null, // Legacy field
        expiry_date: master_expires_at ?? null, // Legacy field, mappato a master_expires_at
        notes: notes ?? null,
        status: 'draft', // Default status per LOI master
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Crea automaticamente l'evento "created" per la nuova LOI
    if (data) {
      try {
        const eventData = buildLoiEvent(LoiEventType.CREATED, {
          loi_id: data.id,
        });

        await supabase
          .from("fundops_loi_events")
          .insert({
            loi_id: data.id,
            event_type: eventData.event_type,
            label: eventData.label,
            metadata: null,
            created_by: user.id,
          });
      } catch (eventError) {
        // Non bloccare la creazione della LOI se l'evento fallisce
        console.warn("Errore nella creazione dell'evento 'created':", eventError);
      }
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

