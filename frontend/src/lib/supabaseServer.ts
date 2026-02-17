import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Service role key per operazioni server-side (bypassa RLS)
// IMPORTANTE: Non esporre mai questa chiave nel client!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY non configurata. Le operazioni Storage potrebbero fallire.");
}

// Client server-side con service role (bypassa RLS)
// Usa questo solo nelle API routes, mai nel client!
export const supabaseServer = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
