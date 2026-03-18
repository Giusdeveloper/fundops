import { createClient } from "@/lib/supabase/server";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role_global: string | null;
  [key: string]: unknown;
}

type PendingRole = "founder" | "investor";

function isPendingRole(value: unknown): value is PendingRole {
  return value === "founder" || value === "investor";
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

  let nextRole: PendingRole | null = null;
  const pendingRole = isPendingRole(user.user_metadata?.pending_role)
    ? (user.user_metadata.pending_role as PendingRole)
    : null;

  if (!profile.role_global && pendingRole) {
    nextRole = pendingRole;
  }

  if (!nextRole && !profile.role_global) {
    const { data: investorLink } = await supabase
      .from("fundops_investor_users")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (investorLink) {
      nextRole = "investor";
    }
  }

  if (!nextRole && !profile.role_global) {
    const { data: seat } = await supabase
      .from("fundops_company_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (seat) {
      nextRole = "founder";
    }
  }

  if (nextRole && profile.role_global !== nextRole) {
    const { error: roleUpdateError } = await supabase
      .from("profiles")
      .update({ role_global: nextRole })
      .eq("id", user.id);
    if (roleUpdateError) {
      console.error("[ensureProfile] role update:", {
        message: roleUpdateError?.message,
        details: roleUpdateError?.details,
        hint: roleUpdateError?.hint,
        code: roleUpdateError?.code,
      });
    } else {
      (profile as Profile).role_global = nextRole;
    }
  }

  return profile as Profile;
}
