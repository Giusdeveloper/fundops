import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireCapTableAccess(companyId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false as const, status: 401, body: { error: "Unauthorized" } };
  }

  const admin = createSupabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role_global,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false as const,
      status: 500,
      body: { error: "Failed to load profile", code: profileError.code ?? null },
    };
  }

  if (profile?.is_active === false) {
    return { ok: false as const, status: 403, body: { error: "Forbidden" } };
  }

  const role = profile?.role_global ?? null;
  if (role === "investor") {
    return { ok: false as const, status: 403, body: { error: "Forbidden" } };
  }

  if (role === "imment_admin" || role === "imment_operator") {
    return { ok: true as const, admin, userId: user.id, role };
  }

  const { data: membership, error: membershipError } = await admin
    .from("fundops_company_users")
    .select("id, role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .eq("role", "company_admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return {
      ok: false as const,
      status: 500,
      body: { error: "Failed to check company access", code: membershipError.code ?? null },
    };
  }

  if (!membership) {
    return { ok: false as const, status: 403, body: { error: "Forbidden" } };
  }

  return { ok: true as const, admin, userId: user.id, role };
}

export async function requireCapTableScenarioAccess(scenarioId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false as const, status: 401, body: { error: "Unauthorized" } };
  }

  const admin = createSupabaseAdmin();
  const { data: scenario, error: scenarioError } = await admin
    .from("fundops_cap_table_scenarios")
    .select("id,company_id,round_id")
    .eq("id", scenarioId)
    .maybeSingle();

  if (scenarioError) {
    return {
      ok: false as const,
      status: 500,
      body: { error: "Failed to load scenario", code: scenarioError.code ?? null },
    };
  }

  if (!scenario) {
    return { ok: false as const, status: 404, body: { error: "Scenario not found" } };
  }

  const access = await requireCapTableAccess(scenario.company_id);
  if (!access.ok) {
    return access;
  }

  return {
    ok: true as const,
    admin: access.admin,
    userId: access.userId,
    role: access.role,
    scenario,
  };
}
