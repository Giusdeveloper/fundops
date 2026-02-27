"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  fetchCompanyBySlug,
  getLoiActiveSentForCompany,
  type PortalLoi,
} from "@/lib/portalHelpers";
import { checkInvestorPortalAccess } from "@/lib/portalEnsureInvestor";

export interface PortalContext {
  company: { id: string; name: string; legal_name: string; public_slug: string | null; phase: string | null } | null;
  investor_id: string | null;
  investor_account: { id: string; lifecycle_stage: string | null } | null;
  loi: PortalLoi | null;
  signer: { id: string; status: string; soft_commitment_at: string | null } | null;
  can_sign: boolean;
  already_signed: boolean;
  profile_full_name: string | null;
  receipt_document_id: string | null;
  /** Se true: campagna non pronta (nessuna LOI sent) */
  campaign_not_ready: boolean;
  phase: "booking" | "issuance" | "onboarding";
  lifecycle_stage: string | null;
  loi_signed_at: string | null;
  loi_signed_name: string | null;
  active_round: {
    id: string;
    status: string;
    deadline_at: string | null;
    target_amount: number | null;
    min_ticket_amount: number | null;
  } | null;
  has_notary_deed: boolean;
  has_investment_form: boolean;
  has_wire_proof: boolean;
  has_investment_form_signed: boolean;
  has_bank_transfer_proof: boolean;
  is_round_closed: boolean;
}

/** Oggetto errore Supabase serializzabile */
export interface SupabaseErrorObj {
  message: string;
  code: string;
  details?: string;
  hint?: string;
}

export interface PortalDebugInfo {
  step: string;
  slug: string;
  company: { id: string; public_slug: string | null; phase: string | null } | null;
  user: { id: string; email: string | null } | null;
  rpc: { ok: boolean; error: SupabaseErrorObj | null };
  investor_user: { user_id: string; investor_id: string } | null;
  investor_account: { id: string; company_id: string; investor_id: string; lifecycle_stage: string | null } | null;
  master_loi: { id: string; status: string; is_master: boolean } | null;
  signer: { id: string; status: string; loi_id: string; investor_id: string } | null;
  errors: SupabaseErrorObj[];
}

export type PortalResult =
  | { ok: true; ctx: PortalContext }
  | { ok: false; debug: PortalDebugInfo };

function toErrorObj(e: PostgrestError | Error | null): SupabaseErrorObj | null {
  if (!e) return null;
  const err = e as PostgrestError & { details?: string; hint?: string };
  return {
    message: err.message ?? String(e),
    code: err.code ?? "",
    details: err.details ?? undefined,
    hint: err.hint ?? undefined,
  };
}

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
  active_round: null,
  has_notary_deed: false,
  has_investment_form: false,
  has_wire_proof: false,
  has_investment_form_signed: false,
  has_bank_transfer_proof: false,
  is_round_closed: false,
};

function normalizeCompanyPhase(phaseRaw: string | null | undefined): "booking" | "issuance" | "onboarding" {
  const p = (phaseRaw ?? "").toLowerCase();
  if (p === "issuance" || p === "issuing") return "issuance";
  if (p === "onboarding") return "onboarding";
  return "booking";
}

function isStackDepthError(error: SupabaseErrorObj | null): boolean {
  return error?.code === "54001" || /stack depth limit exceeded/i.test(error?.message ?? "");
}

/**
 * Contesto completo per il portal investitore.
 * Usa sessione auth server-side per evitare fallimenti RLS.
 * Regola LOI: preferisci (is_master=true AND status='sent'), fallback (status='sent' ORDER BY updated_at DESC).
 *
 * @param slug - public_slug della company
 * @param options - { debug: true } per non usare notFound e ritornare debug dettagliato
 */
