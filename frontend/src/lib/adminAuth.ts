import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";

export interface AdminProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role_global: string | null;
  is_active: boolean | null;
}

/**
 * Verifica che il current user sia imment_admin e is_active=true.
 * @returns Profilo admin o null se non autorizzato
 */
export async function getAdminProfile(): Promise<AdminProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role_global, is_active")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    profile.role_global !== "imment_admin" ||
    profile.is_active !== true
  ) {
    return null;
  }

  return profile as AdminProfile;
}

/**
 * Per API routes: ottiene supabaseServer solo se l'utente è admin.
 * @returns { admin, supabase } o null
 */
export async function requireAdminForApi(): Promise<{
  admin: AdminProfile;
  supabase: NonNullable<typeof supabaseServer>;
} | null> {
  const admin = await getAdminProfile();
  if (!admin || !supabaseServer) return null;

  return { admin, supabase: supabaseServer };
}
