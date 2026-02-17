import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface LoiEventRow {
  loi_id: string;
}

/**
 * GET - Ottiene l'ultimo evento per ogni LOI specificata (batch)
 * Query params: loiIds=id1,id2,id3
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

    const { searchParams } = new URL(request.url);
    const loiIdsParam = searchParams.get("loiIds");

    if (!loiIdsParam) {
      return NextResponse.json(
        { error: "loiIds is required (comma-separated)" },
        { status: 400 }
      );
    }

    const loiIds = loiIdsParam.split(",").filter((id) => id.trim());

    if (loiIds.length === 0) {
      return NextResponse.json({ data: {} }, { status: 200 });
    }

    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const { data: lois } = await supabase
      .from("fundops_lois")
      .select("id, company_id")
      .in("id", loiIds);

    const foundLoiIds = new Set((lois ?? []).map((loi) => loi.id));
    if (foundLoiIds.size !== loiIds.length) {
      return NextResponse.json({ error: "One or more LOIs not found" }, { status: 404 });
    }

    const uniqueCompanyIds = Array.from(new Set((lois ?? []).map((loi) => loi.company_id)));
    for (const companyId of uniqueCompanyIds) {
      const hasAccess = await canAccessCompany(supabase, user.id, companyId, roleContext);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Query per ottenere l'ultimo evento per ogni LOI
    // Usiamo una subquery per ottenere solo l'ultimo evento per ogni loi_id
    const { data, error } = await supabase
      .from("fundops_loi_events")
      .select("*")
      .in("loi_id", loiIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching latest LOI events:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Raggruppa per loi_id e prendi solo il primo (più recente) per ogni LOI
    const latestByLoiId: Record<string, unknown> = {};
    if (data) {
      for (const event of data as LoiEventRow[]) {
        if (!latestByLoiId[event.loi_id]) {
          latestByLoiId[event.loi_id] = event;
        }
      }
    }

    return NextResponse.json({ data: latestByLoiId }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
