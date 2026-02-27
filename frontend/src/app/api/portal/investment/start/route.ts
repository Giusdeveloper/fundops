import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const companyId = typeof body?.company_id === "string" ? body.company_id.trim() : "";
    if (!companyId) {
      return NextResponse.json({ error: "company_id mancante" }, { status: 400 });
    }
    if (!UUID_RE.test(companyId)) {
      return NextResponse.json({ error: "company_id non valido" }, { status: 400 });
    }

    const { data: investorUser, error: investorUserError } = await supabase
      .from("fundops_investor_users")
      .select("investor_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (investorUserError) {
      return NextResponse.json({ error: investorUserError.message }, { status: 500 });
    }

    const investorId = investorUser?.investor_id;
    if (!investorId) {
      return NextResponse.json({ error: "Investitore non trovato" }, { status: 403 });
    }

    const { data: account, error: accountError } = await supabase
      .from("fundops_investor_accounts")
      .select("id")
      .eq("company_id", companyId.trim())
      .eq("investor_id", investorId)
      .maybeSingle();

    if (accountError) {
      return NextResponse.json({ error: accountError.message }, { status: 500 });
    }

    if (!account) {
      return NextResponse.json({ error: "Account investitore non trovato" }, { status: 404 });
    }

    const { data: activeRound, error: roundError } = await supabase
      .from("fundops_rounds")
      .select("id,status")
      .eq("company_id", companyId)
      .eq("status", "active")
      .maybeSingle();

    if (roundError) {
      return NextResponse.json({ error: roundError.message }, { status: 500 });
    }

    if (!activeRound?.id) {
      return NextResponse.json(
        { error: "ROUND_CLOSED", message: "Round non attivo" },
        { status: 409 }
      );
    }

    const { data: investment, error: investmentError } = await supabase
      .from("fundops_investments")
      .upsert(
        {
          company_id: companyId,
          round_id: activeRound.id,
          investor_id: investorId,
        },
        { onConflict: "investor_id,round_id" }
      )
      .select("id,status")
      .single();

    if (investmentError || !investment?.id) {
      return NextResponse.json(
        { error: investmentError?.message ?? "Errore creazione investimento" },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("fundops_investor_accounts")
      .update({
        lifecycle_stage: "investing",
        investing_started_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, investment_id: investment.id, status: investment.status },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
