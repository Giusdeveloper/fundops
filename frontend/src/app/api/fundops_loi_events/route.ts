import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEventLabel } from "@/lib/loiEvents";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface InvestorNameRow {
  id: string;
  full_name: string | null;
}

/**
 * GET - Ottiene gli eventi per una LOI o per una company
 * Query params:
 *   - loiId: eventi per una specifica LOI (comportamento legacy)
 *   - companyId: eventi per tutte le LOI della company (max limit, default 8)
 *   - limit: numero massimo di eventi (default 8, solo per companyId)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const loiId = searchParams.get("loiId");
    const companyId = searchParams.get("companyId");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 8;

    // Comportamento legacy: se c'è loiId, ritorna eventi per quella LOI
    if (loiId) {
      const { data: loi } = await supabase
        .from("fundops_lois")
        .select("company_id")
        .eq("id", loiId)
        .maybeSingle();
      if (!loi) {
        return NextResponse.json({ error: "LOI not found" }, { status: 404 });
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

      const { data, error } = await supabase
        .from("fundops_loi_events")
        .select("*")
        .eq("loi_id", loiId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching LOI events:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data: data || [] }, { status: 200 });
    }

    // Nuovo comportamento: se c'è companyId, ritorna eventi per la company
    if (companyId) {
      const hasAccess = await canAccessCompany(
        supabase,
        user.id,
        companyId,
        roleContext
      );
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Ottieni gli ID delle LOI della company
      const { data: companyLois, error: loisError } = await supabase
        .from("fundops_lois")
        .select("id")
        .eq("company_id", companyId);

      if (loisError) {
        console.error("Error fetching company LOIs:", loisError);
        return NextResponse.json({ error: loisError.message }, { status: 500 });
      }

      const loiIds = (companyLois || []).map((l) => l.id);

      if (loiIds.length === 0) {
        return NextResponse.json({ data: [] }, { status: 200 });
      }

      // Ottieni gli eventi per queste LOI
      const { data: events, error: eventsError } = await supabase
        .from("fundops_loi_events")
        .select("id, loi_id, event_type, label, created_at, metadata")
        .in("loi_id", loiIds)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (eventsError) {
        console.error("Error fetching company events:", eventsError);
        return NextResponse.json({ error: eventsError.message }, { status: 500 });
      }

      // Arricchisci con loiTitle e investorName
      const loiIdsFromEvents = Array.from(new Set((events || []).map((e) => e.loi_id)));
      
      // Ottieni le LOI
      const { data: lois, error: loisFetchError } = await supabase
        .from("fundops_lois")
        .select("id, title, investor_id")
        .in("id", loiIdsFromEvents.length > 0 ? loiIdsFromEvents : [""]);

      if (loisFetchError) {
        console.error("Error fetching LOIs for enrichment:", loisFetchError);
      }

      const loiMap = new Map(
        (lois || []).map((l) => [l.id, { title: l.title, investorId: l.investor_id }])
      );

      // Ottieni gli investitori
      const investorIds = Array.from(
        new Set((lois || []).map((l) => l.investor_id).filter(Boolean))
      );
      
      let investors: InvestorNameRow[] = [];
      if (investorIds.length > 0) {
        const { data: investorsData } = await supabase
          .from("fundops_investors")
          .select("id, full_name")
          .in("id", investorIds);
        investors = (investorsData ?? []) as InvestorNameRow[];
      }

      const investorMap = new Map(investors.map((inv) => [inv.id, inv.full_name]));

      // Arricchisci gli eventi
      const enrichedEvents = (events || []).map((event) => {
        const loiInfo = loiMap.get(event.loi_id);
        const investorId = loiInfo?.investorId;
        return {
          id: event.id,
          createdAt: event.created_at,
          eventType: event.event_type,
          label: event.label || event.event_type,
          loiId: event.loi_id,
          loiTitle: loiInfo?.title || null,
          investorId: investorId || null,
          investorName: investorId ? (investorMap.get(investorId) || null) : null,
        };
      });

      return NextResponse.json({ data: enrichedEvents }, { status: 200 });
    }

    // Se non c'è né loiId né companyId, errore
    return NextResponse.json(
      { error: "loiId o companyId è richiesto" },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST - Crea un nuovo evento LOI
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

    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const body = await request.json();

    const { loi_id, event_type, label, metadata } = body;

    if (!loi_id || !event_type) {
      return NextResponse.json(
        { error: "loi_id e event_type sono obbligatori" },
        { status: 400 }
      );
    }

    const { data: loi } = await supabase
      .from("fundops_lois")
      .select("company_id")
      .eq("id", loi_id)
      .maybeSingle();

    if (!loi) {
      return NextResponse.json({ error: "LOI not found" }, { status: 404 });
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

    // Usa label fornita o genera default
    const eventLabel = label || getEventLabel(event_type);

    const { data, error } = await supabase
      .from("fundops_loi_events")
      .insert({
        loi_id,
        event_type,
        label: eventLabel,
        metadata: metadata || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating LOI event:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
