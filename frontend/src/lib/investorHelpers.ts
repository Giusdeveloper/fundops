"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";

export interface InvestorCompanyCard {
  company_id: string;
  name: string;
  public_slug: string | null;
  phase: string | null;
  lifecycle_stage: string | null;
  receipt_document_id: string | null;
}

export interface InvestorAccountResult {
  investorId: string | null;
  accounts: InvestorCompanyCard[];
}

/**
 * Recupera account investitore attivi per l'utente (auth.uid).
 * Usa supabaseServer per fundops per evitare RLS recursion.
 */
export async function getInvestorAccountsForUser(): Promise<InvestorAccountResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return { investorId: null, accounts: [] };
  }

  if (!supabaseServer) {
    return { investorId: null, accounts: [] };
  }

  const { data: investorUser } = await supabaseServer
    .from("fundops_investor_users")
    .select("investor_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!investorUser?.investor_id) {
    return { investorId: null, accounts: [] };
  }

  const { data: accounts } = await supabaseServer
    .from("fundops_investor_accounts")
    .select("company_id, lifecycle_stage")
    .eq("investor_id", investorUser.investor_id)
    .eq("is_active", true);

  if (!accounts?.length) {
    return { investorId: investorUser.investor_id, accounts: [] };
  }

  const companyIds = [...new Set(accounts.map((a) => a.company_id))];
  const { data: companies } = await supabaseServer
    .from("fundops_companies")
    .select("id, name, public_slug, phase")
    .in("id", companyIds);

  const { data: docs } = await supabaseServer
    .from("fundops_documents")
    .select("id, company_id, type, investor_id")
    .in("company_id", companyIds)
    .eq("status", "active")
    .eq("type", "loi_receipt")
    .eq("investor_id", investorUser.investor_id);

  const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));
  const receiptByCompany = new Map<string, string>();
  for (const d of docs ?? []) {
    receiptByCompany.set(d.company_id, d.id);
  }

  const cards: InvestorCompanyCard[] = accounts.map((a) => {
    const company = companyMap.get(a.company_id);
    return {
      company_id: a.company_id,
      name: company?.name ?? "—",
      public_slug: company?.public_slug ?? null,
      phase: company?.phase ?? null,
      lifecycle_stage: a.lifecycle_stage ?? null,
      receipt_document_id: receiptByCompany.get(a.company_id) ?? null,
    };
  });

  return { investorId: investorUser.investor_id, accounts: cards };
}

/**
 * Verifica se l'utente ha almeno un account attivo.
 */
export async function hasActiveInvestorAccounts(): Promise<boolean> {
  const { accounts } = await getInvestorAccountsForUser();
  return accounts.length > 0;
}

/**
 * Recupera l'ultimo attestazione disponibile (loi_receipt) per qualunque company dell'investitore.
 */
export async function getLatestReceiptDocumentId(): Promise<string | null> {
  const { accounts } = await getInvestorAccountsForUser();
  return accounts.find((a) => a.receipt_document_id)?.receipt_document_id ?? null;
}
