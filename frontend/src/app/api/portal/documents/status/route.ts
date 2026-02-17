import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  fetchCompanyBySlug,
  hasSignedLoiForCompany,
  getPhaseForCompany,
  getLoiActiveSentForCompany,
} from "@/lib/portalHelpers";

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request: NextRequest) {
  const supabase = supabaseServer;
  const supabaseAuth = await createClient();

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
  if (!slug) {
    return err("slug è richiesto", 400);
  }

  const company = await fetchCompanyBySlug(supabase, slug);
  if (!company) {
    return err("Company non trovata", 404);
  }

  const phase = await getPhaseForCompany(supabase, company.id);
  const hasSignedLoi = await hasSignedLoiForCompany(supabase, company.id);

  if ((phase === "issuing" || phase === "onboarding") && !hasSignedLoi) {
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

  const loiActiveSent = await getLoiActiveSentForCompany(supabase, company.id);
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

  const { data: docs } = await supabase
    .from("fundops_documents")
    .select("id, type, investor_id")
    .eq("company_id", company.id)
    .eq("status", "active");

  let hasNotaryDeed = false;
  let hasInvestmentForm = false;
  let hasWireProof = false;
  let receiptDocumentId: string | null = null;

  for (const d of docs ?? []) {
    if (d.type === "notary_deed" && !d.investor_id) hasNotaryDeed = true;
    if (d.type === "investment_form" && d.investor_id === investorId) hasInvestmentForm = true;
    if (d.type === "wire_proof" && d.investor_id === investorId) hasWireProof = true;
    if (d.type === "loi_receipt" && d.investor_id === investorId) receiptDocumentId = d.id;
  }

  return new Response(
    JSON.stringify({
      hasNotaryDeed,
      hasInvestmentForm,
      hasWireProof,
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
