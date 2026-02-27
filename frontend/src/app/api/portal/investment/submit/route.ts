import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SubmitBody = {
  company_id?: string;
  investment_id?: string;
  amount_eur?: number;
  privacy_accepted?: boolean;
};

const REQUIRED_DOCUMENT_TYPES = [
  "investment_form",
  "bank_transfer_proof",
] as const;
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
      return jsonError("Non autenticato", 401, authError ? { detail: authError.message } : undefined);
    }

    const body = (await request.json().catch(() => null)) as SubmitBody | null;
    const companyId = body?.company_id?.trim();
    const investmentId = body?.investment_id?.trim();
    const amountEur = body?.amount_eur;
    const privacyAccepted = body?.privacy_accepted;

    if (!companyId) {
      return jsonError("company_id mancante", 400);
    }
    if (!investmentId) {
      return jsonError("investment_id mancante", 400);
    }
    if (!UUID_RE.test(companyId) || !UUID_RE.test(investmentId)) {
      return jsonError("company_id/investment_id non valido", 400);
    }

    if (typeof amountEur !== "number" || !Number.isFinite(amountEur) || amountEur <= 0) {
      return jsonError("amount_eur deve essere maggiore di 0", 400);
    }

    if (privacyAccepted !== true) {
      return jsonError("privacy_accepted deve essere true", 400);
    }

    const { data: investorUser, error: investorUserError } = await supabase
      .from("fundops_investor_users")
      .select("investor_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (investorUserError) {
      return jsonError("Errore lookup investitore", 500, {
        detail: investorUserError.message,
        code: investorUserError.code,
      });
    }

    const investorId = investorUser?.investor_id;
    if (!investorId) {
      return jsonError("Investitore non autorizzato", 403);
    }

    const { data: investment, error: investmentError } = await supabase
      .from("fundops_investments")
      .select("id, company_id, investor_id, status")
      .eq("id", investmentId)
      .eq("company_id", companyId)
      .eq("investor_id", investorId)
      .maybeSingle();

    if (investmentError) {
      return jsonError("Errore lookup investimento", 500, {
        detail: investmentError.message,
        code: investmentError.code,
      });
    }
    if (!investment) {
      return jsonError("Investimento non trovato", 404);
    }
    if (investment.status !== "draft" && investment.status !== "rejected") {
      return jsonError("Investimento non modificabile", 409);
    }

    const { data: company, error: companyError } = await supabase
      .from("fundops_companies")
      .select("id, phase")
      .eq("id", investment.company_id)
      .maybeSingle();

    if (companyError || !company) {
      return jsonError("Company non trovata", 404, companyError ? {
        detail: companyError.message,
        code: companyError.code,
      } : undefined);
    }
    if (company.phase !== "issuance" && company.phase !== "issuing") {
      return jsonError("Fase non valida: la company non è in issuance", 409);
    }

    const { data: docs, error: docsError } = await supabase
      .from("fundops_documents")
      .select("type")
      .eq("investment_id", investmentId)
      .eq("status", "active")
      .in("type", [...REQUIRED_DOCUMENT_TYPES]);

    if (docsError) {
      return jsonError("Errore verifica documenti", 500, {
        detail: docsError.message,
        code: docsError.code,
      });
    }

    const presentTypes = new Set((docs ?? []).map((doc) => doc.type));
    const missing = REQUIRED_DOCUMENT_TYPES.filter((type) => !presentTypes.has(type));
    if (missing.length > 0) {
      return jsonError("Documenti obbligatori mancanti", 400, {
        code: "missing_documents",
        missing,
      });
    }

    const nowIso = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from("fundops_investments")
      .update({
        amount_eur: amountEur,
        amount: amountEur,
        currency: "EUR",
        privacy_accepted: privacyAccepted,
        status: "submitted",
        submitted_at: nowIso,
      })
      .eq("id", investmentId)
      .eq("company_id", companyId)
      .eq("investor_id", investorId);

    if (upsertError) {
      return jsonError("Errore salvataggio submission", 500, {
        detail: upsertError.message,
        code: upsertError.code,
      });
    }

    return NextResponse.json({ ok: true, status: "submitted" }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto";
    return jsonError(message, 500);
  }
}
