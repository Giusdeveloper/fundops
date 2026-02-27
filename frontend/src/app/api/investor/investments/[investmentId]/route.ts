import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra ?? {}) }, { status });
}

export async function PATCH(
  request: Request,
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

    const body = (await request.json().catch(() => null)) as
      | { amount_eur?: number; privacy_accepted?: boolean }
      | null;

    const patch: Record<string, unknown> = {};
    if (body && Object.prototype.hasOwnProperty.call(body, "amount_eur")) {
      const amount = body.amount_eur;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
        return jsonError("amount_eur deve essere >= 0", 400);
      }
      patch.amount_eur = amount;
      patch.amount = amount;
    }
    if (body && Object.prototype.hasOwnProperty.call(body, "privacy_accepted")) {
      if (typeof body.privacy_accepted !== "boolean") {
        return jsonError("privacy_accepted deve essere boolean", 400);
      }
      patch.privacy_accepted = body.privacy_accepted;
    }

    if (Object.keys(patch).length === 0) {
      return jsonError("Nessun campo da aggiornare", 400);
    }

    const { data: investment, error: invErr } = await supabase
      .from("fundops_investments")
      .select("id, investor_id, status, amount_eur, amount, privacy_accepted")
      .eq("id", investmentId)
      .eq("investor_id", investorUser.investor_id)
      .maybeSingle();
    if (invErr) return jsonError(invErr.message, 500, { code: invErr.code });
    if (!investment) return jsonError("Investimento non trovato", 404);
    if (investment.status !== "draft") return jsonError("Investimento non modificabile", 409);

    const { data: updated, error: updateErr } = await supabase
      .from("fundops_investments")
      .update(patch)
      .eq("id", investmentId)
      .eq("investor_id", investorUser.investor_id)
      .select("id,status,amount_eur,amount,privacy_accepted")
      .maybeSingle();
    if (updateErr) return jsonError(updateErr.message, 500, { code: updateErr.code });

    const { data: docs } = await supabase
      .from("fundops_documents")
      .select("type")
      .eq("investment_id", investmentId)
      .eq("status", "active")
      .in("type", ["investment_form", "bank_transfer_proof"]);

    return NextResponse.json(
      {
        investment: {
          id: updated?.id ?? investmentId,
          status: updated?.status ?? investment.status,
          amount_eur: Number(updated?.amount_eur ?? updated?.amount ?? 0),
          privacy_accepted: Boolean(updated?.privacy_accepted),
        },
        documents: {
          investment_form: (docs ?? []).some((d) => d.type === "investment_form"),
          bank_transfer_proof: (docs ?? []).some((d) => d.type === "bank_transfer_proof"),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto";
    return jsonError(message, 500);
  }
}
