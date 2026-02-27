import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  fetchCompanyBySlug,
  hasSignedLoiForCompany,
  getLoiActiveSentForCompany,
} from "@/lib/portalHelpers";

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const supabase = supabaseServer;
  const supabaseAuth = await createSupabaseServerClient();

  if (!supabase) {
    return err("Configurazione server mancante", 500);
  }

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user?.id) {
    return err("Non autenticato", 401);
  }

  const slug = request.nextUrl.searchParams.get("slug");
  const investmentId = request.nextUrl.searchParams.get("investmentId")?.trim() ?? null;
  if (!slug) {
    return err("slug è richiesto", 400);
  }
  if (investmentId && !UUID_RE.test(investmentId)) {
    return err("investmentId non valido", 400);
  }

  const company = await fetchCompanyBySlug(supabase, slug);
  if (!company) {
    return err("Company non trovata", 404);
  }

  const phaseRaw = (company.phase ?? "").toLowerCase();
  const phase =
    phaseRaw === "issuance" || phaseRaw === "issuing"
      ? "issuance"
      : phaseRaw === "onboarding"
      ? "onboarding"
      : "booking";
  const hasSignedLoi = await hasSignedLoiForCompany(supabase, company.id);

  if ((phase === "issuance" || phase === "onboarding") && !hasSignedLoi) {
    return err(
      "LOI non ancora firmata. Completa la firma della LOI per procedere.",
      403
    );
  }

  const { data: profile } = await supabaseAuth
    .from("profiles")
    .select("role_global, is_active, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_active === false) {
    return err("Accesso disabilitato", 403);
  }

  const profileFullName = profile?.full_name ?? null;

  const { data: iu } = await supabaseAuth
    .from("fundops_investor_users")
    .select("investor_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const investorId = iu?.investor_id ?? null;

  let lifecycleStage: string | null = null;
  let loiSignedAt: string | null = null;
  let loiSignedName: string | null = null;
  if (investorId) {
    const { data: acct } = await supabase
      .from("fundops_investor_accounts")
      .select("lifecycle_stage, loi_signed_at, loi_signed_name")
      .eq("investor_id", investorId)
      .eq("company_id", company.id)
      .maybeSingle();
    lifecycleStage = acct?.lifecycle_stage ?? null;
    loiSignedAt = acct?.loi_signed_at ?? null;
    loiSignedName = acct?.loi_signed_name ?? null;
  }

  const { data: loiActiveSent } = await getLoiActiveSentForCompany(supabase, company.id);
  const hasLoiMaster = !!loiActiveSent;
  let hasSigner = false;
  if (investorId && loiActiveSent) {
    const { data: signer } = await supabase
      .from("fundops_loi_signers")
      .select("id")
      .eq("loi_id", loiActiveSent.id)
      .eq("investor_id", investorId)
      .maybeSingle();
    hasSigner = !!signer;
  }

  const docsQuery = supabase
    .from("fundops_documents")
    .select("id, type, investor_id, investment_id")
    .eq("company_id", company.id)
    .eq("status", "active");

  if (investmentId) {
    docsQuery.eq("investment_id", investmentId);
    if (investorId) docsQuery.eq("investor_id", investorId);
  }
  const { data: docs } = await docsQuery;

  let hasNotaryDeed = false;
  let hasInvestmentForm = false;
  let hasWireProof = false;
  let hasInvestmentFormSigned = false;
  let hasBankTransferProof = false;
  let hasPrivacyNotice = false;
  let hasIdDocument = false;
  let hasTaxCode = false;
  let hasBankTransferReceipt = false;
  let receiptDocumentId: string | null = null;

  for (const d of docs ?? []) {
    if (d.type === "notary_deed" && !d.investor_id) hasNotaryDeed = true;
    if (d.type === "investment_form" && d.investor_id === investorId) hasInvestmentForm = true;
    if (d.type === "wire_proof" && d.investor_id === investorId) hasWireProof = true;
    if (d.type === "investment_form_signed" && d.investor_id === investorId) hasInvestmentFormSigned = true;
    if (d.type === "bank_transfer_proof" && d.investor_id === investorId) hasBankTransferProof = true;
    if (d.type === "privacy_notice" && d.investor_id === investorId) hasPrivacyNotice = true;
    if (d.type === "id_document" && d.investor_id === investorId) hasIdDocument = true;
    if (d.type === "tax_code" && d.investor_id === investorId) hasTaxCode = true;
    if (d.type === "bank_transfer_receipt" && d.investor_id === investorId) hasBankTransferReceipt = true;
    if (d.type === "loi_receipt" && d.investor_id === investorId) receiptDocumentId = d.id;
  }

  return new Response(
    JSON.stringify({
      hasNotaryDeed,
      hasInvestmentForm,
      hasWireProof,
      hasInvestmentFormSigned,
      hasBankTransferProof,
      hasPrivacyNotice,
      hasIdDocument,
      hasTaxCode,
      hasBankTransferReceipt,
      investmentId,
      phase,
      lifecycleStage,
      loiSignedAt,
      loiSignedName,
      hasLoiMaster,
      hasSigner,
      profileFullName,
      receiptDocumentId,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
