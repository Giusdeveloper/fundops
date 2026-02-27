import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const REQUIRED_DOC_TYPES = ["investment_form", "bank_transfer_proof"] as const;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra ?? {}) }, { status });
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return jsonError("Non autenticato", 401);
    }

    const body = (await request.json().catch(() => null)) as { companyId?: string } | null;
    const companyId = body?.companyId?.trim();
    if (!companyId || !UUID_RE.test(companyId)) {
      return jsonError("companyId non valido", 400);
    }

    const { data: investorUser, error: iuErr } = await supabase
      .from("fundops_investor_users")
      .select("investor_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (iuErr) return jsonError(iuErr.message, 500, { code: iuErr.code });
    if (!investorUser?.investor_id) return jsonError("Investitore non collegato", 403);
    const investorId = investorUser.investor_id;

    const { data: account, error: accErr } = await supabase
      .from("fundops_investor_accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("investor_id", investorId)
      .eq("is_active", true)
      .maybeSingle();
    if (accErr) return jsonError(accErr.message, 500, { code: accErr.code });
    if (!account) return jsonError("Account investitore non trovato per questa company", 403);

    const { data: activeRound } = await supabase
      .from("fundops_rounds")
      .select("id, status")
      .eq("company_id", companyId)
      .eq("status", "active")
      .maybeSingle();

    let investment:
      | {
          id: string;
          status: string | null;
          amount_eur: number | null;
          amount: number | null;
          privacy_accepted: boolean | null;
        }
      | null = null;

    if (activeRound?.id) {
      const { data } = await supabase
        .from("fundops_investments")
        .select("id,status,amount_eur,amount,privacy_accepted")
        .eq("company_id", companyId)
        .eq("investor_id", investorId)
        .eq("round_id", activeRound.id)
        .maybeSingle();
      investment = data ?? null;
    }

    if (!investment) {
      const { data: latest } = await supabase
        .from("fundops_investments")
        .select("id,status,amount_eur,amount,privacy_accepted,round_id,created_at")
        .eq("company_id", companyId)
        .eq("investor_id", investorId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest) {
        investment = latest;
      }
    }

    if (!investment) {
      if (!activeRound?.id) {
        return jsonError("Round non attivo", 409);
      }
      const { data: created, error: createErr } = await supabase
        .from("fundops_investments")
        .upsert(
          {
            company_id: companyId,
            round_id: activeRound.id,
            investor_id: investorId,
            status: "draft",
            amount_eur: 0,
            privacy_accepted: false,
          },
          { onConflict: "investor_id,round_id" }
        )
        .select("id,status,amount_eur,amount,privacy_accepted")
        .maybeSingle();
      if (createErr) return jsonError(createErr.message, 500, { code: createErr.code });
      investment = created ?? null;
    }

    if (!investment?.id) {
      return jsonError("Impossibile inizializzare investimento", 500);
    }

    const { data: docs, error: docsErr } = await supabase
      .from("fundops_documents")
      .select("id,type,status,created_at")
      .eq("investment_id", investment.id)
      .eq("status", "active")
      .in("type", [...REQUIRED_DOC_TYPES])
      .order("created_at", { ascending: false });
    if (docsErr) return jsonError(docsErr.message, 500, { code: docsErr.code });

    const hasInvestmentForm = (docs ?? []).some((d) => d.type === "investment_form");
    const hasBankTransferProof = (docs ?? []).some((d) => d.type === "bank_transfer_proof");

    return NextResponse.json(
      {
        investmentId: investment.id,
        status: investment.status,
        amount_eur: Number(investment.amount_eur ?? investment.amount ?? 0),
        privacy_accepted: Boolean(investment.privacy_accepted),
        documents: {
          investment_form: hasInvestmentForm,
          bank_transfer_proof: hasBankTransferProof,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto";
    return jsonError(message, 500);
  }
}