export async function getPortalContext(
  slug: string,
  options?: { debug?: boolean }
): Promise<PortalContext | PortalResult> {
  const debug = options?.debug ?? false;
  const errors: SupabaseErrorObj[] = [];

  const supabase = await createSupabaseServerClient();
  const supabaseData = supabaseServer;

  // 1) Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const authErrObj = toErrorObj(authError as PostgrestError | null);
  if (authErrObj) errors.push(authErrObj);

  if (!user?.id) {
    if (debug) {
      const authErrorForRpc = authErrObj ?? { message: "Utente non autenticato", code: "NO_USER" };
      return {
        ok: false,
        debug: {
          step: "auth",
          slug,
          company: null,
          user: null,
          rpc: { ok: false, error: authErrorForRpc },
          investor_user: null,
          investor_account: null,
          master_loi: null,
          signer: null,
          errors,
        },
      };
    }
    return empty;
  }

  if (!supabaseData) {
    if (debug) {
      return {
        ok: false,
        debug: {
          step: "auth",
          slug,
          company: null,
          user: { id: user.id, email: user.email ?? null },
          rpc: { ok: false, error: { message: "supabaseServer non configurato", code: "CONFIG" } },
          investor_user: null,
          investor_account: null,
          master_loi: null,
          signer: null,
          errors,
        },
      };
    }
    return empty;
  }

  // 2) Company
  type CompanyRow = { id: string; name: string; legal_name: string; public_slug: string | null; phase: string | null };
  let company: CompanyRow | null;
  if (debug) {
    const { data: companyData, error: companyError } = await supabaseData
      .from("fundops_companies")
      .select("id, name, legal_name, public_slug, phase")
      .eq("public_slug", slug)
      .maybeSingle();
    const companyErrObj = toErrorObj(companyError as PostgrestError | null);
    if (companyErrObj) errors.push(companyErrObj);
    company = companyData as CompanyRow | null;
  } else {
    company = await fetchCompanyBySlug(supabaseData, slug);
  }
  if (!company) {
    if (debug) {
      return {
        ok: false,
        debug: {
          step: "company",
          slug,
          company: null,
          user: { id: user.id, email: user.email ?? null },
          rpc: { ok: true, error: null },
          investor_user: null,
          investor_account: null,
          master_loi: null,
          signer: null,
          errors,
        },
      };
    }
    return empty;
  }

  // 3) investor_user
  const { data: iu, error: iuError } = await supabase
    .from("fundops_investor_users")
    .select("user_id, investor_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const iuErrObj = toErrorObj(iuError as PostgrestError | null);
  if (iuErrObj) errors.push(iuErrObj);

  let investorId = iu?.investor_id ?? null;
  let resolvedInvestorUser:
    | { user_id: string; investor_id: string }
    | null = iu?.investor_id
      ? { user_id: iu.user_id ?? user.id, investor_id: iu.investor_id }
      : null;

  if (!investorId) {
    const { hasAccess, error: rpcError } = await checkInvestorPortalAccess(supabase, company.id);
    const rpcErrObj = toErrorObj(rpcError as PostgrestError | null);
    if (rpcErrObj) errors.push(rpcErrObj);

    if (hasAccess) {
      const { data: iu2, error: iu2Error } = await supabase
        .from("fundops_investor_users")
        .select("user_id, investor_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const iu2ErrObj = toErrorObj(iu2Error as PostgrestError | null);
      if (iu2ErrObj) errors.push(iu2ErrObj);
      investorId = iu2?.investor_id ?? null;
    }

    // Fallback esplicito e controllato:
    // in caso di recursion RLS/RPC (54001), risolviamo investor link via supabaseServer
    // filtrando rigidamente per user_id autenticato e company corrente.
    if (!investorId && (isStackDepthError(iuErrObj) || isStackDepthError(rpcErrObj))) {
      const { data: iuSrv, error: iuSrvErr } = await supabaseData
        .from("fundops_investor_users")
        .select("user_id, investor_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const iuSrvErrObj = toErrorObj(iuSrvErr as PostgrestError | null);
      if (iuSrvErrObj) errors.push(iuSrvErrObj);

      if (iuSrv?.investor_id) {
        const { data: accountSrv, error: accountSrvErr } = await supabaseData
          .from("fundops_investor_accounts")
          .select("id")
          .eq("investor_id", iuSrv.investor_id)
          .eq("company_id", company.id)
          .maybeSingle();
        const accountSrvErrObj = toErrorObj(accountSrvErr as PostgrestError | null);
        if (accountSrvErrObj) errors.push(accountSrvErrObj);

      if (accountSrv?.id) {
        investorId = iuSrv.investor_id;
        resolvedInvestorUser = {
          user_id: iuSrv.user_id ?? user.id,
          investor_id: iuSrv.investor_id,
        };
      }
    }
    }

    if (debug && !investorId) {
      return {
        ok: false,
        debug: {
          step: "investor_user",
          slug,
          company: { id: company.id, public_slug: company.public_slug, phase: company.phase },
          user: { id: user.id, email: user.email ?? null },
          rpc: { ok: !rpcErrObj, error: rpcErrObj ?? null },
          investor_user: resolvedInvestorUser,
          investor_account: null,
          master_loi: null,
          signer: null,
          errors,
        },
      };
    }
  }

  if (!investorId) {
    return { ...empty, company };
  }

  // 4) investor_account
  const { data: accountRaw, error: accountError } = await supabase
    .from("fundops_investor_accounts")
    .select("id, company_id, investor_id, lifecycle_stage")
    .eq("investor_id", investorId)
    .eq("company_id", company.id)
    .maybeSingle();
  const accountErrObj = toErrorObj(accountError as PostgrestError | null);
  if (accountErrObj) errors.push(accountErrObj);
  let account = accountRaw;

  // Fallback su recursion RLS anche per account lookup.
  if (!account && isStackDepthError(accountErrObj)) {
    const { data: accountSrv, error: accountSrvErr } = await supabaseData
      .from("fundops_investor_accounts")
      .select("id, company_id, investor_id, lifecycle_stage")
      .eq("investor_id", investorId)
      .eq("company_id", company.id)
      .maybeSingle();
    const accountSrvErrObj = toErrorObj(accountSrvErr as PostgrestError | null);
    if (accountSrvErrObj) errors.push(accountSrvErrObj);
    account = accountSrv ?? null;
  }

  if (!account) {
    if (debug) {
      return {
        ok: false,
        debug: {
          step: "account",
          slug,
          company: { id: company.id, public_slug: company.public_slug, phase: company.phase },
          user: { id: user.id, email: user.email ?? null },
          rpc: { ok: true, error: null },
          investor_user: resolvedInvestorUser,
          investor_account: null,
          master_loi: null,
          signer: null,
          errors,
        },
      };
    }
    return { ...empty, company };
  }

  const { data: activeRound, error: activeRoundErr } = await supabase
    .from("fundops_rounds")
    .select("id,status,deadline_at,target_amount,min_ticket_amount")
    .eq("company_id", company.id)
    .eq("status", "active")
    .maybeSingle();

  if (activeRoundErr) {
    errors.push({ message: activeRoundErr.message, code: activeRoundErr.code });
  }

  const isRoundClosed = !activeRound;
  const normalizedCompanyPhase = normalizeCompanyPhase(company.phase);

  // 5) master_loi - usa solo getLoiActiveSentForCompany (= getLoiMasterSentForCompany)
  const { data: loi, error: loiError } = await getLoiActiveSentForCompany(supabaseData, company.id);
  if (loiError) errors.push(loiError);

  const masterLoiForDebug: { id: string; status: string; is_master: boolean } | null = loi
    ? { id: loi.id, status: loi.status ?? "sent", is_master: !!loi.is_master }
    : null;

  if (!loi) {
    if (debug) {
      return {
        ok: false,
        debug: {
          step: "master_loi",
          slug,
          company: { id: company.id, public_slug: company.public_slug, phase: company.phase },
          user: { id: user.id, email: user.email ?? null },
          rpc: { ok: true, error: null },
          investor_user: resolvedInvestorUser,
          investor_account: {
            id: account.id,
            company_id: account.company_id,
            investor_id: account.investor_id,
            lifecycle_stage: account.lifecycle_stage,
          },
          master_loi: null,
          signer: null,
          errors,
        },
      };
    }
    return {
      ...empty,
      company,
      investor_id: investorId,
      investor_account: { id: account.id, lifecycle_stage: account.lifecycle_stage },
      campaign_not_ready: true,
      phase: normalizedCompanyPhase,
      lifecycle_stage: account.lifecycle_stage,
      loi_signed_at: null,
      loi_signed_name: null,
      active_round: activeRound ?? null,
      has_notary_deed: false,
      has_investment_form: false,
      has_wire_proof: false,
      has_investment_form_signed: false,
      has_bank_transfer_proof: false,
      is_round_closed: isRoundClosed,
    };
  }

  // 6) signer
  const { data: signer, error: signerError } = await supabaseData
    .from("fundops_loi_signers")
    .select("id, status, loi_id, investor_id, soft_commitment_at")
    .eq("loi_id", loi.id)
    .eq("investor_id", investorId)
    .maybeSingle();
  const signerErrObj = toErrorObj(signerError as PostgrestError | null);
  if (signerErrObj) errors.push(signerErrObj);

  const phase = normalizedCompanyPhase;
  const alreadySigned =
    !!signer && (signer.status === "signed" || !!signer.soft_commitment_at);
  const canSign = !alreadySigned && !!account && !isRoundClosed;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  let receiptDocumentId: string | null = null;
  let hasNotaryDeed = false;
  let hasInvestmentForm = false;
  let hasWireProof = false;
  let hasInvestmentFormSigned = false;
  let hasBankTransferProof = false;
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
    if (d.type === "investment_form_signed" && d.investor_id === investorId) hasInvestmentFormSigned = true;
    if (d.type === "bank_transfer_proof" && d.investor_id === investorId) hasBankTransferProof = true;
  }

  const { data: acct } = await supabaseData
    .from("fundops_investor_accounts")
    .select("lifecycle_stage, loi_signed_at, loi_signed_name")
    .eq("investor_id", investorId)
    .eq("company_id", company.id)
    .maybeSingle();

  const loiSignedAt = signer?.soft_commitment_at ?? acct?.loi_signed_at ?? null;
  const loiSignedName = acct?.loi_signed_name ?? null;

  const ctx: PortalContext = {
    company,
    investor_id: investorId,
    investor_account: { id: account.id, lifecycle_stage: account.lifecycle_stage },
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
    active_round: activeRound ?? null,
    has_notary_deed: hasNotaryDeed,
    has_investment_form: hasInvestmentForm,
    has_wire_proof: hasWireProof,
    has_investment_form_signed: hasInvestmentFormSigned,
    has_bank_transfer_proof: hasBankTransferProof,
    is_round_closed: isRoundClosed,
  };

  if (debug) {
    return { ok: true, ctx };
  }

  return ctx;
}
