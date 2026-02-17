import { createClient } from "@/lib/supabase/server";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role_global: string | null;
  [key: string]: unknown;
}

/**
 * Garantisce che ogni utente autenticato abbia un record in public.profiles.
 * Upsert: id = auth.uid(), email = user.email. Se esiste già, non genera errore.
 * @returns profilo se ok, null se utente non autenticato o errore
 */
export async function ensureProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return null;
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        full_name: null,
        role_global: null,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

  if (error) {
    console.error("[ensureProfile]", {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });
    return null;
  }

  const { data: profile, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (selectError) {
    console.error("[ensureProfile] select:", {
      message: selectError?.message,
      details: selectError?.details,
      hint: selectError?.hint,
      code: selectError?.code,
    });
    return null;
  }

  return profile as Profile;
}
