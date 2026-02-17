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

  if (role === "imment_admin" || role === "imment_operator") {
    const { data, error } = await supabase
      .from("fundops_companies")
      .select("id, name, legal_name")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  }

  const companyIds = new Set<string>();

  // Companies via seat attivo (fundops_company_users)
  const { data: seats } = await supabase
    .from("fundops_company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("is_active", true);

  for (const s of seats ?? []) {
    companyIds.add(s.company_id);
  }

  // Companies via investor_account attivo (se utente è investor)
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
