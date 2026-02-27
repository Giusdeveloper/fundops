import { createBrowserClient } from "@supabase/ssr";
import { ensureInvestorAccount as ensureInvestorAccountRpc } from "@/lib/portalEnsureInvestor";

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

declare global {
  var __fundopsSupabaseBrowserClient: BrowserSupabaseClient | undefined;
}

export function createClient() {
  if (globalThis.__fundopsSupabaseBrowserClient) {
    return globalThis.__fundopsSupabaseBrowserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase browser env vars");
  }

  globalThis.__fundopsSupabaseBrowserClient = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );

  return globalThis.__fundopsSupabaseBrowserClient;
}

/**
 * Chiama RPC ensure_investor_account(company_id).
 * Wrapper per uso client-side: usa createClient().
 */
export async function ensureInvestorAccount(companyId: string) {
  return ensureInvestorAccountRpc(createClient(), companyId);
}
