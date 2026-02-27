import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const REQUIRED_DOC_TYPES = ["investment_form", "bank_transfer_proof"] as const;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra ?? {}) }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ investmentId: string }> }
) {
  try {
    const { investmentId } = await params;
    if (!investmentId || !UUID_RE.test(investmentId)) {
      return jsonError("investmentId non valido", 400);
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user?.id) return jsonError("Non autenticato", 401);

    const { data: investorUser, error: iuErr } = await supabase
      .from("fundops_investor_users")
      .select("investor_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (iuErr) return jsonError(iuErr.message, 500, { code: iuErr.code });
    if (!investorUser?.investor_id) return jsonError("Investitore non autorizzato", 403);
    const investorId = investorUser.investor_id;

    const { data: investment, error: invErr } = await supabase
      .from("fundops_investments")
      .select("id, company_id, investor_id, status, amount_eur, amount, privacy_accepted")
      .eq("id", investmentId)
      .eq("investor_id", investorId)
      .maybeSingle();
    if (invErr) return jsonError(invErr.message, 500, { code: invErr.code });
    if (!investment) return jsonError("Investimento non trovato", 404);
    if (investment.status !== "draft") return jsonError("Investimento non modificabile", 409);

    const amount = Number(investment.amount_eur ?? investment.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonError("Importo non valido", 400);
    }
    if (investment.privacy_accepted !== true) {
      return jsonError("Privacy non accettata", 400);
    }

    const { data: docs, error: docsErr } = await supabase
      .from("fundops_documents")
      .select("type")
      .eq("investment_id", investment.id)
      .eq("status", "active")
      .in("type", [...REQUIRED_DOC_TYPES]);
    if (docsErr) return jsonError(docsErr.message, 500, { code: docsErr.code });

    const present = new Set((docs ?? []).map((d) => d.type));
    const missing = REQUIRED_DOC_TYPES.filter((type) => !present.has(type));
    if (missing.length > 0) {
      return jsonError("Documenti mancanti", 400, { code: "missing_documents", missing });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabase
      .from("fundops_investments")
      .update({
        status: "submitted",
        submitted_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", investment.id)
      .eq("investor_id", investorId)
      .select("id,status,amount_eur,privacy_accepted,submitted_at,updated_at")
      .maybeSingle();
    if (updateErr) return jsonError(updateErr.message, 500, { code: updateErr.code });

    await supabase
      .from("fundops_investment_events")
      .insert({
        investment_id: investment.id,
        company_id: investment.company_id,
        event_type: "status_changed",
        event_data: {
          from_status: investment.status,
          to_status: "submitted",
          note: "submitted by investor",
        },
        created_by: user.id,
      });

    return NextResponse.json({ ok: true, investment: updated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto";
    return jsonError(message, 500);
  }
}
