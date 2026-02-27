import type { PostgrestError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Errore Supabase normalizzato per log e debug */
export interface SupabaseErrorObj {
  message: string;
  code: string;
  details?: string;
  hint?: string;
}

function toErrorObj(e: PostgrestError | null): SupabaseErrorObj | null {
  if (!e) return null;
  const err = e as unknown as Record<string, unknown>;
  return {
    message: String(err?.message ?? (e as Error)?.message ?? ""),
    code: String(err?.code ?? ""),
    details: err?.details != null ? String(err.details) : undefined,
    hint: err?.hint != null ? String(err.hint) : undefined,
  };
}

/** Log errore Supabase in modo sempre leggibile (evita "Error: {}") */
function logSupabaseError(tag: string, err: SupabaseErrorObj | null, raw: unknown): void {
  const payload = err ?? {
    message: raw instanceof Error ? raw.message : String(raw),
    code: "UNKNOWN",
    details: undefined,
    hint: undefined,
  };
  console.error(`[${tag}] Error:`, JSON.stringify(payload));
}

export interface PortalLoi {
  id: string;
  company_id?: string;
  status?: string;
  is_master?: boolean;
  updated_at?: string;
  loi_number?: string | null;
  round_name?: string | null;
  premessa_text?: string | null;
  modalita_text?: string | null;
  condizioni_text?: string | null;
  regolamento_ref?: string | null;
}

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
    const normalizedError = toErrorObj(error);
    logSupabaseError("fetchCompanyBySlug", normalizedError, error);
    console.error("[fetchCompanyBySlug] slug:", slug);
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

export type LoiMasterResult = { data: PortalLoi | null; error: SupabaseErrorObj | null };

/** LOI master con status='sent' (pubblicata per firma). Schema: id, company_id, status, is_master, updated_at, loi_number. */
export async function getLoiMasterSentForCompany(
  supabase: SupabaseClient,
  companyId: string
): Promise<LoiMasterResult> {
  const { data, error } = await supabase
    .from("fundops_lois")
    .select("id, company_id, status, is_master, updated_at, loi_number")
    .eq("company_id", companyId)
    .eq("is_master", true)
    .eq("status", "sent")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const normalizedError = toErrorObj(error);
    logSupabaseError("getLoiMasterSentForCompany", normalizedError, error);
    return { data: null, error: normalizedError };
  }
  return { data: data as PortalLoi | null, error: null };
}

/** LOI attiva per portal = master sent. Usa solo getLoiMasterSentForCompany. */
export async function getLoiActiveSentForCompany(
  supabase: SupabaseClient,
  companyId: string
): Promise<LoiMasterResult> {
  return getLoiMasterSentForCompany(supabase, companyId);
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
