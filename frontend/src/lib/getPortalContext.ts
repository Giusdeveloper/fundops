"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  fetchCompanyBySlug,
  getLoiActiveSentForCompany,
  getPhaseForCompany,
} from "@/lib/portalHelpers";
import { checkInvestorPortalAccess } from "@/lib/portalEnsureInvestor";

export interface PortalContext {
  company: { id: string; name: string; legal_name: string; public_slug: string | null; phase: string | null } | null;
  investor_id: string | null;
  investor_account: { id: string; lifecycle_stage: string | null } | null;
  loi: { id: string; title?: string } | null;
  signer: { id: string; status: string; soft_commitment_at: string | null } | null;
  can_sign: boolean;
  already_signed: boolean;
  profile_full_name: string | null;
  receipt_document_id: string | null;
  /** Se true: campagna non pronta (nessuna LOI sent) */
  campaign_not_ready: boolean;
  phase: "booking" | "issuing" | "onboarding";
  lifecycle_stage: string | null;
  loi_signed_at: string | null;
  loi_signed_name: string | null;
  has_notary_deed: boolean;
  has_investment_form: boolean;
  has_wire_proof: boolean;
}

/**
 * Contesto completo per il portal investitore.
 * Usa sessione auth server-side per evitare fallimenti RLS.
 * Regola LOI: preferisci (is_master=true AND status='sent'), fallback (status='sent' ORDER BY updated_at DESC).
 */
export async function getPortalContext(slug: string): Promise<PortalContext> {
  const supabase = await createClient();
  const supabaseData = supabaseServer;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const empty: PortalContext = {
    company: null,
    investor_id: null,
    investor_account: null,
    loi: null,
    signer: null,
    can_sign: false,
    already_signed: false,
    profile_full_name: null,
    receipt_document_id: null,
    campaign_not_ready: false,
    phase: "booking",
    lifecycle_stage: null,
    loi_signed_at: null,
    loi_signed_name: null,
    has_notary_deed: false,
    has_investment_form: false,
    has_wire_proof: false,
  };

  if (!user?.id) {
    return empty;
  }

  if (!supabaseData) {
    console.error("[getPortalContext] Configurazione server mancante");
    return empty;
  }

  // 1) Risolvi company via public_slug (no RLS, no company_users)
  const company = await fetchCompanyBySlug(supabaseData, slug);
  if (!company) {
    return empty;
  }

  // 2) investor_id da fundops_investor_users (crea link se manca, via invite flow)
  let { data: iu } = await supabase
    .from("fundops_investor_users")
    .select("investor_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!iu?.investor_id) {
    const { hasAccess } = await checkInvestorPortalAccess(supabase, company.id);
    if (hasAccess) {
      const { data: iu2 } = await supabase
        .from("fundops_investor_users")
        .select("investor_id")
        .eq("user_id", user.id)
        .maybeSingle();
      iu = iu2;
    }
  }
  const investorId = iu?.investor_id ?? null;

  if (!investorId) {
    return { ...empty, company };
  }

  // 3) Verifica investor_account su quella company
  const { data: account } = await supabase
    .from("fundops_investor_accounts")
    .select("id, lifecycle_stage")
    .eq("investor_id", investorId)
    .eq("company_id", company.id)
    .maybeSingle();

  if (!account) {
    return { ...empty, company };
  }

  const loi = await getLoiActiveSentForCompany(supabaseData, company.id);
  const phase = await getPhaseForCompany(supabaseData, company.id);
  if (!loi) {
    let hasNotaryDeed = false;
    let hasInvestmentForm = false;
    let hasWireProof = false;
    const { data: docs } = await supabaseData
      .from("fundops_documents")
      .select("id, type, investor_id")
      .eq("company_id", company.id)
      .eq("status", "active");
    for (const d of docs ?? []) {
      if (d.type === "notary_deed" && !d.investor_id) hasNotaryDeed = true;
      if (d.type === "investment_form" && d.investor_id === investorId) hasInvestmentForm = true;
      if (d.type === "wire_proof" && d.investor_id === investorId) hasWireProof = true;
    }
    const { data: acct } = await supabaseData
      .from("fundops_investor_accounts")
      .select("lifecycle_stage, loi_signed_at, loi_signed_name")
      .eq("investor_id", investorId)
      .eq("company_id", company.id)
      .maybeSingle();
    return {
      ...empty,
      company,
      investor_id: investorId,
      investor_account: account ? { id: account.id, lifecycle_stage: account.lifecycle_stage } : null,
      campaign_not_ready: true,
      phase,
      lifecycle_stage: acct?.lifecycle_stage ?? null,
      loi_signed_at: acct?.loi_signed_at ?? null,
      loi_signed_name: acct?.loi_signed_name ?? null,
      has_notary_deed: hasNotaryDeed,
      has_investment_form: hasInvestmentForm,
      has_wire_proof: hasWireProof,
    };
  }

  const { data: signer } = await supabaseData
    .from("fundops_loi_signers")
    .select("id, status, soft_commitment_at")
    .eq("loi_id", loi.id)
    .eq("investor_id", investorId)
    .maybeSingle();

  const alreadySigned =
    !!signer && (signer.status === "signed" || !!signer.soft_commitment_at);
  const canSign = !alreadySigned && !!account;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  let receiptDocumentId: string | null = null;
  let hasNotaryDeed = false;
  let hasInvestmentForm = false;
  let hasWireProof = false;
  const { data: docs } = await supabaseData
    .from("fundops_documents")
    .select("id, type, investor_id")
    .eq("company_id", company.id)
    .eq("status", "active");
  for (const d of docs ?? []) {
    if (d.type === "loi_receipt" && d.investor_id === investorId) receiptDocumentId = d.id;
    if (d.type === "notary_deed" && !d.investor_id) hasNotaryDeed = true;
    if (d.type === "investment_form" && d.investor_id === investorId) hasInvestmentForm = true;
    if (d.type === "wire_proof" && d.investor_id === investorId) hasWireProof = true;
  }

  const { data: acct } = await supabaseData
    .from("fundops_investor_accounts")
    .select("lifecycle_stage, loi_signed_at, loi_signed_name")
    .eq("investor_id", investorId)
    .eq("company_id", company.id)
    .maybeSingle();

  const loiSignedAt = signer?.soft_commitment_at ?? acct?.loi_signed_at ?? null;
  const loiSignedName = acct?.loi_signed_name ?? null;

  return {
    company,
    investor_id: investorId,
    investor_account: account ? { id: account.id, lifecycle_stage: account.lifecycle_stage } : null,
    loi,
    signer: signer ? { id: signer.id, status: signer.status, soft_commitment_at: signer.soft_commitment_at } : null,
    can_sign: canSign,
    already_signed: alreadySigned,
    profile_full_name: profile?.full_name ?? null,
    receipt_document_id: receiptDocumentId,
    campaign_not_ready: false,
    phase,
    lifecycle_stage: acct?.lifecycle_stage ?? null,
    loi_signed_at: loiSignedAt,
    loi_signed_name: loiSignedName,
    has_notary_deed: hasNotaryDeed,
    has_investment_form: hasInvestmentForm,
    has_wire_proof: hasWireProof,
  };
}
