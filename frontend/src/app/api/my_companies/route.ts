import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role_global, is_active")
    .eq("id", user.id)
    .single();

  if (profile?.is_active === false) {
    return NextResponse.json(
      { error: "Accesso disabilitato" },
      { status: 403 }
    );
  }

  const role = profile?.role_global ?? null;

  // Investor: solo companies lato investor account (area investor)
  if (role === "investor") {
    const companyIds = new Set<string>();
    const { data: iuRows } = await supabase
      .from("fundops_investor_users")
      .select("investor_id")
      .eq("user_id", user.id);

    if (iuRows && iuRows.length > 0) {
      const investorIds = iuRows.map((r) => r.investor_id);
      const { data: accounts } = await supabase
        .from("fundops_investor_accounts")
        .select("company_id")
        .in("investor_id", investorIds)
        .eq("is_active", true);

      for (const a of accounts ?? []) {
        companyIds.add(a.company_id);
      }
    }
    if (companyIds.size === 0) {
      return NextResponse.json({ data: [] });
    }

    const { data: companies, error } = await supabase
      .from("fundops_companies")
      .select("id, name, legal_name")
      .in("id", Array.from(companyIds))
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: companies ?? [] });
  }

  // Ruoli startup (founder/operator/admin): solo companies associate via seat,
  // con priorità forzata alle seat company_admin.
  const { data: seats, error: seatsError } = await supabase
    .from("fundops_company_users")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (seatsError) {
    return NextResponse.json({ error: seatsError.message }, { status: 500 });
  }

  const seatRows = seats ?? [];
  const companyIds = Array.from(new Set(seatRows.map((s) => s.company_id)));
  if (companyIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const rolePriorityByCompany = new Map<string, number>();
  for (const seat of seatRows) {
    const priority = seat.role === "company_admin" ? 0 : 1;
    const current = rolePriorityByCompany.get(seat.company_id);
    if (current === undefined || priority < current) {
      rolePriorityByCompany.set(seat.company_id, priority);
    }
  }

  const { data: companies, error: companiesError } = await supabase
    .from("fundops_companies")
    .select("id, name, legal_name")
    .in("id", companyIds);

  if (companiesError) {
    return NextResponse.json({ error: companiesError.message }, { status: 500 });
  }

  const ordered = (companies ?? []).sort((a, b) => {
    const pa = rolePriorityByCompany.get(a.id) ?? 9;
    const pb = rolePriorityByCompany.get(b.id) ?? 9;
    if (pa !== pb) return pa - pb;
    const an = a.name ?? a.legal_name ?? "";
    const bn = b.name ?? b.legal_name ?? "";
    return an.localeCompare(bn, "it");
  });

  return NextResponse.json({ data: ordered });
}
