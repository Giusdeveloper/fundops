import { createBrowserClient } from "@supabase/ssr";
import { ensureInvestorAccount as ensureInvestorAccountRpc } from "@/lib/portalEnsureInvestor";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Chiama RPC ensure_investor_account(company_id).
 * Wrapper per uso client-side: usa createClient().
 */
export async function ensureInvestorAccount(companyId: string) {
  return ensureInvestorAccountRpc(createClient(), companyId);
}
