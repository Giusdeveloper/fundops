"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";

export type InvestorCompanyCard = {
  companyId: string;
  companyName: string;
  publicSlug: string | null;
  phase: "booking" | "issuing" | "onboarding" | string;
  lifecycleStage: string;
  /** Stato investitore per display: Registrato, LOI firmata, ecc. */
  investorStatusLabel: string;
  /** true se LOI già firmata (signer signed o lifecycle loi_signed) */
  loiSigned: boolean;
  loiReceipt?: {
    id: string;
    title: string | null;
    filePath: string;
    createdAt: string;
  };
};

function mapLifecycleToStatusLabel(lifecycle: string, loiSignedAt: string | null): { label: string; loiSigned: boolean } {
  const signed = lifecycle === "loi_signed" || !!loiSignedAt;
  if (signed) return { label: "LOI firmata", loiSigned: true };
  if (lifecycle === "invested") return { label: "Investimento completato", loiSigned: true };
  if (lifecycle === "investing") return { label: "Investimento in corso", loiSigned: true };
  if (lifecycle === "registered" || lifecycle === "lead" || lifecycle === "active") return { label: "Registrato", loiSigned: false };
  return { label: lifecycle || "Registrato", loiSigned: false };
}

export type InvestorDashboardResult =
  | { ok: true; cards: InvestorCompanyCard[] }
  | { ok: false; reason: "not_logged_in" }
  | { ok: false; reason: "no_investor_profile"; message: string }
  | { ok: false; reason: "no_accounts"; message: string };

/**
 * Recupera dati per Investor Dashboard.
 * Usa supabaseServer per fundops per evitare RLS recursion.
 */
export async function getInvestorDashboardData(): Promise<InvestorDashboardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    return { ok: false, reason: "not_logged_in" };
  }

  if (!supabaseServer) {
    return {
      ok: false,
      reason: "no_investor_profile",
      message: "Configurazione server non disponibile",
    };
  }

  const { data: investorUser } = await supabaseServer
    .from("fundops_investor_users")
    .select("investor_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!investorUser?.investor_id) {
    return {
      ok: false,
      reason: "no_investor_profile",
      message: "Nessun profilo investitore collegato",
    };
  }

  const { data: accounts, error: accountsError } = await supabaseServer
    .from("fundops_investor_accounts")
    .select("id, company_id, lifecycle_stage, loi_signed_at, registered_at, created_at")
    .eq("investor_id", investorUser.investor_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (accountsError || !accounts?.length) {
    return {
      ok: false,
      reason: "no_accounts",
      message: "Nessun profilo investitore collegato",
    };
  }

  const companyIds = [...new Set(accounts.map((a) => a.company_id))];

  const { data: companies } = await supabaseServer
    .from("fundops_companies")
    .select("id, name, public_slug, phase")
    .in("id", companyIds);

  const { data: receipts } = await supabaseServer
    .from("fundops_documents")
    .select("id, title, file_path, created_at, company_id")
    .in("company_id", companyIds)
    .eq("investor_id", investorUser.investor_id)
    .eq("type", "loi_receipt")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));
  const latestReceiptByCompany = new Map<
    string,
    { id: string; title: string | null; file_path: string; created_at: string }
  >();

  for (const receipt of receipts ?? []) {
    if (!latestReceiptByCompany.has(receipt.company_id)) {
      latestReceiptByCompany.set(receipt.company_id, receipt);
    }
  }

  const cards: InvestorCompanyCard[] = [];

  for (const acc of accounts) {
    const company = companyMap.get(acc.company_id);
    const phase = (company?.phase ?? "booking") as string;
    const latestReceipt = latestReceiptByCompany.get(acc.company_id);
    const { label: investorStatusLabel, loiSigned } = mapLifecycleToStatusLabel(
      acc.lifecycle_stage ?? "active",
      acc.loi_signed_at ?? null
    );

    cards.push({
      companyId: acc.company_id,
      companyName: company?.name ?? "—",
      publicSlug: company?.public_slug ?? null,
      phase,
      lifecycleStage: acc.lifecycle_stage ?? "active",
      investorStatusLabel,
      loiSigned,
      loiReceipt: latestReceipt
        ? {
            id: latestReceipt.id,
            title: latestReceipt.title ?? null,
            filePath: latestReceipt.file_path,
            createdAt: latestReceipt.created_at,
          }
        : undefined,
    });
  }

  const phaseOrder = (p: string) => {
    if (p === "booking") return 0;
    if (p === "issuing" || p === "issuance") return 1;
    if (p === "onboarding") return 2;
    return 0;
  };

  cards.sort((a, b) => {
    if (a.loiSigned !== b.loiSigned) return a.loiSigned ? -1 : 1;
    const pa = phaseOrder(a.phase);
    const pb = phaseOrder(b.phase);
    if (pa !== pb) return pa - pb;
    return a.companyName.localeCompare(b.companyName, "it");
  });

  return { ok: true, cards };
}
