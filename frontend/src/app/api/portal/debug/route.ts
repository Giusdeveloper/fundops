import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  fetchCompanyBySlug,
  getLoiActiveSentForCompany,
} from "@/lib/portalHelpers";

/**
 * GET /api/portal/debug?slug=imment-srl
 * Ritorna diagnostica per capire perché il portal non mostra nulla.
 * Richiede utente autenticato.
 */
export async function GET(request: NextRequest) {
  const debugEnabled = process.env.ENABLE_DEBUG_ENDPOINTS === "true";
  if (process.env.NODE_ENV === "production" || !debugEnabled) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return Response.json({ error: "slug richiesto" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const debug: Record<string, unknown> = {
    slug,
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    logged_in: !!user?.id,
  };

  if (!user?.id) {
    return Response.json(debug);
  }

  if (!supabaseServer) {
    debug.server_configured = false;
    debug.summary = { ok: false, missing: ["supabase_server"] };
    return Response.json(debug);
  }

  const supabaseForCompany = supabaseServer;

  // 1. Company
  const company = await fetchCompanyBySlug(supabaseForCompany, slug);
  debug.company = company
    ? { id: company.id, name: company.name, public_slug: company.public_slug }
    : null;
  debug.company_found = !!company;

  if (!company) {
    return Response.json(debug);
  }

  // 2. investor_id da fundops_investor_users
  const { data: iu } = await supabase
    .from("fundops_investor_users")
    .select("investor_id")
    .eq("user_id", user.id)
    .maybeSingle();
  debug.investor_id = iu?.investor_id ?? null;
  debug.investor_user_link = !!iu?.investor_id;

  if (!iu?.investor_id) {
    return Response.json(debug);
  }

  // 3. investor_account
  const { data: account } = await supabase
    .from("fundops_investor_accounts")
    .select("id, lifecycle_stage")
    .eq("investor_id", iu.investor_id)
    .eq("company_id", company.id)
    .maybeSingle();
  debug.investor_account = account;
  debug.investor_account_found = !!account;

  // 4. LOI
  const loi = await getLoiActiveSentForCompany(supabaseForCompany, company.id);
  debug.loi = loi;
  debug.loi_found = !!loi;

  debug.summary = {
    ok: !!company && !!iu?.investor_id && !!account && !!loi,
    missing: [
      !company && "company",
      !iu?.investor_id && "investor_user_link",
      !account && "investor_account",
      !loi && "loi_sent",
    ].filter(Boolean),
  };

  return Response.json(debug);
}
