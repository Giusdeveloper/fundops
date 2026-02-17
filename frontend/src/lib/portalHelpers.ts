import type { SupabaseClient } from "@supabase/supabase-js";

export interface PortalCompany {
  id: string;
  name: string;
  legal_name: string;
  public_slug: string | null;
  phase: string | null;
}

/**
 * Carica la company per slug dalla route (usa SEMPRE public_slug, mai CompanySwitcher).
 */
export async function fetchCompanyBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<PortalCompany | null> {
  const { data, error } = await supabase
    .from("fundops_companies")
    .select("id, name, legal_name, public_slug, phase")
    .eq("public_slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[fetchCompanyBySlug] Error:", error.code, error.message, { slug });
    return null;
  }

  if (!data) {
    console.error("[fetchCompanyBySlug] Company non trovata:", { slug });
    return null;
  }

  return data as PortalCompany;
}

/** @deprecated Usa fetchCompanyBySlug */
export async function resolveCompanyBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<PortalCompany | null> {
  return fetchCompanyBySlug(supabase, slug);
}

/** Ritorna true se esiste almeno una LOI firmata per la company (via investor client_company_id) */
export async function hasSignedLoiForCompany(
  supabase: SupabaseClient,
  companyId: string
): Promise<boolean> {
  const { data: investors } = await supabase
    .from("fundops_investors")
    .select("id")
    .eq("client_company_id", companyId);
  const investorIds = (investors ?? []).map((i) => i.id);
  if (investorIds.length === 0) return false;

  const { count } = await supabase
    .from("fundops_lois")
    .select("id", { count: "exact", head: true })
    .in("investor_id", investorIds)
    .eq("status", "signed");
  return (count ?? 0) > 0;
}

/** LOI master = ultima non archiviata per company */
export async function getLoiMasterForCompany(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ id: string; title?: string } | null> {
  const { data, error } = await supabase
    .from("fundops_lois")
    .select("id, title")
    .eq("company_id", companyId)
    .or("status.neq.archived,status.is.null")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getLoiMasterForCompany] Error:", error);
    return null;
  }
  return data as { id: string; title?: string } | null;
}

/** LOI master con status='sent' (pubblicata per firma) */
export async function getLoiMasterSentForCompany(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ id: string; title?: string } | null> {
  const { data, error } = await supabase
    .from("fundops_lois")
    .select("id, title")
    .eq("company_id", companyId)
    .eq("is_master", true)
    .eq("status", "sent")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getLoiMasterSentForCompany] Error:", error);
    return null;
  }
  return data as { id: string; title?: string } | null;
}

/**
 * LOI attiva per portal: preferisci (is_master=true AND status='sent'),
 * fallback (status='sent' ORDER BY updated_at DESC).
 */
export async function getLoiActiveSentForCompany(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ id: string; title?: string } | null> {
  const master = await getLoiMasterSentForCompany(supabase, companyId);
  if (master) return master;

  const { data, error } = await supabase
    .from("fundops_lois")
    .select("id, title")
    .eq("company_id", companyId)
    .eq("status", "sent")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getLoiActiveSentForCompany] Error:", error);
    return null;
  }
  return data as { id: string; title?: string } | null;
}

/** Verifica se fase è issuance o onboarding (usa process_status logic) */
export async function getPhaseForCompany(
  supabase: SupabaseClient,
  companyId: string
): Promise<"booking" | "issuing" | "onboarding"> {
  const { data: investors } = await supabase
    .from("fundops_investors")
    .select("id")
    .eq("client_company_id", companyId);
  const investorIds = (investors ?? []).map((i) => i.id);

  if (investorIds.length === 0) return "booking";

  const { count: signedCount } = await supabase
    .from("fundops_lois")
    .select("id", { count: "exact", head: true })
    .in("investor_id", investorIds)
    .eq("status", "signed");

  if ((signedCount ?? 0) === 0) return "booking";

  return "issuing";
}
