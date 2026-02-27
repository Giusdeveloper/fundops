import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InvestmentRow = {
  id: string;
  company_id: string;
  investor_id: string | null;
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "verified";
  amount_eur?: number | null;
  amount?: number | null;
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
};

type InvestorRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type DocRow = {
  investment_id: string | null;
  type: string;
};

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId")?.trim();
    if (!companyId) return json(400, { error: "Missing companyId" });

    // 1) Auth utente (client session-based)
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return json(401, { error: "Unauthorized" });
    const userId = authData.user.id;

    // 2) Authorization applicativa via service role (evita ricorsioni RLS)
    const admin = createSupabaseAdmin();

    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("role_global,is_active")
      .eq("id", userId)
      .maybeSingle();
    if (profErr) {
      console.error("[issuance] profile check error", { companyId, userId, profErr });
      return json(500, { error: "Failed to load profile", code: profErr.code ?? null });
    }

    if (profile?.is_active === false) return json(403, { error: "Forbidden" });

    const roleGlobal = profile?.role_global ?? null;
    let allowed = roleGlobal === "imment_admin" || roleGlobal === "imment_operator";

    if (!allowed) {
      const { data: companyUser, error: companyUserErr } = await admin
        .from("fundops_company_users")
        .select("id, role")
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (companyUserErr) {
        console.error("[issuance] company role check error", {
          companyId,
          userId,
          companyUserErr,
        });
        return json(500, { error: "Failed to check company role", code: companyUserErr.code ?? null });
      }
      allowed = !!companyUser;
    }

    if (!allowed) return json(403, { error: "Forbidden" });

    // 3) Data via SERVICE ROLE (no RLS recursion)
    const { data: investmentsData, error: invErr } = await admin
      .from("fundops_investments")
      .select("*")
      .eq("company_id", companyId)
      .in("status", ["draft", "submitted", "under_review", "approved", "rejected"])
      .order("created_at", { ascending: false });

    if (invErr) {
      console.error("[issuance] investments query error", invErr);
      return json(500, { error: invErr.message, code: invErr.code ?? null });
    }

    const investments = (investmentsData ?? []) as InvestmentRow[];
    const investorIds = Array.from(
      new Set(investments.map((item) => item.investor_id).filter(Boolean))
    ) as string[];

    const investorsMap = new Map<string, InvestorRow>();
    if (investorIds.length > 0) {
      const { data: investorsData, error: investorsErr } = await admin
        .from("fundops_investors")
        .select("id, full_name, email")
        .in("id", investorIds);

      if (investorsErr) {
        console.error("[issuance] investors query error", investorsErr);
        return json(500, { error: investorsErr.message, code: investorsErr.code ?? null });
      }

      for (const inv of (investorsData ?? []) as InvestorRow[]) {
        investorsMap.set(inv.id, inv);
      }
    }

    const investmentIds = investments.map((item) => item.id);
    const docsMap = new Map<string, Set<string>>();
    if (investmentIds.length > 0) {
      const { data: docsData, error: docsErr } = await admin
        .from("fundops_documents")
        .select("investment_id, type")
        .in("investment_id", investmentIds)
        .in("type", ["investment_form", "bank_transfer_proof", "bank_transfer_receipt"])
        .eq("status", "active");

      if (docsErr) {
        console.error("[issuance] docs query error", docsErr);
        return json(500, { error: docsErr.message, code: docsErr.code ?? null });
      }

      for (const doc of (docsData ?? []) as DocRow[]) {
        if (!doc.investment_id) continue;
        if (!docsMap.has(doc.investment_id)) docsMap.set(doc.investment_id, new Set<string>());
        docsMap.get(doc.investment_id)?.add(doc.type);
      }
    }

    const draft = investments.filter((item) => item.status === "draft");
    const submitted = investments.filter((item) => item.status === "submitted");
    const underReview = investments.filter((item) => item.status === "under_review");
    const approved = investments.filter((item) => item.status === "approved" || item.status === "verified");
    const pendingReview = investments.filter(
      (item) => item.status === "submitted" || item.status === "under_review"
    );
    const totalSubmittedAmountEur = submitted.reduce(
      (sum, item) => sum + Number(item.amount_eur ?? item.amount ?? 0),
      0
    );
    const approvedTotalAmount = approved.reduce(
      (sum, item) => sum + Number(item.amount_eur ?? item.amount ?? 0),
      0
    );

    const rows = investments.map((item) => {
      const investor = item.investor_id ? investorsMap.get(item.investor_id) : null;
      const docs = docsMap.get(item.id) ?? new Set<string>();
      return {
        id: item.id,
        company_id: item.company_id,
        investor_id: item.investor_id,
        investor_name: investor?.full_name ?? null,
        investor_email: investor?.email ?? null,
        status: item.status,
        amount_eur: Number(item.amount_eur ?? item.amount ?? 0),
        submitted_at: item.submitted_at ?? null,
        created_at: item.created_at,
        updated_at: item.updated_at,
        docs: {
          has_investment_form: docs.has("investment_form"),
          has_bank_transfer_proof:
            docs.has("bank_transfer_proof") || docs.has("bank_transfer_receipt"),
        },
      };
    });

    return json(200, {
      kpis: {
        draftCount: draft.length,
        submittedCount: submitted.length,
        totalSubmittedAmountEur,
        pending_review_count: pendingReview.length,
        approved_count: approved.length,
        approved_total_amount: approvedTotalAmount,
        under_review_count: underReview.length,
        // compat shape attuale UI
        draft: draft.length,
        submitted: submitted.length,
        submitted_amount_total: totalSubmittedAmountEur,
      },
      investments: rows,
    });
  } catch (e) {
    console.error("[issuance] fatal", e);
    return json(500, { error: "Internal Server Error" });
  }
}
