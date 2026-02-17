import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Chiama RPC ensure_investor_account(company_id).
 * Crea/assicura: investor (by email), fundops_investor_users, fundops_investor_accounts.
 * Richiede un client Supabase con sessione utente (es. createClient da server o client).
 */
export async function ensureInvestorAccount(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ investorId?: string; error: Error | null }> {
  const { data, error } = await supabase.rpc("ensure_investor_account", {
    p_company_id: companyId,
  });
  if (error) return { error };
  return { investorId: data as string | undefined, error: null };
}

/**
 * Verifica se l'utente ha accesso al portal (invite flow).
 * investor_account deve esistere; se sì, crea fundops_investor_users.
 * Non crea mai investor_account.
 */
export async function checkInvestorPortalAccess(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ hasAccess: boolean; error: Error | null }> {
  const { data, error } = await supabase.rpc("check_investor_portal_access", {
    p_company_id: companyId,
  });
  if (error) return { hasAccess: false, error };
  return { hasAccess: data === true, error: null };
}
